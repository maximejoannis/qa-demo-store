export const ENGINE_VERSION = '2.0.0';

/** Default business rules. Every rule has an identifier in docs/specs/regles-metier.md. */
export const DEFAULT_RULES = {
  version: '2026.10.1',
  defaultVatBp: 2000,
  vatBpByCategory: { Books: 550 },
  limits: { maxLines: 50, maxQtyPerLine: 20 },
  coupons: {
    WELCOME10: { code: 'WELCOME10', type: 'percent', value: 10, minimum: 0, expires: '2099-12-31' },
    SAVE20: { code: 'SAVE20', type: 'fixed', value: 2000, minimum: 10000, expires: '2099-12-31' },
    FREESHIP: { code: 'FREESHIP', type: 'shipping', value: 0, minimum: 0, expires: '2099-12-31' },
    OLD5: { code: 'OLD5', type: 'percent', value: 5, minimum: 0, expires: '2020-01-01' },
  },
  shipping: {
    methods: {
      standard: {
        zones: {
          FR: { base: 490, perExtraKg: 100, days: [3, 5] },
          EU: { base: 990, perExtraKg: 200, days: [5, 8] },
          WORLD: { base: 1990, perExtraKg: 400, days: [8, 15] },
        },
      },
      express: {
        zones: {
          FR: { base: 1290, perExtraKg: 200, days: [1, 2] },
          EU: { base: 2490, perExtraKg: 300, days: [2, 3] },
          WORLD: { base: 3990, perExtraKg: 600, days: [4, 6] },
        },
      },
      pickup: { zones: { FR: { base: 0, perExtraKg: 0, days: [0, 0] } } },
    },
    freeStandardThresholdFr: 5000,
    includedGrams: 1000,
    frCountries: ['FR', 'MC'],
    euCountries: [
      'AT',
      'BE',
      'BG',
      'HR',
      'CY',
      'CZ',
      'DK',
      'EE',
      'FI',
      'DE',
      'GR',
      'HU',
      'IE',
      'IT',
      'LV',
      'LT',
      'LU',
      'MT',
      'NL',
      'PL',
      'PT',
      'RO',
      'SK',
      'SI',
      'ES',
      'SE',
    ],
  },
  loyalty: {
    centsPerPoint: 100,
    tiers: [
      { tier: 'bronze', minPoints: 0, multiplierBp: 10000 },
      { tier: 'silver', minPoints: 500, multiplierBp: 12500 },
      { tier: 'gold', minPoints: 1500, multiplierBp: 15000 },
    ],
    windowDays: 365,
    redeemStep: 100,
    redeemValuePerStep: 500,
    maxRedeemShareBp: 3000,
  },
  installments: { counts: [3, 4], min: 10000, max: 200000 },
  returns: { withdrawalDays: 14 },
  inventory: { windowDays: 30, leadTimeDays: 7, safetyDays: 3, coverDays: 30, minimumOrder: 5 },
  retention: {
    inactiveAccountDays: 3 * 365,
    accountingYears: 10,
    consentValidityDays: 182,
    consentProofExtraYears: 5,
    technicalLogDays: 365,
    guestCartDays: 30,
    stockAlertDays: 365,
  },
  quoteTtlMinutes: 15,
};

export const vatBpFor = (category, rules = DEFAULT_RULES) =>
  rules.vatBpByCategory[category] ?? rules.defaultVatBp;
