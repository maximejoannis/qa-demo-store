import { DEMO_USERS } from './auth.js';

export function register(users, input) {
  const firstName = String(input.firstName ?? '').trim();
  const lastName = String(input.lastName ?? '').trim();
  const email = String(input.email ?? '')
    .trim()
    .toLowerCase();
  const username = String(input.username ?? '').trim();
  const password = String(input.password ?? '');
  if (!firstName || !lastName || !email || !username || !password)
    return { ok: false, error: 'Complete all required fields' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, error: 'Invalid email address' };
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase()))
    return { ok: false, error: 'Username already exists' };
  if (users.some((u) => u.email?.toLowerCase() === email))
    return { ok: false, error: 'Email already exists' };
  if (password.length < 8 || !/[a-z]/i.test(password) || !/\d/.test(password))
    return { ok: false, error: 'Password needs 8 characters, a letter and a number' };
  if (password !== input.confirm) return { ok: false, error: 'Passwords do not match' };
  if (input.terms !== 'on') return { ok: false, error: 'Accept the terms' };
  const user = { username, password, role: 'customer', email, firstName, lastName };
  return { ok: true, users: [...users, user], user: { username, role: 'customer' } };
}

export function updateProfile(profiles, username, input) {
  const profile = Object.fromEntries(
    ['firstName', 'lastName', 'email', 'address', 'city', 'zip', 'country'].map((key) => [
      key,
      String(input[key] ?? '').trim(),
    ]),
  );
  if (!profile.firstName || !profile.lastName || !profile.email)
    return { ok: false, error: 'Name and email are required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))
    return { ok: false, error: 'Invalid email address' };
  if (
    (profile.address || profile.city || profile.zip || profile.country) &&
    (!profile.address || !profile.city || !profile.zip || !profile.country)
  )
    return { ok: false, error: 'Complete the full delivery address' };
  if (profile.zip && !/^[\p{L}\p{N} -]{3,12}$/u.test(profile.zip))
    return { ok: false, error: 'Invalid postal code' };
  return { ok: true, profiles: { ...profiles, [username]: profile } };
}

export const initialAccounts = () => DEMO_USERS.map((u) => ({ ...u }));
