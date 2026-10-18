import { addDays, computeQuote } from '../engine/index.js';
import { PRODUCTS } from './catalog-data.js';
import { Context } from './context.js';
import { hashPbkdf2 } from './crypto.js';
import { changeStatus, createOrder } from './services.js';
import { C } from './types.js';

/** Demo accounts (passwords are public and fictional; they bypass the registration policy). */
export const DEMO_USERS = [
  {
    username: 'standard_user',
    password: 'demo123',
    role: 'customer',
    firstName: 'Ada',
    lastName: 'Standard',
  },
  {
    username: 'premium_user',
    password: 'demo123',
    role: 'customer',
    firstName: 'Grace',
    lastName: 'Premium',
  },
  {
    username: 'admin_user',
    password: 'admin123',
    role: 'admin',
    firstName: 'Alan',
    lastName: 'Admin',
  },
  {
    username: 'locked_user',
    password: 'demo123',
    role: 'customer',
    locked: true,
    firstName: 'Lou',
    lastName: 'Locked',
  },
  {
    username: 'problem_user',
    password: 'demo123',
    role: 'customer',
    faultProfile: 'problem',
    firstName: 'Pat',
    lastName: 'Problem',
  },
  {
    username: 'glitch_user',
    password: 'demo123',
    role: 'customer',
    faultProfile: 'glitch',
    firstName: 'Gil',
    lastName: 'Glitch',
  },
  {
    username: 'error_user',
    password: 'demo123',
    role: 'customer',
    faultProfile: 'error',
    firstName: 'Eve',
    lastName: 'Error',
  },
  {
    username: 'rounding_user',
    password: 'demo123',
    role: 'customer',
    faultProfile: 'rounding',
    firstName: 'Ron',
    lastName: 'Rounding',
  },
  {
    username: 'a11y_user',
    password: 'demo123',
    role: 'customer',
    faultProfile: 'a11y',
    firstName: 'Aly',
    lastName: 'Access',
  },
  {
    username: 'i18n_user',
    password: 'demo123',
    role: 'customer',
    faultProfile: 'i18n',
    firstName: 'Ina',
    lastName: 'Locale',
  },
];

const DORMANT = {
  username: 'dormant_user',
  password: 'demo123',
  role: 'customer',
  firstName: 'Dora',
  lastName: 'Dormant',
};

const hashCache = new Map();

const saltFor = (username) => {
  const source = `qads-seed-${username}`;
  return Array.from({ length: source.length }, (_, index) =>
    source.charCodeAt(index).toString(16).padStart(2, '0'),
  )
    .join('')
    .slice(0, 32);
};

function seedHash(user, iterations) {
  const key = `${user.username}:${user.password}:${String(iterations)}`;
  let hash = hashCache.get(key);
  if (!hash) {
    hash = hashPbkdf2(user.password, iterations, saltFor(user.username));
    hashCache.set(key, hash);
  }
  return hash;
}

const STANDARD_ADDRESS = { address: '10 rue des Tests', city: 'Lyon', zip: '69001', country: 'FR' };

async function userRecord(seed, deps, now, lastActivity) {
  return {
    id: seed.username,
    username: seed.username,
    passwordHash: await seedHash(seed, deps.config.seedPasswordIterations),
    role: seed.role,
    locked: seed.locked ?? false,
    firstName: seed.firstName,
    lastName: seed.lastName,
    email: `${seed.username.replace('_', '.')}@example.test`,
    phone: '',
    address: seed.role === 'customer' ? STANDARD_ADDRESS : null,
    newsletter: false,
    faultProfile: seed.faultProfile ?? null,
    createdAt: now.toISOString(),
    lastActivityAt: lastActivity,
    failedLogins: 0,
    lockedUntil: null,
  };
}

const at = (now, daysAgo) => new Date(now.getTime() - daysAgo * 86_400_000);

