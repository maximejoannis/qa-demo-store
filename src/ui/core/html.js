/** Escape-by-default HTML templating: every interpolation is escaped unless it is SafeHtml. */
export class SafeHtml {
  value;
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

const ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

export const escapeHtml = (value) => value.replace(/[&<>"'`]/g, (char) => ENTITIES[char] ?? char);

function serialize(value) {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(serialize).join('');
  if (value === null || value === undefined || value === false) return '';
  return escapeHtml(String(value));
}

export function html(strings, ...values) {
  let out = strings[0] ?? '';
  values.forEach((value, index) => {
    out += serialize(value) + (strings[index + 1] ?? '');
  });
  return new SafeHtml(out);
}

/** Optional attribute helper: renders ` name="value"` or nothing. */
export const attr = (name, value) =>
  value === null || value === undefined || value === false
    ? new SafeHtml('')
    : new SafeHtml(value === true ? ` ${name}` : ` ${name}="${escapeHtml(String(value))}"`);

/** The single place where markup reaches the DOM. Input is always escaped SafeHtml. */
export function mount(root, view) {
  // eslint-disable-next-line no-unsanitized/property -- SafeHtml is produced by the escaping `html` tag only
  root.innerHTML = view.value;
}
