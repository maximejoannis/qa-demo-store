const toHex = (bytes) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const fromHex = (hex) => {
  const pairs = hex.match(/../g) ?? [];
  const bytes = new Uint8Array(pairs.length);
  pairs.forEach((pair, index) => (bytes[index] = Number.parseInt(pair, 16)));
  return bytes;
};

/** Constant-time comparison of two hex strings. */
export function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1)
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

export async function pbkdf2Hex(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

/** Format: pbkdf2$<iterations>$<saltHex>$<hashHex> */
export async function hashPbkdf2(password, iterations, saltHex) {
  return `pbkdf2$${String(iterations)}$${saltHex}$${await pbkdf2Hex(password, saltHex, iterations)}`;
}

export async function verifyPbkdf2(password, stored) {
  const [scheme, iterations, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterations || !salt || !hash) return false;
  return timingSafeEqualHex(await pbkdf2Hex(password, salt, Number(iterations)), hash);
}

export function createWebCryptoPort(options = {}) {
  const iterations = options.iterations ?? 210_000;
  const randomHex = (bytes) => toHex(crypto.getRandomValues(new Uint8Array(bytes)));
  return {
    randomHex,
    async sha256Hex(value) {
      return toHex(
        new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
      );
    },
    hashPassword: (password) => hashPbkdf2(password, iterations, randomHex(16)),
    verifyPassword: verifyPbkdf2,
  };
}
