export const DEMO_USERS = [
  { username: 'standard_user', password: 'demo123', role: 'customer' },
  { username: 'premium_user', password: 'demo123', role: 'customer' },
  { username: 'admin_user', password: 'admin123', role: 'admin' },
  { username: 'locked_user', password: 'demo123', role: 'customer', locked: true },
];
const PERMS = { customer: ['shop', 'orders:own'], admin: ['shop', 'orders:own', 'admin'] };
export const can = (role, perm) => Boolean(PERMS[role]?.includes(perm));
export function login(username, password, users = DEMO_USERS) {
  if (!username) return { ok: false, error: 'Username is required' };
  if (!password) return { ok: false, error: 'Password is required' };
  const u = users.find((x) => x.username === username && x.password === password);
  if (!u) return { ok: false, error: 'Invalid credentials' };
  if (u.locked) return { ok: false, error: 'This account is locked' };
  return { ok: true, user: { username: u.username, role: u.role } };
}
