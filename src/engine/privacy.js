import { DEFAULT_RULES } from './rules.js';
import { addDays, parisDate } from './time.js';

const addYears = (iso, years) =>
  `${String(Number(iso.slice(0, 4)) + years)}${iso.slice(4)}`.replace(/-02-29$/, '-02-28');

/**
 * ENG-PRIV-01: retention deadline and action per data category (values to be validated by a DPO).
 * account: anonymized 3 years after last activity; order/invoice: deleted after 10 years (L123-22);
 * consent proof: consent validity + 5 years; technical logs: 1 year; guest cart: 30 days;
 * stock alert: 1 year.
 * @param {string} category account, order, consentProof, technicalLog, guestCart or stockAlert.
 * @param {string} referenceDate IsoDate.
 * @param {typeof DEFAULT_RULES} [rules]
 * @returns {{ dueDate: string, action: "anonymize" | "delete" }}
 */
export function retentionDeadline(category, referenceDate, rules = DEFAULT_RULES) {
  const r = rules.retention;
  switch (category) {
    case 'account':
      return { dueDate: addDays(referenceDate, r.inactiveAccountDays), action: 'anonymize' };
    case 'order':
      return { dueDate: addYears(referenceDate, r.accountingYears), action: 'delete' };
    case 'consentProof':
      return {
        dueDate: addYears(addDays(referenceDate, r.consentValidityDays), r.consentProofExtraYears),
        action: 'delete',
      };
    case 'technicalLog':
      return { dueDate: addDays(referenceDate, r.technicalLogDays), action: 'delete' };
    case 'guestCart':
      return { dueDate: addDays(referenceDate, r.guestCartDays), action: 'delete' };
    case 'stockAlert':
      return { dueDate: addDays(referenceDate, r.stockAlertDays), action: 'delete' };
  }
}

/**
 * ENG-PRIV-02: a record is due when today (Paris) is on or after its deadline.
 * @param {{ category: string, id: string, referenceDate: string }[]} records
 * @param {Date} now
 * @param {typeof DEFAULT_RULES} [rules]
 */
export function retentionPlan(records, now, rules = DEFAULT_RULES) {
  const today = parisDate(now);
  return records.map((record) => {
    const { dueDate, action } = retentionDeadline(record.category, record.referenceDate, rules);
    return { ...record, dueDate, action, due: today >= dueDate };
  });
}

/**
 * ENG-PRIV-03: a stored consent choice must be asked again after its validity period.
 * @param {string} consentDate IsoDate.
 * @param {Date} now
 * @param {typeof DEFAULT_RULES} [rules]
 * @returns {boolean}
 */
export function consentExpired(consentDate, now, rules = DEFAULT_RULES) {
  return parisDate(now) >= addDays(consentDate, rules.retention.consentValidityDays);
}
