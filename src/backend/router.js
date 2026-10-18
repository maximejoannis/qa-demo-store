import { toProblem, validationError } from './errors.js';

export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export function matchRoute(routes, method, path) {
  const segments = path.split('/').filter(Boolean);
  const allowed = [];
  for (const route of routes) {
    const pattern = route.path.split('/').filter(Boolean);
    if (pattern.length !== segments.length) continue;
    const params = {};
    const matches = pattern.every((part, index) => {
      const segment = segments[index] ?? '';
      if (part.startsWith(':')) {
        params[part.slice(1)] = decodeURIComponent(segment);
        return true;
      }
      return part === segment;
    });
    if (!matches) continue;
    if (route.method === method) return { route, params };
    allowed.push(route.method);
  }
  return allowed.length ? { allowed } : null;
}

export const ok = (body, status = 200) => ({ status, body });

/** Error response that keeps the transaction's side effects (e.g. failed-login counters). */
export function committedFailure(error) {
  const response = toProblem(error);
  return { status: response.status, body: response.body, headers: response.headers ?? {} };
}
