/**
 * Generates public/openapi.json (published with the site) from the route table of
 * src/backend and the JSON Schemas exposed by the validators. Run by `npm run build` and `npm run docs`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ROUTES } from '../src/backend/api.js';
import * as schemas from '../src/backend/schemas.js';

const PROBLEM = {
  type: 'object',
  required: ['type', 'title', 'status', 'code'],
  properties: {
    type: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'integer' },
    code: { type: 'string' },
    detail: { type: 'string' },
    errors: { type: 'array', items: { type: 'object' } },
  },
};

export function buildOpenApi() {
  const paths = {};
  for (const route of ROUTES) {
    const path = `/api/v1${route.path.replace(/:(\w+)/g, '{$1}')}`;
    const pathParameters = [...route.path.matchAll(/:(\w+)/g)].map((match) => ({
      name: match[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
    const request = route.request ? schemas[route.request]?.json : undefined;
    const asQuery = route.method === 'GET' && request;
    const parameters = [
      ...pathParameters,
      ...(asQuery
        ? Object.entries(request.properties ?? {}).map(([name, schema]) => ({
            name,
            in: 'query',
            required: false,
            schema,
          }))
        : []),
      ...(route.method === 'POST' && route.path === '/orders'
        ? [{ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } }]
        : []),
    ];
    paths[path] ??= {};
    paths[path][route.method.toLowerCase()] = {
      tags: [route.tag ?? 'system'],
      summary: route.summary ?? '',
      ...(route.auth === 'public' ? { security: [] } : {}),
      ...(route.auth === 'admin' ? { 'x-role': 'admin' } : {}),
      ...(route.demoOnly ? { 'x-demo-only': true } : {}),
      ...(parameters.length ? { parameters } : {}),
      ...(request && !asQuery
        ? { requestBody: { required: true, content: { 'application/json': { schema: request } } } }
        : {}),
      responses: {
        [String(route.status ?? 200)]: { description: route.response ?? 'Success' },
        default: {
          description: 'Erreur (problème RFC 9457)',
          content: { 'application/problem+json': { schema: PROBLEM } },
        },
      },
    };
  }
  return {
    openapi: '3.0.3',
    info: {
      title: 'QA Demo Store API',
      version: '2.0.0',
      description:
        "API d'entraînement QA (données fictives). Les mêmes routes sont servies dans la page (GitHub Pages, localStorage) et par l'API Node optionnelle (npm run server).",
    },
    servers: [{ url: 'http://localhost:3000', description: 'API Node locale (npm run server)' }],
    components: {
      securitySchemes: {
        cookieSession: { type: 'apiKey', in: 'cookie', name: 'qads_session' },
      },
    },
    security: [{ cookieSession: [] }],
    paths,
  };
}

const target = resolve(process.cwd(), 'public/openapi.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(buildOpenApi(), null, 2)}\n`);
console.log(`OpenAPI : ${String(ROUTES.length)} opérations écrites dans public/openapi.json`);
