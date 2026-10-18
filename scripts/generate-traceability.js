/**
 * Builds docs/tracabilite.md: every rule identifier of docs/specs/regles-metier.md mapped to the
 * tests whose name contains it. With --check, exits 1 when a documented rule has no test.
 * Usage: npm run docs  |  npm run traceability:check
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = process.cwd();
const ID =
  /(?<![A-Z0-9-])((?:ENG|API|WEB|SEC|SRV|FAULT|PROP|PARITY|EX)-[A-Z0-9]+(?:-[0-9]{2})?)\b/g;

function testFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return testFiles(path);
    return path.endsWith('.test.js') ? [path] : [];
  });
}

const spec = readFileSync(resolve(root, 'docs/specs/regles-metier.md'), 'utf8');
const rules = new Map();
for (const line of spec.split('\n')) {
  const match = /^\|\s*`((?:ENG|API|WEB|SEC|FAULT)-(?:[A-Z0-9]+-)?[0-9]{2})`\s*\|\s*([^|]+)\|/.exec(
    line,
  );
  if (match) rules.set(match[1], match[2].trim());
}

const tests = new Map();
for (const file of testFiles(resolve(root, 'tests'))) {
  const content = readFileSync(file, 'utf8');
  for (const call of content.matchAll(/\b(?:it|test|describe)\(\s*['"`]([^'"`]+)['"`]/g)) {
    for (const id of call[1].matchAll(ID)) {
      if (!tests.has(id[1])) tests.set(id[1], new Set());
      tests.get(id[1]).add(relative(root, file).replaceAll('\\', '/'));
    }
  }
}

const missing = [...rules.keys()].filter((rule) => !tests.has(rule));
const rows = [...rules.entries()].map(([rule, label]) => {
  const where = [...(tests.get(rule) ?? [])];
  return `| \`${rule}\` | ${label} | ${where.length ? where.map((file) => `\`${file}\``).join('<br>') : '**aucun test**'} |`;
});
const markdown = `# Matrice de traçabilité règles → tests

> Générée par \`npm run docs\` à partir de \`docs/specs/regles-metier.md\` et des noms de tests. Ne pas modifier à la main.

${String(rules.size)} règles documentées, ${String(rules.size - missing.length)} couvertes par au moins un test.

| Règle | Énoncé | Tests |
| --- | --- | --- |
${rows.join('\n')}
`;

if (process.argv.includes('--check')) {
  if (missing.length) {
    console.error(`Règles sans test : ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(`Traçabilité OK : ${String(rules.size)} règles couvertes`);
} else {
  writeFileSync(resolve(root, 'docs/tracabilite.md'), markdown);
  console.log(`Traçabilité : ${String(rules.size)} règles, ${String(missing.length)} sans test`);
}
