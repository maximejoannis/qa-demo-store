/**
 * Persistence of the optional Node API: the same document store as the browser,
 * mirrored in one JSON file (default data/db.json). Writes are atomic (tmp + rename).
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { MemoryDocumentStore } from '../src/backend/store.js';

/**
 * @param {string | null} file Path of the JSON file, or null for a memory-only store (tests).
 * @returns {MemoryDocumentStore}
 */
export function createFileStore(file) {
  /** @type {Record<string, Record<string, string>>} */
  let mirror = {};
  if (file) {
    try {
      mirror = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      mirror = {}; // Missing or corrupted file: start from the seed again.
    }
  }
  const store = new MemoryDocumentStore({
    persist: (changes) => {
      for (const change of changes) {
        if (change.kind === 'clear') mirror = {};
        else if (change.kind === 'delete') delete mirror[change.collection]?.[change.id];
        else (mirror[change.collection] ??= {})[change.id] = change.json;
      }
      if (file) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(`${file}.tmp`, JSON.stringify(mirror));
        renameSync(`${file}.tmp`, file);
      }
      return Promise.resolve();
    },
  });
  for (const [collection, docs] of Object.entries(mirror)) {
    store.load(
      collection,
      Object.entries(docs).map(([id, json]) => ({ id, json })),
    );
  }
  return store;
}
