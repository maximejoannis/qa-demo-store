export const FREE_THRESHOLD = 5000;
export const METHODS = {
  standard: { id: 'standard', label: 'Standard (3-5 days)', cost: 490 },
  express: { id: 'express', label: 'Express (1-2 days)', cost: 1290 },
  pickup: { id: 'pickup', label: 'Pickup (free, ready in 2h)', cost: 0 },
};
export function shippingCost(id, subtotal) {
  const m = METHODS[id];
  if (!m) throw new Error('Unknown shipping method');
  return id === 'standard' && subtotal >= FREE_THRESHOLD ? 0 : m.cost;
}
