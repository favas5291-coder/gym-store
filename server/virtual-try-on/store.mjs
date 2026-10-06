// Local single-process storage. Do not use this store across serverless instances.
export function memoryStore(now = () => Date.now()) {
  const entries = new Map();
  function clean() {
    for (const [key, entry] of entries)
      if (entry.expires <= now()) entries.delete(key);
  }
  return {
    get(key) {
      clean();
      return entries.get(key)?.value;
    },
    set(key, value, ttl = 30 * 60 * 1000) {
      clean();
      entries.set(key, { value, expires: now() + ttl });
      return value;
    },
    delete(key) {
      entries.delete(key);
    },
    increment(key, ttl) {
      const value = (this.get(key) || 0) + 1;
      const expires = entries.get(key)?.expires ?? now() + ttl;
      entries.set(key, { value, expires });
      return value;
    },
  };
}
