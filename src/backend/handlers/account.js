import {
  AccountConsentsRequestSchema,
  DeleteAccountRequestSchema,
  ProfileUpdateSchema,
  VisitorConsentRequestSchema,
} from '../schemas.js';
import { nextTier } from '../../engine/index.js';
import { orderDto } from '../dto.js';
import { ApiError } from '../errors.js';
import { ok, parse } from '../router.js';
import { loyaltyContext } from '../services.js';
import { C } from '../types.js';

const POLICY_VERSION = '2026-10';

const profileOf = (user) => ({
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  address: user.address?.address ?? '',
  city: user.address?.city ?? '',
  zip: user.address?.zip ?? '',
  country: user.address?.country ?? '',
  newsletter: user.newsletter,
});

async function recordConsent(ctx, subject, kind, choices) {
  const proof = {
    id: await ctx.newId('CONSENT-'),
    subject,
    kind,
    choices,
    policyVersion: POLICY_VERSION,
    date: ctx.now.toISOString(),
  };
  await ctx.store.put(C.consents, proof);
  return proof;
}

/** Collects every personal data item linked to the user (RGPD art. 15 and 20). */
async function exportData(ctx, user) {
  const subject = await ctx.pseudonym(user.id);
  const loyalty = await loyaltyContext(ctx, user.id);
  return {
    format: 'qa-demo-store/export@1',
    exportedAt: ctx.now.toISOString(),
    controller: 'QA Demo Store SAS (fictitious)',
    account: {
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      lastActivityAt: user.lastActivityAt,
      ...profileOf(user),
    },
    orders: (await ctx.store.list(C.orders))
      .filter((order) => order.userId === user.id)
      .map(orderDto),
    reviews: (await ctx.store.list(C.reviews))
      .filter((review) => review.userId === user.id)
      .map(({ productId, rating, comment, date }) => ({ productId, rating, comment, date })),
    wishlist: (await ctx.store.get(C.wishlists, user.id))?.productIds ?? [],
    loyalty: { balance: loyalty.balance, tier: loyalty.tier, history: loyalty.entries },
    stockAlerts: (await ctx.store.list(C.stockAlerts))
      .filter((alert) => alert.userId === user.id)
      .map(({ productId, date, notified }) => ({ productId, date, notified })),
    consents: (await ctx.store.list(C.consents))
      .filter((consent) => consent.subject === subject)
      .map(({ kind, choices, policyVersion, date }) => ({ kind, choices, policyVersion, date })),
  };
}

