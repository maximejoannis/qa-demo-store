export function updateProduct(products, id, input) {
  const product = products.find((p) => p.id === Number(id));
  if (!product) return { ok: false, error: 'Product not found' };
  const stock = Number(input.stock);
  const price = Math.round(Number(input.price) * 100);
  if (!Number.isInteger(stock) || stock < 0 || !Number.isSafeInteger(price) || price < 1)
    return { ok: false, error: 'Enter a valid stock and price' };
  return {
    ok: true,
    products: products.map((p) =>
      p.id === product.id ? { ...p, stock, price, active: input.active === 'on' } : p,
    ),
  };
}
