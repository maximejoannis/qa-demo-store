import { LoginRequestSchema, RegisterRequestSchema } from '../schemas.js';
import { userDto } from '../dto.js';
import { ApiError } from '../errors.js';
import { faultActive, GLITCH_DELAY_MS } from '../faults.js';
import { committedFailure, ok, parse } from '../router.js';
import { C } from '../types.js';

const MAX_FAILURES = 5;

const LOCK_MINUTES = 15;

async function openSession(ctx, user) {
  const token = ctx.deps.crypto.randomHex(32);
  const session = {
    id: await ctx.deps.crypto.sha256Hex(token),
    userId: user.id,
    expiresAt: new Date(
      ctx.now.getTime() + ctx.deps.config.sessionTtlMinutes * 60_000,
    ).toISOString(),
  };
  await ctx.store.put(C.sessions, session);
  return token;
}

export const authRoutes = [
  {
    method: 'POST',
    path: '/auth/login',
    auth: 'public',
    tag: 'auth',
    summary: 'Sign in (progressive lock after 5 failures)',
    request: 'LoginRequestSchema',
    response: 'MeResponseSchema',
    async handler(ctx, { body }) {
      const input = parse(LoginRequestSchema, body);
      const user = await ctx.store.get(C.users, input.username.toLowerCase());
      if (user && faultActive('FAULT-GLT-01', user, ctx.deps.config)) {
        await ctx.sleep(GLITCH_DELAY_MS);
      }
      if (!user) {
        await ctx.deps.crypto.verifyPassword(input.password, 'pbkdf2$1$00$00');
        await ctx.log('login_failure', input.username);
        return committedFailure(
          new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password'),
        );
      }
      if (user.lockedUntil && user.lockedUntil > ctx.now.toISOString()) {
        throw new ApiError(
          423,
          'ACCOUNT_TEMPORARILY_LOCKED',
          'Too many attempts. Try again later.',
          {
            details: { lockedUntil: user.lockedUntil },
          },
        );
      }
      if (!(await ctx.deps.crypto.verifyPassword(input.password, user.passwordHash))) {
        const failures = user.failedLogins + 1;
        const locked = failures >= MAX_FAILURES;
        await ctx.store.put(C.users, {
          ...user,
          failedLogins: locked ? 0 : failures,
          lockedUntil: locked
            ? new Date(ctx.now.getTime() + LOCK_MINUTES * 60_000).toISOString()
            : user.lockedUntil,
        });
        await ctx.log('login_failure', user.id);
        return committedFailure(
          new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password', {
            details: { remainingAttempts: locked ? 0 : MAX_FAILURES - failures },
          }),
        );
      }
      if (user.locked) throw new ApiError(403, 'ACCOUNT_LOCKED', 'This account is locked');
      const updated = { ...user, failedLogins: 0, lockedUntil: null, lastActivityAt: ctx.today };
      await ctx.store.put(C.users, updated);
      await ctx.log('login_success', user.id);
      return {
        status: 200,
        body: { user: userDto(updated, ctx.deps.config) },
        session: await openSession(ctx, updated),
      };
    },
  },
  {
    method: 'POST',
    path: '/auth/logout',
    auth: 'public',
    tag: 'auth',
    summary: 'Sign out',
    async handler(ctx, { sessionToken: token }) {
      if (token) await ctx.store.delete(C.sessions, await ctx.deps.crypto.sha256Hex(token));
      return { status: 204, session: null };
    },
  },
  {
    method: 'GET',
    path: '/auth/me',
    auth: 'public',
    tag: 'auth',
    summary: 'Current user',
    response: 'MeResponseSchema',
    handler: (ctx) =>
      Promise.resolve(ok({ user: ctx.user ? userDto(ctx.user, ctx.deps.config) : null })),
  },
  {
    method: 'POST',
    path: '/auth/register',
    auth: 'public',
    tag: 'auth',
    summary: 'Create a customer account',
    request: 'RegisterRequestSchema',
    response: 'MeResponseSchema',
    status: 201,
    async handler(ctx, { body }) {
      const input = parse(RegisterRequestSchema, body);
      const users = await ctx.store.list(C.users);
      if (users.some((user) => user.id === input.username.toLowerCase())) {
        throw new ApiError(409, 'USERNAME_TAKEN', 'Username already exists');
      }
      if (users.some((user) => user.email === input.email)) {
        throw new ApiError(409, 'EMAIL_TAKEN', 'Email already exists');
      }
      const user = {
        id: input.username.toLowerCase(),
        username: input.username,
        passwordHash: await ctx.deps.crypto.hashPassword(input.password),
        role: 'customer',
        locked: false,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: '',
        address: null,
        newsletter: input.newsletter ?? false,
        faultProfile: null,
        createdAt: ctx.now.toISOString(),
        lastActivityAt: ctx.today,
        failedLogins: 0,
        lockedUntil: null,
      };
      await ctx.store.put(C.users, user);
      if (user.newsletter) {
        const proof = {
          id: await ctx.newId('CONSENT-'),
          subject: await ctx.pseudonym(user.id),
          kind: 'newsletter',
          choices: { newsletter: true },
          policyVersion: '2026-10',
          date: ctx.now.toISOString(),
        };
        await ctx.store.put(C.consents, proof);
      }
      await ctx.log('account_created', user.id);
      return {
        status: 201,
        body: { user: userDto(user, ctx.deps.config) },
        session: await openSession(ctx, user),
      };
    },
  },
];
