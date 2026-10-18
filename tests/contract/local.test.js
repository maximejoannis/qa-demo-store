import { createApi } from '../../src/backend/index.js';
import { directClient, makeDeps } from '../backend/harness.js';
import { paritySuite } from './suite.js';

paritySuite('in-process back-end', () => {
  const deps = makeDeps();
  const api = createApi(deps);
  return Promise.resolve(() => directClient(deps, api));
});
