import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/styles/main.css'), 'utf8');

function tokens(selector) {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [
      m[1] ?? '',
      (m[2] ?? '').toLowerCase(),
    ]),
  );
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

export const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((l1 ?? 0) + 0.05) / ((l2 ?? 0) + 0.05);
};

/** Foreground/background pairs actually used by the stylesheet. */
const PAIRS = [
  ['text-color', 'background'],
  ['text-color', 'section-bg'],
  ['light-text', 'background'],
  ['light-text-on-section', 'section-bg'],
  ['on-primary', 'primary-color'],
  ['on-primary', 'secondary-color'],
  ['primary-color', 'background'],
  ['primary-color', 'section-bg'],
  ['secondary-color', 'background'],
  ['error', 'background'],
  ['error', 'section-bg'],
  ['success', 'background'],
  ['success', 'section-bg'],
  ['warning', 'background'],
];

describe('DESIGN-01 mandated palette (instructions.txt)', () => {
  it('DESIGN-01 keeps the six imposed colours unchanged in light mode', () => {
    expect(tokens(':root')).toMatchObject({
      'primary-color': '#2563eb',
      'secondary-color': '#1e40af',
      'text-color': '#1f2937',
      'light-text': '#6b7280',
      background: '#ffffff',
      'section-bg': '#f3f4f6',
    });
  });
  it.each([':root', ":root[data-theme='dark']"])(
    'DESIGN-02 every used colour pair reaches WCAG AA 4.5:1 (%s)',
    (selector) => {
      const light = tokens(':root');
      const palette = { ...light, ...tokens(selector) };
      const failing = PAIRS.map(([fg, bg]) => [
        fg,
        bg,
        contrast(palette[fg] ?? '', palette[bg] ?? ''),
      ]).filter(([, , ratio]) => ratio < 4.5);
      expect(failing).toEqual([]);
    },
  );
  it('DESIGN-03 documents why light-text is not used on section-bg', () => {
    expect(contrast('#6b7280', '#f3f4f6')).toBeLessThan(4.5);
    expect(contrast('#4b5563', '#f3f4f6')).toBeGreaterThan(4.5);
  });
});