export const accountRoutes = [
  {
    method: 'GET',
    path: '/me/profile',
    auth: 'user',
    tag: 'account',
    summary: 'My profile',
    handler: (ctx) => Promise.resolve(ok(profileOf(ctx.requireUser()))),
  },
  {
    method: 'PUT',
    path: '/me/profile',
    auth: 'user',
    tag: 'account',
    summary: 'Update my profile (right to rectification)',
    request: 'ProfileUpdateSchema',
    async handler(ctx, { body }) {
      const user = ctx.requireUser();
      const input = parse(ProfileUpdateSchema, body);
      const users = await ctx.store.list(C.users);
      if (users.some((other) => other.id !== user.id && other.email === input.email)) {
        throw new ApiError(409, 'EMAIL_TAKEN', 'Email already exists');
      }
      const updated = {
        ...user,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone ?? '',
        address: input.address
          ? { address: input.address, city: input.city, zip: input.zip, country: input.country }
          : null,
        lastActivityAt: ctx.today,
      };
      await ctx.store.put(C.users, updated);
      return ok(profileOf(updated));
    },
  },
  {
    method: 'GET',
    path: '/me/loyalty',
    auth: 'user',
    tag: 'account',
    summary: 'Loyalty balance, tier and history',
    response: 'LoyaltySchema',
    async handler(ctx) {
      const loyalty = await loyaltyContext(ctx, ctx.requireUser().id);
      return ok({
        balance: loyalty.balance,
        tier: loyalty.tier,
        rollingPoints: loyalty.rolling,
        next: nextTier(loyalty.rolling),
        history: [...loyalty.entries].sort((a, b) => b.date.localeCompare(a.date)),
      });
    },
  },
  {
    method: 'GET',
    path: '/me/consents',
    auth: 'user',
    tag: 'privacy',
    summary: 'My account-level consents',
    handler: (ctx) => Promise.resolve(ok({ newsletter: ctx.requireUser().newsletter })),
  },
  {
    method: 'PUT',
    path: '/me/consents',
    auth: 'user',
    tag: 'privacy',
    summary: 'Give or withdraw newsletter consent (proof recorded)',
    request: 'AccountConsentsRequestSchema',
    async handler(ctx, { body }) {
      const user = ctx.requireUser();
      const input = parse(AccountConsentsRequestSchema, body);
      await ctx.store.put(C.users, { ...user, newsletter: input.newsletter });
      await recordConsent(ctx, await ctx.pseudonym(user.id), 'newsletter', {
        newsletter: input.newsletter,
      });
      return ok({ newsletter: input.newsletter });
    },
  },
  {
    method: 'POST',
    path: '/consents',
    auth: 'public',
    tag: 'privacy',
    summary: 'Record a visitor cookie choice (pseudonymous proof)',
    request: 'VisitorConsentRequestSchema',
    status: 201,
    async handler(ctx, { body }) {
      const input = parse(VisitorConsentRequestSchema, body);
      const proof = await recordConsent(
        ctx,
        `visitor-${input.visitorId}`,
        'visitor',
        input.choices,
      );
      return ok({ id: proof.id, date: proof.date, policyVersion: proof.policyVersion }, 201);
    },
  },
  {
    method: 'GET',
    path: '/me/export',
    auth: 'user',
    tag: 'privacy',
    summary: 'Export all my data as JSON (access and portability)',
    async handler(ctx) {
      const user = ctx.requireUser();
      await ctx.log('data_exported', user.id);
      return ok(await exportData(ctx, user));
    },
  },
  {
    method: 'DELETE',
    path: '/me',
    auth: 'user',
    tag: 'privacy',
    summary: 'Delete my account (orders kept anonymized for accounting)',
    request: 'DeleteAccountRequestSchema',
    async handler(ctx, { body }) {
      const user = ctx.requireUser();
      const input = parse(DeleteAccountRequestSchema, body);
      if (!(await ctx.deps.crypto.verifyPassword(input.password, user.passwordHash))) {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid password');
      }
      await eraseUser(ctx, user);
      await ctx.log('account_deleted', user.id);
      return { status: 204, session: null };
    },
  },
];

/**
 * Right to erasure (art. 17). Invoices must be kept 10 years (L123-22): orders are unlinked
 * from the account but keep the billing address printed on the invoice.
 */
export async function eraseUser(ctx, user) {
  const alias = `deleted-${(await ctx.pseudonym(user.id)).slice(0, 8)}`;
  for (const order of await ctx.store.list(C.orders)) {
    if (order.userId === user.id)
      await ctx.store.put(C.orders, { ...order, userId: null, username: alias });
  }
  for (const review of await ctx.store.list(C.reviews)) {
    if (review.userId === user.id)
      await ctx.store.put(C.reviews, { ...review, userId: null, author: 'Former customer' });
  }
  for (const alert of await ctx.store.list(C.stockAlerts)) {
    if (alert.userId === user.id) await ctx.store.delete(C.stockAlerts, alert.id);
  }
  for (const session of await ctx.store.list(C.sessions)) {
    if (session.userId === user.id) await ctx.store.delete(C.sessions, session.id);
  }
  await ctx.store.delete(C.wishlists, user.id);
  await ctx.store.delete(C.loyalty, user.id);
  await ctx.store.delete(C.users, user.id);
}
