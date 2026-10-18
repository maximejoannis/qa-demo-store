/**
 * Tiny hand-written validation library (no dependency). A rule is a function
 * `(value, path, issues) => output`; when it records an issue the output is ignored.
 * Every schema exposes `safeParse(value)` and `json` (JSON Schema, used for OpenAPI).
 */

const INVALID = Symbol('invalid');

/** @typedef {{ path: (string | number)[], message: string }} Issue */

/**
 * @param {(value: unknown, path: (string|number)[], issues: Issue[]) => unknown} check
 * @param {Record<string, unknown>} json
 */
function rule(check, json) {
  const schema = (value, path, issues) => check(value, path, issues);
  schema.json = json;
  schema.safeParse = (value) => {
    /** @type {Issue[]} */
    const issues = [];
    const data = check(value, [], issues);
    return issues.length ? { success: false, error: { issues } } : { success: true, data };
  };
  return schema;
}

const issue = (issues, path, message) => {
  issues.push({ path, message });
  return INVALID;
};

/** Wraps a rule so that `undefined` (or `null` when nullable) is accepted. */
function optionalize(check, json, options) {
  const schema = rule((value, path, issues) => {
    if (value === undefined) return options.default;
    if (value === null && options.nullable) return null;
    return check(value, path, issues);
  }, json);
  schema.isOptional = true;
  return schema;
}

/**
 * @param {{ min?: number, max?: number, pattern?: RegExp, trim?: boolean, case?: 'lower' | 'upper',
 *   email?: boolean, optional?: boolean, nullable?: boolean, default?: string, message?: string }} [options]
 */
export function string(options = {}) {
  const { min = 0, max = 10_000, trim = true } = options;
  const check = (value, path, issues) => {
    if (typeof value !== 'string') return issue(issues, path, 'Expected a string');
    let text = trim ? value.trim() : value;
    if (options.case === 'lower') text = text.toLowerCase();
    if (options.case === 'upper') text = text.toUpperCase();
    if (text.length < min) return issue(issues, path, `Too short (min ${String(min)})`);
    if (text.length > max) return issue(issues, path, `Too long (max ${String(max)})`);
    if (options.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
      return issue(issues, path, 'Invalid email');
    if (options.pattern && !options.pattern.test(text))
      return issue(issues, path, options.message ?? 'Invalid format');
    return text;
  };
  const json = {
    type: 'string',
    minLength: min,
    maxLength: max,
    ...(options.pattern ? { pattern: options.pattern.source } : {}),
    ...(options.email ? { format: 'email' } : {}),
  };
  return options.optional || options.nullable || options.default !== undefined
    ? optionalize(check, json, options)
    : rule(check, json);
}

/**
 * @param {{ min?: number, max?: number, integer?: boolean, coerce?: boolean, optional?: boolean, default?: number }} [options]
 */
export function number(options = {}) {
  const { min = -Infinity, max = Infinity, integer = true } = options;
  const check = (value, path, issues) => {
    const candidate =
      options.coerce && typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (typeof candidate !== 'number' || !Number.isFinite(candidate))
      return issue(issues, path, 'Expected a number');
    if (integer && !Number.isInteger(candidate)) return issue(issues, path, 'Expected an integer');
    if (candidate < min) return issue(issues, path, `Too small (min ${String(min)})`);
    if (candidate > max) return issue(issues, path, `Too big (max ${String(max)})`);
    return candidate;
  };
  const json = {
    type: integer ? 'integer' : 'number',
    ...(Number.isFinite(min) ? { minimum: min } : {}),
    ...(Number.isFinite(max) ? { maximum: max } : {}),
  };
  return options.optional || options.default !== undefined
    ? optionalize(check, json, options)
    : rule(check, json);
}

/** @param {{ optional?: boolean, default?: boolean }} [options] */
export function boolean(options = {}) {
  const check = (value, path, issues) =>
    typeof value === 'boolean' ? value : issue(issues, path, 'Expected a boolean');
  return options.optional || options.default !== undefined
    ? optionalize(check, { type: 'boolean' }, options)
    : rule(check, { type: 'boolean' });
}

/**
 * @param {readonly (string | number | boolean)[]} values
 * @param {{ default?: string | number, optional?: boolean }} [options]
 */
export function oneOf(values, options = {}) {
  const check = (value, path, issues) =>
    values.includes(value) ? value : issue(issues, path, `Expected one of: ${values.join(', ')}`);
  const json = { enum: [...values] };
  return options.optional || options.default !== undefined
    ? optionalize(check, json, options)
    : rule(check, json);
}

/** Query-string boolean: "true" / "false". */
export function queryBoolean() {
  const schema = rule(
    (value, path, issues) => {
      if (value === undefined) return false;
      if (value === 'true' || value === 'false') return value === 'true';
      return issue(issues, path, 'Expected true or false');
    },
    { type: 'string', enum: ['true', 'false'] },
  );
  schema.isOptional = true;
  return schema;
}

/** ISO calendar date YYYY-MM-DD. */
export function isoDate() {
  return string({ pattern: /^\d{4}-\d{2}-\d{2}$/, message: 'Expected a date YYYY-MM-DD' });
}

/** ISO 8601 date-time with an explicit offset (Z or ±hh:mm). */
export function isoDateTime() {
  return rule(
    (value, path, issues) => {
      if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value) ||
        Number.isNaN(new Date(value).getTime())
      ) {
        return issue(issues, path, 'Expected an ISO 8601 date-time with offset');
      }
      return value;
    },
    { type: 'string', format: 'date-time' },
  );
}

/**
 * @param {ReturnType<typeof rule>} item
 * @param {{ min?: number, max?: number }} [options]
 */
export function array(item, options = {}) {
  const { min = 0, max = 1000 } = options;
  return rule(
    (value, path, issues) => {
      if (!Array.isArray(value)) return issue(issues, path, 'Expected an array');
      if (value.length < min) return issue(issues, path, `Too few items (min ${String(min)})`);
      if (value.length > max) return issue(issues, path, `Too many items (max ${String(max)})`);
      return value.map((entry, index) => item(entry, [...path, index], issues));
    },
    { type: 'array', items: item.json, minItems: min, maxItems: max },
  );
}

/**
 * Strict object: unknown fields are refused (a client cannot send a price, for example).
 * @param {Record<string, ReturnType<typeof rule>>} shape
 * @param {{ refine?: (data: Record<string, any>, issue: (path: string, message: string) => void) => void }} [options]
 */
export function object(shape, options = {}) {
  const required = Object.entries(shape)
    .filter(([, schema]) => !schema.isOptional)
    .map(([key]) => key);
  return rule(
    (value, path, issues) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value))
        return issue(issues, path, 'Expected an object');
      const before = issues.length;
      for (const key of Object.keys(value)) {
        if (!(key in shape)) issue(issues, [...path, key], 'Unknown field');
      }
      const data = {};
      for (const [key, schema] of Object.entries(shape)) {
        const parsed = schema(value[key], [...path, key], issues);
        if (parsed !== undefined) data[key] = parsed;
      }
      if (issues.length === before && options.refine) {
        options.refine(data, (field, message) => issue(issues, [...path, field], message));
      }
      return data;
    },
    {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(shape).map(([key, schema]) => [key, schema.json]),
      ),
      additionalProperties: false,
      required,
    },
  );
}
