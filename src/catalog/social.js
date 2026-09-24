export function toggleWishlist(wishlist, username, product) {
  if (!username || !product?.active) return { ok: false, error: 'Sign in to save products' };
  const current = wishlist[username] ?? [];
  return {
    ok: true,
    wishlist: {
      ...wishlist,
      [username]: current.includes(product.id)
        ? current.filter((id) => id !== product.id)
        : [...current, product.id],
    },
  };
}

export function addReview(reviews, username, productId, rating, comment) {
  if (!username) return { ok: false, error: 'Sign in to review' };
  const score = Number(rating);
  if (!Number.isInteger(score) || score < 1 || score > 5)
    return { ok: false, error: 'Rating must be 1 to 5' };
  const text = String(comment ?? '').trim();
  if (text.length < 3 || text.length > 500)
    return { ok: false, error: 'Comment must be 3 to 500 characters' };
  return {
    ok: true,
    reviews: [...reviews, { username, productId, rating: score, comment: text }],
  };
}

export function productRating(product, reviews) {
  const list = reviews.filter((r) => r.productId === product.id);
  return list.length
    ? {
        rating: (list.reduce((sum, r) => sum + r.rating, 0) / list.length).toFixed(1),
        count: list.length,
      }
    : { rating: product.rating, count: product.reviews };
}
