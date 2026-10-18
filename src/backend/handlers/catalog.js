import { ProductQuerySchema, ReviewRequestSchema, StockAlertRequestSchema } from '../schemas.js';
import {
  filterProducts,
  paginate,
  parisDate,
  productRating,
  searchProducts,
  sortProducts,
} from '../../engine/index.js';
import { productDto } from '../dto.js';
import { ApiError } from '../errors.js';
import { faultActive } from '../faults.js';
import { ok, parse } from '../router.js';
import { C } from '../types.js';

async function visibleProduct(ctx, id) {
  const product = await ctx.product(Number(id));
  if (!product.active && ctx.user?.role !== 'admin') {
    throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }
  return product;
}

/** FAULT-PRB-02: two product images are swapped for problem_user. */
function withFaultyImage(ctx, product) {
  if (!faultActive('FAULT-PRB-02', ctx.user, ctx.deps.config)) return product;
  const swap = { 2: 5, 5: 2 };
  const target = swap[product.id];
  return target ? { ...product, image: `products/product-${String(target)}.svg` } : product;
}

export const catalogRoutes = [
  {
    method: 'GET',
    path: '/products',
    auth: 'public',
    tag: 'catalog',
    summary: 'Search, filter, sort and paginate the catalog',
    request: 'ProductQuerySchema',
    response: 'ProductPageSchema',
    async handler(ctx, { query }) {
      const q = parse(ProductQuerySchema, query);
      const reviews = await ctx.store.list(C.reviews);
      const all = (await ctx.store.list(C.products)).filter((product) => product.active);
      const rated = all.map((product) => ({
        ...product,
        rating: productRating(product, reviews).rating,
      }));
      const found = filterProducts(
        searchProducts(rated, q.search),
        {
          category: q.category,
          min: q.min ?? null,
          max: q.max ?? null,
          inStock: q.inStock,
          minRating: q.minRating,
        },
        ctx.now,
      );
      let sorted = sortProducts(found, q.sort, ctx.now);
      if (q.sort === 'price-asc' && faultActive('FAULT-PRB-01', ctx.user, ctx.deps.config))
        sorted = sorted.reverse();
      const page = paginate(sorted, q.page, q.perPage);
      return ok({
        ...page,
        items: page.items.map((product) =>
          productDto(withFaultyImage(ctx, product), ctx.now, productRating(product, reviews)),
        ),
        categories: [...new Set(all.map((product) => product.category))].sort(),
      });
    },
  },
  {
    method: 'GET',
    path: '/products/:id',
    auth: 'public',
    tag: 'catalog',
    summary: 'Product detail with reviews',
    async handler(ctx, { params }) {
      const product = await visibleProduct(ctx, String(params.id));
      const reviews = (await ctx.store.list(C.reviews))
        .filter((review) => review.productId === product.id)
        .sort((a, b) => b.date.localeCompare(a.date));
      const alerts = ctx.user
        ? (await ctx.store.list(C.stockAlerts)).some(
            (alert) =>
              alert.userId === ctx.user?.id && alert.productId === product.id && !alert.notified,
          )
        : false;
      return ok({
        product: productDto(
          withFaultyImage(ctx, product),
          ctx.now,
          productRating(product, reviews),
        ),
        reviews: reviews.map(({ author, rating, comment, date }) => ({
          author,
          rating,
          comment,
          date: date.slice(0, 10),
        })),
        stockAlert: alerts,
      });
    },
  },
  {
    method: 'POST',
    path: '/products/:id/reviews',
    auth: 'user',
    tag: 'catalog',
    summary: 'Post a review (one per customer and product)',
    request: 'ReviewRequestSchema',
    status: 201,
    async handler(ctx, { params, body }) {
      const user = ctx.requireUser();
      const product = await visibleProduct(ctx, String(params.id));
      const input = parse(ReviewRequestSchema, body);
      const existing = await ctx.store.list(C.reviews);
      if (existing.some((review) => review.productId === product.id && review.userId === user.id)) {
        throw new ApiError(409, 'ALREADY_REVIEWED', 'You already reviewed this product');
      }
      const review = {
        id: await ctx.newId('REV-'),
        productId: product.id,
        userId: user.id,
        author: user.username,
        rating: input.rating,
        comment: input.comment,
        date: ctx.now.toISOString(),
      };
      await ctx.store.put(C.reviews, review);
      return ok(
        {
          author: review.author,
          rating: review.rating,
          comment: review.comment,
          date: parisDate(ctx.now),
        },
        201,
      );
    },
  },
  {
    method: 'POST',
    path: '/products/:id/stock-alerts',
    auth: 'user',
    tag: 'catalog',
    summary: 'Ask to be notified when a sold-out product is back (explicit consent)',
    request: 'StockAlertRequestSchema',
    status: 201,
    async handler(ctx, { params, body }) {
      const user = ctx.requireUser();
      parse(StockAlertRequestSchema, body);
      const product = await visibleProduct(ctx, String(params.id));
      if (product.stock > 0)
        throw new ApiError(409, 'PRODUCT_IN_STOCK', 'This product is in stock');
      const alerts = await ctx.store.list(C.stockAlerts);
      if (
        alerts.some(
          (alert) => alert.userId === user.id && alert.productId === product.id && !alert.notified,
        )
      ) {
        throw new ApiError(409, 'ALERT_EXISTS', 'You will already be notified');
      }
      await ctx.store.put(C.stockAlerts, {
        id: await ctx.newId('ALERT-'),
        userId: user.id,
        productId: product.id,
        date: ctx.now.toISOString(),
        notified: false,
      });
      return ok({ productId: product.id, subscribed: true }, 201);
    },
  },
  {
    method: 'GET',
    path: '/me/wishlist',
    auth: 'user',
    tag: 'account',
    summary: 'Saved products',
    async handler(ctx) {
      const user = ctx.requireUser();
      const wishlist = await ctx.store.get(C.wishlists, user.id);
      const products = await ctx.store.list(C.products);
      const items = (wishlist?.productIds ?? [])
        .map((id) => products.find((product) => product.id === id))
        .filter((product) => Boolean(product?.active));
      return ok({ items: items.map((product) => productDto(product, ctx.now)) });
    },
  },
  {
    method: 'POST',
    path: '/me/wishlist/:id/toggle',
    auth: 'user',
    tag: 'account',
    summary: 'Add or remove a product from the wishlist',
    async handler(ctx, { params }) {
      const user = ctx.requireUser();
      const product = await visibleProduct(ctx, String(params.id));
      const current = (await ctx.store.get(C.wishlists, user.id))?.productIds ?? [];
      const saved = !current.includes(product.id);
      const productIds = saved
        ? [...current, product.id]
        : current.filter((id) => id !== product.id);
      await ctx.store.put(C.wishlists, { id: user.id, productIds });
      return ok({ productId: product.id, saved });
    },
  },
];
