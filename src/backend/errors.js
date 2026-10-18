import { isEngineError } from '../engine/index.js';

/** HTTP error rendered as application/problem+json (RFC 9457). */
export class ApiError extends Error {
  status;
  code;
  details;
  errors;
  constructor(status, code, title, extra = {}) {
    super(title);
    this.status = status;
    this.code = code;
    this.details = extra.details;
    this.errors = extra.errors;
  }
}

const ENGINE_STATUS = {
  OUT_OF_STOCK: 409,
  PRODUCT_UNAVAILABLE: 409,
  INVALID_TRANSITION: 409,
  UNKNOWN_COUPON: 422,
  COUPON_EXPIRED: 422,
  COUPON_MINIMUM_NOT_MET: 422,
  SHIPPING_NOT_AVAILABLE: 422,
  LOYALTY_INVALID_POINTS: 422,
  LOYALTY_INSUFFICIENT_BALANCE: 422,
  LOYALTY_REDEEM_TOO_HIGH: 422,
  INSTALLMENTS_INVALID_COUNT: 422,
  INSTALLMENTS_AMOUNT_OUT_OF_RANGE: 422,
  RETURN_INVALID_LINES: 422,
  RETURN_NOT_ALLOWED: 422,
};

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export function problem(status, code, title, extra = {}) {
  return {
    status,
    headers: { 'content-type': PROBLEM_CONTENT_TYPE },
    body: {
      type: `https://maximejoannis.github.io/qa-demo-store/problems/${code.toLowerCase()}`,
      title,
      status,
      code,
      ...(extra.details ? { details: extra.details } : {}),
      ...(extra.errors ? { errors: extra.errors } : {}),
    },
  };
}

export function validationError(error) {
  return new ApiError(400, 'VALIDATION_ERROR', 'The request is invalid', {
    errors: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  });
}

/** Maps any thrown value to a problem response; unknown errors never leak details. */
export function toProblem(error) {
  if (error instanceof ApiError) {
    return problem(error.status, error.code, error.message, {
      details: error.details,
      errors: error.errors,
    });
  }
  if (isEngineError(error)) {
    return problem(ENGINE_STATUS[error.code] ?? 400, error.code, error.message, {
      details: error.details,
    });
  }
  return problem(500, 'INTERNAL_ERROR', 'An unexpected error occurred. Please try again later.');
}
