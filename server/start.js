/**
 * Starts the optional Node API: `npm run server` (port 3000, data in data/db.json).
 * Environment: PORT, QADS_DB_FILE, QADS_ALLOWED_ORIGINS (comma separated), QADS_DEMO=0, QADS_FAULTS=0.
 */
import { fileURLToPath } from 'node:url';
import { createQadsServer } from './app.js';
import { createFileStore } from './file-store.js';

/** @param {Record<string, string | undefined>} env */
export function readConfig(env) {
  return {
    port: Number(env.PORT ?? 3000),
    dbFile: env.QADS_DB_FILE ?? 'data/db.json',
    allowedOrigins: (env.QADS_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    demoMode: env.QADS_DEMO !== '0',
    faultsEnabled: env.QADS_FAULTS !== '0',
  };
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {(line: string) => void} [print]
 */
export async function main(env, print = console.log) {
  const config = readConfig(env);
  const server = await createQadsServer({
    store: createFileStore(config.dbFile),
    allowedOrigins: config.allowedOrigins,
    demoMode: config.demoMode,
    faultsEnabled: config.faultsEnabled,
  });
  await new Promise((resolve) => server.listen(config.port, '127.0.0.1', () => resolve(undefined)));
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  print(`QA Demo Store API: http://localhost:${String(port)}/api/v1/health`);
  print(`Origines autorisées : ${config.allowedOrigins.join(', ')}`);
  return server;
}

/* c8 ignore next 3 -- entry point when launched with `node server/start.js` */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main(process.env);
}
