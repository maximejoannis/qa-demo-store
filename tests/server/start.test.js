import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main, readConfig } from '../../server/start.js';

describe('server start-up', () => {
  it('SRV-12 default configuration', () => {
    expect(readConfig({})).toEqual({
      port: 3000,
      dbFile: 'data/db.json',
      allowedOrigins: ['http://localhost:5173', 'http://localhost:4173'],
      demoMode: true,
    });
    expect(
      readConfig({ QADS_DEMO: '0', QADS_ALLOWED_ORIGINS: ' a , ,b', PORT: '4000' }),
    ).toMatchObject({
      port: 4000,
      allowedOrigins: ['a', 'b'],
      demoMode: false,
    });
  });

  it('SRV-13 main starts a working API on the requested port', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'qads-start-'));
    const lines = [];
    const server = await main({ PORT: '0', QADS_DB_FILE: join(dir, 'db.json') }, (line) =>
      lines.push(line),
    );
    try {
      const { port } = server.address();
      const health = await fetch(`http://127.0.0.1:${String(port)}/api/v1/health`);
      expect(health.status).toBe(200);
      expect(lines[0]).toContain(`:${String(port)}/api/v1/health`);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
