const rows = [
  ['Wireless Headphones', 'Electronics', 7999, 9999, 25, 4.6, 120, 'Sale', 300],
  ['Smart Speaker', 'Electronics', 5999, 0, 12, 4.2, 80, '', 900],
  ['4K Action Camera', 'Electronics', 12999, 14999, 3, 4.4, 64, 'Low stock', 250],
  ['USB-C Hub', 'Accessories', 3499, 0, 40, 4.1, 210, '', 120],
  ['Leather Wallet', 'Accessories', 2999, 3999, 18, 4.5, 95, 'Sale', 150],
  ['Phone Stand', 'Accessories', 1499, 0, 60, 3.9, 150, '', 200],
  ['Ceramic Lamp', 'Home', 4599, 0, 9, 4.3, 41, '', 1800],
  ['Throw Blanket', 'Home', 3999, 4999, 22, 4.7, 132, 'Sale', 1200],
  ['Aroma Diffuser', 'Home', 2799, 0, 0, 4.0, 58, 'Sold out', 600],
  ['Mechanical Keyboard', 'Gaming', 8999, 0, 15, 4.8, 310, 'Best seller', 1100],
  ['Gaming Mouse', 'Gaming', 4999, 5999, 30, 4.6, 275, 'Sale', 150],
  ['Controller Pro', 'Gaming', 5999, 0, 7, 4.4, 120, '', 400],
  ['Ergonomic Chair', 'Office', 19999, 24999, 5, 4.5, 88, 'Sale', 15000],
  ['Desk Organizer', 'Office', 1999, 0, 45, 4.0, 37, '', 700],
  ['Camping Tent', 'Outdoor', 14999, 0, 8, 4.6, 52, '', 4200],
  ['Insulated Bottle', 'Outdoor', 2499, 0, 70, 4.7, 402, '', 450],
  ['Practical QA Handbook', 'Books', 2490, 0, 35, 4.8, 64, 'New', 400],
  ['Automation Patterns', 'Books', 3290, 0, 20, 4.5, 23, 'New', 550],
];

/** Seed catalog. Prices are TTC (v1 prices kept as-is, now interpreted as TTC). */
export const PRODUCTS = rows.map(
  ([name, category, price, oldPrice, stock, rating, reviews, badge, weightGrams], index) => ({
    id: index + 1,
    sku: `SKU-${String(1000 + index)}`,
    name,
    description: `${name}: a dependable ${category.toLowerCase()} essential.`,
    category,
    price,
    oldPrice,
    stock,
    weightGrams,
    rating,
    reviews,
    badge,
    isNew: index % 5 === 0 || category === 'Books',
    image: `products/product-${String(index + 1)}.svg`,
    promoStart: oldPrice ? '2020-01-01' : null,
    promoEnd: oldPrice ? '2099-12-31' : null,
    active: true,
  }),
);

export const SELLER = {
  name: 'QA Demo Store SAS (société fictive)',
  address: '1 rue de la Démo, 75000 Paris, France',
  siren: '000 000 000 (fictif)',
  vatNumber: 'FR00000000000 (fictif)',
  dpo: 'dpo@qa-demo-store.invalid (DPO fictif)',
};
