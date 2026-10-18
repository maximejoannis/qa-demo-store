import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiOrigin =
    env.VITE_API_MODE === 'server'
      ? new URL(env.VITE_API_URL || 'http://localhost:3000').origin
      : '';
  return {
    base: '/qa-demo-store/',
    server: { port: 5173 },
    plugins: [
      {
        name: 'qads-csp',
        // Strict CSP in the build; the dev server injects inline styles and uses a WebSocket.
        transformIndexHtml: (html) => {
          const strict = html.replace(' __QADS_API_ORIGIN__', apiOrigin ? ` ${apiOrigin}` : '');
          return command === 'serve'
            ? strict
                .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
                .replace("connect-src 'self'", "connect-src 'self' ws: wss:")
            : strict;
        },
      },
    ],
  };
});
