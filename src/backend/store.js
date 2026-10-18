/** Serializes async sections (one transaction at a time). */
export class Mutex {
  tail = Promise.resolve();
  run(work) {
    const result = this.tail.then(work, work);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

/**
 * In-memory store with copy-on-read semantics and transactional rollback.
 * `persist` receives the committed changes (used by the IndexedDB adapter).
 */
export class MemoryDocumentStore {
  data = new Map();
  mutex = new Mutex();
  pending = null;
  persist;
  constructor(options = {}) {
    this.persist = options.persist ?? null;
  }
  /** Loads raw documents without recording changes (used at start-up). */
  load(collection, docs) {
    const table = this.table(collection);
    for (const doc of docs) table.set(doc.id, doc.json);
  }
  table(collection) {
    let table = this.data.get(collection);
    if (!table) {
      table = new Map();
      this.data.set(collection, table);
    }
    return table;
  }
  record(change) {
    if (this.pending) {
      this.pending.push(change);
      return Promise.resolve();
    }
    return this.persist ? this.persist([change]) : Promise.resolve();
  }
  get(collection, id) {
    const json = this.data.get(collection)?.get(id);
    return Promise.resolve(json === undefined ? null : JSON.parse(json));
  }
  list(collection) {
    const table = this.data.get(collection);
    return Promise.resolve(table ? [...table.values()].map((json) => JSON.parse(json)) : []);
  }
  async put(collection, doc) {
    const json = JSON.stringify(doc);
    const id = String(doc.id);
    this.table(collection).set(id, json);
    await this.record({ kind: 'put', collection, id, json });
    return doc;
  }
  delete(collection, id) {
    this.data.get(collection)?.delete(id);
    return this.record({ kind: 'delete', collection, id });
  }
  clear() {
    this.data = new Map();
    return this.record({ kind: 'clear' });
  }
  transaction(work) {
    return this.mutex.run(async () => {
      const snapshot = new Map([...this.data].map(([name, table]) => [name, new Map(table)]));
      this.pending = [];
      try {
        const result = await work();
        const changes = this.pending;
        this.pending = null;
        if (this.persist && changes.length) await this.persist(changes);
        return result;
      } catch (error) {
        this.data = snapshot;
        this.pending = null;
        throw error;
      }
    });
  }
}
