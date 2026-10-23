export const root = document.querySelector('#root');
export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
export const uid = () => crypto.randomUUID();
const paths = {
  plus: '<path d="M12 5v14M5 12h14"/>', arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', back: '<path d="m15 18-6-6 6-6"/>', down: '<path d="m6 9 6 6 6-6"/>', up: '<path d="m6 15 6-6 6 6"/>', check: '<path d="m5 12 4 4L19 6"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>', edit: '<path d="m16 3 5 5-12 12H4v-5L16 3Z"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>', trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>', link: '<path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2-2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 2)"/>', grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>', chart: '<path d="M5 20V10m7 10V4m7 16v-7"/>', logout: '<path d="M9 4H4v16h5m-1-8h13m-5-5 5 5-5 5"/>', flower: '<path d="M12 12C-2 9 9-2 12 12c3-14 14-3 0 0 14 3 3 14 0 0-3 14-14 3 0 0Z"/>', settings: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>', download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>', play: '<path d="m8 4 12 8-12 8V4Z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>', desktop: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4M7 21h10"/>', branch: '<path d="M6 3v18M6 9h8a4 4 0 0 0 4-4V3M6 15h8a4 4 0 0 1 4 4v2"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>', file: '<path d="M5 2h9l5 5v15H5V2Zm9 0v6h5M8 12h8m-8 4h6"/>'
};
export const icon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
export const brand = () => `<a class="brand" href="/admin">${icon('flower')}<span>gesto<span class="brand-dot">.</span></span></a>`;
export const button = (action, text, symbol, cls = '', extra = '') => `<button type="button" data-action="${action}" class="btn ${cls}" ${extra}>${symbol ? icon(symbol) : ''}${text ? `<span>${text}</span>` : ''}</button>`;
export const iconButton = (action, label, symbol, extra = '') => button(action, '', symbol, 'icon-btn', `title="${esc(label)}" aria-label="${esc(label)}" ${extra}`);
export const field = (label, input, hint = '') => `<label class="field"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ''}</label>`;
export const input = (attr, value, type = 'text', extra = '') => `<input type="${type}" ${attr} value="${esc(value)}" ${extra}/>`;
export const area = (attr, value, extra = '') => `<textarea ${attr} ${extra}>${esc(value)}</textarea>`;
export const select = (attr, value, options) => `<select ${attr}>${options.map(([v, text]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>`;
export const toggle = (attr, checked, label) => `<label class="toggle"><input type="checkbox" ${attr} ${checked ? 'checked' : ''}/><span>${label}</span></label>`;
export async function api(path, options = {}) {
  const {body, ...rest} = options;
  const response = await fetch('/api' + path, { credentials: 'same-origin', ...rest, ...(body instanceof FormData ? {body} : body !== undefined ? {body: JSON.stringify(body), headers: {'Content-Type': 'application/json'}} : {}) });
  if (!response.ok) {
    let message;
    try { const error = await response.json(); message = Array.isArray(error.detail) ? error.detail.join('\n') : error.detail; } catch { message = 'No se pudo completar la petición.'; }
    throw new Error(message || 'Se produjo un error.');
  }
  return response.json();
}
export function toast(message, error = false) {
  document.querySelector('.toast')?.remove();
  const node = document.createElement('div'); node.className = `toast ${error ? 'is-error' : ''}`; node.setAttribute('role', error ? 'alert' : 'status'); node.textContent = message; document.body.append(node);
  setTimeout(() => node.remove(), error ? 9000 : 4000);
}
export function modal(title, content, wide = false) {
  document.querySelector('dialog')?.close(); document.querySelector('dialog')?.remove();
  const dialog = document.createElement('dialog'); dialog.className = wide ? 'wide-dialog' : '';
  dialog.innerHTML = `<header class="dialog-header"><h2>${esc(title)}</h2><button class="btn icon-btn" type="button" aria-label="Cerrar">${icon('close')}</button></header>${content}`;
  dialog.querySelector('header button').onclick = () => dialog.close();
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', e => {if (e.target === dialog) dialog.close();});
  document.body.append(dialog); dialog.showModal(); return dialog;
}
export async function confirmDelete(title, detail) {
  return new Promise(resolve => {
    const dialog = modal(title, `<p class="dialog-text">${esc(detail)}</p><div class="dialog-actions">${button('cancel', 'Cancelar', null)}${button('confirm', 'Eliminar', 'trash', 'danger')}</div>`);
    let done = false;
    dialog.querySelector('[data-action="confirm"]').onclick = () => {done = true; resolve(true); dialog.close();};
    dialog.querySelector('[data-action="cancel"]').onclick = () => dialog.close();
    dialog.addEventListener('close', () => {if (!done) resolve(false);});
  });
}
export function formatDate(value) { return new Intl.DateTimeFormat('es-ES', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid'}).format(new Date(value)); }
