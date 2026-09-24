export const LOW_STOCK = 5;
export const stockLevel = (n) => (n <= 0 ? 'out' : n <= LOW_STOCK ? 'low' : 'in');
export const hasStock = (products, lines) =>
  lines.every((l) => {
    const product = products.find((p) => p.id === l.id);
    return (
      Number.isInteger(l.qty) &&
      l.qty > 0 &&
      product?.active !== false &&
      (product?.stock ?? 0) >= l.qty
    );
  });
export const adjustStock = (products, lines, dir) =>
  products.map((p) => {
    const l = lines.find((x) => x.id === p.id);
    return l ? { ...p, stock: p.stock + dir * l.qty } : p;
  });
