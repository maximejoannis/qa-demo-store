import { parisDate } from '../engine/index.js';
import { ApiError } from './errors.js';
import { C } from './types.js';

const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Per-request context: clock, identifiers, current user and helpers. */
export class Context {
  deps;
  now;
  user;
  constructor(deps, now, user) {
    this.deps = deps;
    this.now = now;
    this.user = user;
  }
  get store() {
    return this.deps.store;
  }
  get today() {
    return parisDate(this.now);
  }
  /** Injected sleep (tests) or a real timer. */
  sleep(ms) {
    return this.deps.sleep
      ? this.deps.sleep(ms)
      : new Promise((resolve) => setTimeout(resolve, ms));
  }
  requireUser() {
    if (!this.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
    return this.user;
  }
  requireAdmin() {
    const user = this.requireUser();
    if (user.role !== 'admin')
      throw new ApiError(403, 'FORBIDDEN', 'Administrator access required');
    return user;
  }
  /** Random identifier, or deterministic sequence when the demo id seed is set. */
  async newId(prefix, length = 10) {
    const meta = await this.store.get(C.meta, 'ids');
    if (meta?.seed !== undefined && meta.seed !== null) {
      const counter = (meta.counter ?? 0) + 1;
      await this.store.put(C.meta, { ...meta, counter });
      return `${prefix}${meta.seed.toString(36).toUpperCase()}-${String(counter).padStart(6, '0')}`;
    }
    const hex = this.deps.crypto.randomHex(length);
    const chars = (hex.match(/../g) ?? []).map(
      (pair) => BASE32[Number.parseInt(pair, 16) % 32] ?? '0',
    );
    return `${prefix}${chars.join('')}`;
  }
  async product(id) {
    const product = await this.store.get(C.products, String(id));
    if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    return product;
  }
  /** Pseudonymous subject for logs and consent proofs. */
  async pseudonym(value) {
    return (await this.deps.crypto.sha256Hex(`qads:${value}`)).slice(0, 16);
  }
  async log(event, subject) {
    const entry = {
      id: await this.newLogId(),
      date: this.now.toISOString(),
      event,
      subject: subject ? await this.pseudonym(subject) : null,
    };
    await this.store.put(C.logs, entry);
    this.deps.log?.(event, { subject: entry.subject });
  }
  newLogId() {
    return Promise.resolve(`LOG-${String(this.now.getTime())}-${this.deps.crypto.randomHex(4)}`);
  }
}