async function seedOrder(deps, user, plan, now) {
  const ctx = new Context(deps, at(now, plan.daysAgo), user);
  const lines = await Promise.all(
    plan.lines.map(async ([id, qty]) => ({ product: await ctx.product(id), qty })),
  );
  const quote = computeQuote({
    lines,
    shippingMethod: plan.method ?? 'standard',
    country: 'FR',
    now: ctx.now,
  });
  const order = await createOrder(ctx, {
    user,
    quote,
    shippingAddress: { firstName: user.firstName, lastName: user.lastName, ...STANDARD_ADDRESS },
    payment: { method: 'card', last4: '4242', installments: 1 },
    installmentPlan: null,
  });
  const stored = { ...order, id: plan.id };
  await deps.store.delete(C.orders, order.id);
  await deps.store.put(C.orders, stored);
  let current = stored;
  for (const [status, daysAgo] of plan.steps) {
    const stepCtx = new Context(deps, at(now, daysAgo), user);
    if (status === 'Refunded' && current.status === 'ReturnRequested') {
      current = await changeStatus(stepCtx, current, status);
      continue;
    }
    if (status === 'ReturnRequested') {
      current = {
        ...current,
        status,
        return: {
          requestedAt: stepCtx.now.toISOString(),
          reason: 'Seeded return',
          lines: current.lines.map((line) => ({
            productId: line.productId,
            qty: line.qty,
            refund: line.net,
          })),
          total: current.merchandiseNet,
          shippingRefund: 0,
          pointsToRevoke: current.loyaltyPointsEarned,
        },
      };
      await deps.store.put(C.orders, current);
      continue;
    }
    current = await changeStatus(stepCtx, current, status);
  }
}

/** Resets the whole store to a named, deterministic scenario. */
export async function seedScenario(deps, scenario, now) {
  const { store } = deps;
  const today = new Context(deps, now, null).today;
  await store.clear();
  const products = PRODUCTS.map((product) =>
    scenario === 'low-stock' ? { ...product, stock: product.id % 4 } : product,
  );
  if (scenario !== 'empty-catalog')
    for (const product of products) await store.put(C.products, product);
  const users = await Promise.all(DEMO_USERS.map((seed) => userRecord(seed, deps, now, today)));
  for (const user of users) await store.put(C.users, user);
  await store.put(C.meta, { id: 'scenario', name: scenario });
  await store.put(C.meta, { id: 'invoice', last: null });
  const premium = {
    id: 'premium_user',
    entries: [{ type: 'earn', points: 620, date: addDays(today, -60), orderId: 'SEED-LOYALTY' }],
  };
  await store.put(C.loyalty, premium);
  const standard = users[0];
  if (scenario === 'loyalty-gold') {
    await store.put(C.loyalty, {
      id: standard.id,
      entries: [{ type: 'earn', points: 1600, date: addDays(today, -30), orderId: 'SEED-LOYALTY' }],
    });
  }
  if (scenario === 'order-history') {
    const plans = [
      {
        id: 'ORD-HIST-0001',
        daysAgo: 30,
        lines: [[5, 1]],
        steps: [
          ['Shipped', 28],
          ['Delivered', 25],
          ['ReturnRequested', 20],
          ['Refunded', 18],
        ],
      },
      {
        id: 'ORD-HIST-0002',
        daysAgo: 19,
        lines: [
          [17, 2],
          [1, 1],
        ],
        steps: [
          ['Shipped', 18],
          ['Delivered', 15],
        ],
      },
      {
        id: 'ORD-HIST-0003',
        daysAgo: 17,
        lines: [
          [17, 2],
          [1, 1],
        ],
        steps: [
          ['Shipped', 16],
          ['Delivered', 13],
        ],
      },
      {
        id: 'ORD-HIST-0004',
        daysAgo: 5,
        lines: [[14, 1]],
        steps: [['Cancelled', 5]],
      },
      {
        id: 'ORD-HIST-0005',
        daysAgo: 3,
        lines: [[10, 1]],
        method: 'express',
        steps: [['Shipped', 2]],
      },
      {
        id: 'ORD-HIST-0006',
        daysAgo: 0,
        lines: [[16, 2]],
        steps: [],
      },
    ];
    for (const plan of plans) await seedOrder(deps, standard, plan, now);
  }
  if (scenario === 'rgpd-expired') {
    const dormant = await userRecord(
      DORMANT,
      deps,
      at(now, 3 * 365 + 1),
      addDays(today, -(3 * 365 + 1)),
    );
    await store.put(C.users, dormant);
    await seedOrder(
      deps,
      dormant,
      {
        id: 'ORD-OLD-0001',
        daysAgo: 3653,
        lines: [[4, 1]],
        steps: [
          ['Shipped', 3652],
          ['Delivered', 3650],
        ],
      },
      now,
    );
    await store.put(C.consents, {
      id: 'CONSENT-OLD-0001',
      subject: 'visitor-0000000000000001',
      kind: 'visitor',
      choices: { analytics: true, personalization: false },
      policyVersion: '2020-01',
      date: at(now, 6 * 365).toISOString(),
    });
    await store.put(C.logs, {
      id: 'LOG-OLD-0001',
      date: at(now, 400).toISOString(),
      event: 'login_success',
      subject: 'pseudonymized',
    });
    await store.put(C.stockAlerts, {
      id: 'ALERT-OLD-0001',
      userId: 'standard_user',
      productId: 9,
      date: at(now, 400).toISOString(),
      notified: false,
    });
  }
}
