import { afterAll } from 'vitest';
import { httpClient, startServer } from '../server/http-client.js';
import { paritySuite } from './suite.js';

let running;
afterAll(() => running?.close());

paritySuite('Node HTTP API', async () => {
  running = await startServer();
  return () => httpClient(running.base);
});
