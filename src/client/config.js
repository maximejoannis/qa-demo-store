/** Resolves how the page reaches the back-end from build-time variables. */
export function runtimeConfig(env) {
  const mode = env.VITE_API_MODE === 'server' ? 'server' : 'demo';
  const baseUrl =
    mode === 'server'
      ? `${env.VITE_API_URL ?? 'http://localhost:3000'}/api/v1`
      : `${env.BASE_URL}api/v1`;
  return { mode, basePath: env.BASE_URL, baseUrl };
}

/** Browser storage can throw (private mode, blocked cookies): degrade to no persistence. */
export function safeStorage(read) {
  try {
    return read();
  } catch {
    return null;
  }
}
