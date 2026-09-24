const PREFIX = 'qads:';
export function createStorage(backend) {
  return {
    get(key, fallback = null) {
      try {
        const raw = backend.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        backend.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      backend.removeItem(PREFIX + key);
    },
    reset() {
      const keys = [];
      for (let i = 0; i < backend.length; i++) {
        const k = backend.key(i);
        if (k.startsWith(PREFIX)) keys.push(k);
      }
      keys.forEach((k) => backend.removeItem(k));
    },
  };
}
export function createMemoryBackend() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i],
    get length() {
      return m.size;
    },
  };
}
