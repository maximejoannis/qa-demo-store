/** Generates docs/qa/testids.md from src/ui/testids.js. Run: npm run docs */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TID, V1_TESTIDS } from '../src/ui/testids.js';

const v1 = new Set(V1_TESTIDS);
const rows = Object.entries(TID).map(([key, value]) => {
  const pattern = typeof value === 'function' ? value('{id}') : value;
  return `| \`${pattern}\` | \`TID.${key}\` | ${v1.has(pattern) ? 'v1' : 'v2'} |`;
});

const markdown = `# Contrat des \`data-testid\`

> Fichier généré par \`npm run docs\` à partir de \`src/ui/testids.js\`. Ne pas modifier à la main.

Convention : \`kebab-case\`, \`<zone>-<élément>[-<id>]\`. \`{id}\` désigne la partie dynamique (identifiant de produit, de commande, code…).
Les ${String(V1_TESTIDS.length)} identifiants de la v1 sont conservés à l'identique (colonne « Depuis »). Le test \`WEB-CONTRACT-01\` vérifie que chaque identifiant déclaré est réellement affiché par au moins une vue.

Pour attendre sans délai fixe :

- \`[data-testid="view"]\` porte \`data-view\` (nom de la vue), \`data-state\` (\`loading\`, \`ready\`, \`error\`, \`empty\`) et \`aria-busy\`.
- Les messages utilisent \`[data-testid="message"]\` avec \`role="status"\` (succès) ou \`role="alert"\` (erreur).

Exemple Playwright :

\`\`\`js
await page.goto('/qa-demo-store/?qa=1&seed=42&now=2026-10-12T10:00:00%2B02:00#/products');
await expect(page.getByTestId('view')).toHaveAttribute('data-state', 'ready');
await page.getByTestId('product-add-cart-3').click();
await expect(page.getByTestId('cart-badge')).toHaveText('1');
\`\`\`

| data-testid | Constante | Depuis |
| --- | --- | --- |
${rows.join('\n')}
`;

mkdirSync(resolve(process.cwd(), 'docs/qa'), { recursive: true });
writeFileSync(resolve(process.cwd(), 'docs/qa/testids.md'), markdown);
console.log(`testids : ${String(rows.length)} entrées écrites dans docs/qa/testids.md`);
