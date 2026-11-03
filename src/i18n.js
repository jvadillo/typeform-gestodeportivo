// Multi-language support. Translations live inside the form document (doc.i18n), so they are versioned
// with every publication and answers keep being stored in the same tables, in the main language.
export const LANGUAGES = {
  es: ['Español', 'ES'], en: ['English', 'EN'], eu: ['Euskera', 'EU'], ca: ['Català', 'CA'], gl: ['Galego', 'GL'],
  fr: ['Français', 'FR'], de: ['Deutsch', 'DE'], it: ['Italiano', 'IT'], pt: ['Português', 'PT']
};
export const POSITIONS = {
  'top-left': 'Arriba a la izquierda', 'top-center': 'Arriba en el centro', 'top-right': 'Arriba a la derecha',
  'bottom-left': 'Abajo a la izquierda', 'bottom-center': 'Abajo en el centro', 'bottom-right': 'Abajo a la derecha'
};
export const LABELS = {full: 'Nombre completo (Español, Euskera…)', short: 'Abreviatura (ES, EU…)'};
export const CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/;
export const languageOf = code => ({code, name: LANGUAGES[code]?.[0] || code.toUpperCase(), short: LANGUAGES[code]?.[1] || code.toUpperCase()});

// Texts of the participant interface. Languages without an entry fall back to English.
export const UI = {
  continue: {es: 'Continuar', en: 'Continue', eu: 'Jarraitu', ca: 'Continua', gl: 'Continuar', fr: 'Continuer'},
  start: {es: 'Empezar', en: 'Start', eu: 'Hasi', ca: 'Comença', gl: 'Comezar', fr: 'Commencer'},
  welcomeHint: {es: 'A tu ritmo. Una pregunta cada vez.', en: 'At your own pace. One question at a time.', eu: 'Zure erritmoan. Galdera bat aldiz.', ca: 'Al teu ritme. Una pregunta cada vegada.', gl: 'Ao teu ritmo. Unha pregunta cada vez.', fr: 'À votre rythme. Une question à la fois.'},
  step: {es: 'Paso', en: 'Step', eu: 'Urratsa', ca: 'Pas', gl: 'Paso', fr: 'Étape'},
  back: {es: 'Volver a la pantalla anterior', en: 'Back to the previous screen', eu: 'Itzuli aurreko pantailara', ca: 'Torna a la pantalla anterior', gl: 'Volver á pantalla anterior', fr: 'Retour à l’écran précédent'},
  saving: {es: 'Guardando…', en: 'Saving…', eu: 'Gordetzen…', ca: 'Desant…', gl: 'Gardando…', fr: 'Enregistrement…'},
  placeholderText: {es: 'Escribe tu respuesta aquí…', en: 'Type your answer here…', eu: 'Idatzi hemen zure erantzuna…', ca: 'Escriu la teva resposta aquí…', gl: 'Escribe aquí a túa resposta…', fr: 'Écrivez votre réponse ici…'},
  placeholderNumber: {es: 'Escribe un número…', en: 'Type a number…', eu: 'Idatzi zenbaki bat…', ca: 'Escriu un número…', gl: 'Escribe un número…', fr: 'Saisissez un nombre…'},
  hintLong: {es: 'Enter para una nueva línea · Ctrl + Enter para continuar', en: 'Enter for a new line · Ctrl + Enter to continue', eu: 'Enter lerro berri baterako · Ctrl + Enter jarraitzeko', ca: 'Enter per a una línia nova · Ctrl + Enter per continuar', gl: 'Enter para unha nova liña · Ctrl + Enter para continuar', fr: 'Entrée pour une nouvelle ligne · Ctrl + Entrée pour continuer'},
  hintEnter: {es: 'pulsa Enter ↵', en: 'press Enter ↵', eu: 'sakatu Enter ↵', ca: 'prem Enter ↵', gl: 'preme Enter ↵', fr: 'appuyez sur Entrée ↵'},
  hintCtrl: {es: 'Ctrl + Enter ↵', en: 'Ctrl + Enter ↵', eu: 'Ctrl + Enter ↵', ca: 'Ctrl + Enter ↵', gl: 'Ctrl + Enter ↵', fr: 'Ctrl + Entrée ↵'},
  yourScore: {es: 'Tu puntuación:', en: 'Your score:', eu: 'Zure puntuazioa:', ca: 'La teva puntuació:', gl: 'A túa puntuación:', fr: 'Votre score :'},
  of: {es: 'de', en: 'of', eu: '/', ca: 'de', gl: 'de', fr: 'sur'},
  done: {es: 'Tus respuestas se han guardado. Gracias por compartirlas.', en: 'Your answers have been saved. Thank you for sharing them.', eu: 'Zure erantzunak gorde dira. Eskerrik asko partekatzeagatik.', ca: 'Les teves respostes s’han desat. Gràcies per compartir-les.', gl: 'As túas respostas gardáronse. Grazas por compartilas.', fr: 'Vos réponses ont été enregistrées. Merci de les avoir partagées.'},
  language: {es: 'Idioma', en: 'Language', eu: 'Hizkuntza', ca: 'Idioma', gl: 'Idioma', fr: 'Langue'},
  required: {es: 'Responde a esta pregunta antes de continuar.', en: 'Answer this question before continuing.', eu: 'Erantzun galdera honi jarraitu aurretik.', ca: 'Respon aquesta pregunta abans de continuar.', gl: 'Responde a esta pregunta antes de continuar.', fr: 'Répondez à cette question avant de continuer.'},
  chooseOption: {es: 'Selecciona una opción.', en: 'Select an option.', eu: 'Hautatu aukera bat.', ca: 'Selecciona una opció.', gl: 'Selecciona unha opción.', fr: 'Sélectionnez une option.'},
  invalidNumber: {es: 'Introduce un número válido entre −10¹² y 10¹².', en: 'Enter a valid number between −10¹² and 10¹².', eu: 'Sartu baliozko zenbaki bat −10¹² eta 10¹² artean.', ca: 'Introdueix un número vàlid entre −10¹² i 10¹².', gl: 'Introduce un número válido entre −10¹² e 10¹².', fr: 'Saisissez un nombre valide entre −10¹² et 10¹².'},
  invalidEmail: {es: 'Introduce un correo electrónico válido.', en: 'Enter a valid email address.', eu: 'Sartu baliozko posta elektroniko bat.', ca: 'Introdueix un correu electrònic vàlid.', gl: 'Introduce un correo electrónico válido.', fr: 'Saisissez une adresse e-mail valide.'},
  tooLong: {es: 'La respuesta es demasiado larga.', en: 'The answer is too long.', eu: 'Erantzuna luzeegia da.', ca: 'La resposta és massa llarga.', gl: 'A resposta é demasiado longa.', fr: 'La réponse est trop longue.'},
  controlChars: {es: 'La respuesta contiene caracteres de control no permitidos.', en: 'The answer contains control characters that are not allowed.', eu: 'Erantzunak baimenik gabeko kontrol-karaktereak ditu.', ca: 'La resposta conté caràcters de control no permesos.', gl: 'A resposta contén caracteres de control non permitidos.', fr: 'La réponse contient des caractères de contrôle non autorisés.'}
};
const errorIds = Object.fromEntries(Object.entries(UI).map(([id, texts]) => [texts.es, id]));

export function i18nConfig(doc) {
  const i = doc?.i18n || {};
  return {
    default: i.default || languageOf('es'), languages: i.languages || [], translations: i.translations || {},
    switcher: {enabled: false, position: 'top-right', label: 'full', ...i.switcher}
  };
}
export const allLanguages = doc => { const c = i18nConfig(doc); return [c.default, ...c.languages]; };
export const hasLanguages = doc => (doc?.i18n?.languages?.length || 0) > 0;
// Creates the structure on first use (editor only).
export function ensureI18n(doc) {
  const c = i18nConfig(doc);
  return doc.i18n = {...doc.i18n, default: c.default, languages: c.languages, translations: c.translations, switcher: c.switcher};
}

// Translator for the interface texts: custom text of the form, then built-in, then English, then Spanish.
export function translator(doc, lang) {
  const own = i18nConfig(doc).translations[lang] || {};
  const t = id => own['ui.' + id]?.trim() || UI[id]?.[lang] || UI[id]?.en || UI[id]?.es || id;
  t.lang = lang;
  return t;
}
// Validation and server messages are written in Spanish; translate the ones that have an id.
export const translateMessage = (t, message) => errorIds[message] ? t(errorIds[message]) : message;

const footerOf = doc => doc.footer ?? 'gesto.';
// Every text that can be translated, in screen order.
export function translatableStrings(doc) {
  const out = [], cfg = i18nConfig(doc);
  const add = (key, source, group, field, long = false) => { if (typeof source === 'string' && source.trim()) out.push({key, source, group, field, long}); };
  const screen = (s, group, button = true) => { add(`${s.id}.title`, s.title, group, 'Título'); add(`${s.id}.description`, s.description, group, 'Descripción', true); if (button) add(`${s.id}.button`, s.button, group, 'Botón'); };
  screen(doc.welcome, 'Bienvenida');
  doc.questions.forEach((q, i) => {
    const group = `${String(i + 1).padStart(2, '0')} · ${q.title || 'Sin título'}`;
    screen(q, group);
    (q.options || []).forEach((o, j) => add(`${q.id}.option.${o.id}`, o.label, group, `Opción ${String.fromCharCode(65 + j)}`));
  });
  doc.results.forEach(r => screen(r, `Resultado · ${r.title}`, false));
  add('footer', footerOf(doc), 'Pie de página', 'Texto del pie');
  if (doc.results.some(r => r.showScore)) {
    const id = doc.resultVariable ?? 'score', variable = (doc.variables ?? [{id: 'score', name: 'Puntuación'}]).find(v => v.id === id);
    if (variable && variable.name !== 'Puntuación') add(`variable.${id}`, variable.name, 'Resultado', 'Nombre de la variable');
  }
  for (const id of Object.keys(UI)) out.push({key: 'ui.' + id, source: UI[id][cfg.default.code] || UI[id].es, group: 'Textos de la interfaz', field: id, long: UI[id].es.length > 40, ui: true});
  return out;
}
export const contentStrings = doc => translatableStrings(doc).filter(s => !s.ui);
export function progress(doc, lang) {
  const own = i18nConfig(doc).translations[lang] || {}, strings = contentStrings(doc);
  return {done: strings.filter(s => own[s.key]?.trim()).length, total: strings.length};
}

// A copy of the document with the texts of one language. Ids, routes and calculations are untouched.
export function localize(doc, lang) {
  const cfg = i18nConfig(doc), own = cfg.translations[lang];
  if (!own || lang === cfg.default.code) return doc;
  const copy = structuredClone(doc), pick = (key, fallback) => own[key]?.trim() ? own[key] : fallback;
  const screen = s => { s.title = pick(`${s.id}.title`, s.title); if (s.description !== undefined) s.description = pick(`${s.id}.description`, s.description); if (s.button !== undefined) s.button = pick(`${s.id}.button`, s.button); };
  screen(copy.welcome);
  for (const q of copy.questions) { screen(q); for (const o of q.options || []) o.label = pick(`${q.id}.option.${o.id}`, o.label); }
  copy.results.forEach(screen);
  if (copy.footer !== undefined || own.footer?.trim()) copy.footer = pick('footer', footerOf(doc));
  for (const v of copy.variables || []) v.name = pick(`variable.${v.id}`, v.name);
  return copy;
}

export const languageUrl = (origin, key, code) => `${origin}/f/${key}/${code}`;

// ---- CSV ----
export function parseCsv(text, delimiter) {
  const rows = []; let row = [], cell = '', quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c;
    } else if (c === '"' && !cell) quoted = true;
    else if (c === delimiter) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; rows.push(row); row = []; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
// Excel in Spanish saves with «;», other tools with «,» or tabs: pick the most frequent one on the header line.
export function detectDelimiter(text) {
  const header = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0];
  return [';', ',', '\t'].map(d => [d, header.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
}
const quote = (value, delimiter) => /["\r\n]/.test(value) || value.includes(delimiter) ? `"${value.replaceAll('"', '""')}"` : value;
// UTF-8 with BOM and «;» so a double click opens it correctly in Spanish Excel.
export function exportCsv(doc, lang) {
  const cfg = i18nConfig(doc), own = cfg.translations[lang] || {}, delimiter = ';', t = translator(doc, lang);
  const rows = [['key', cfg.default.code, lang], ...translatableStrings(doc).map(s => [s.key, s.source, own[s.key] ?? (s.ui ? t(s.key.slice(3)) : '')])];
  return '﻿' + rows.map(r => r.map(c => quote(c, delimiter)).join(delimiter)).join('\r\n') + '\r\n';
}
// Returns the counts and writes valid, non-empty translations into doc.i18n.translations[lang].
export function importCsv(doc, lang, text) {
  const rows = parseCsv(text, detectDelimiter(text));
  if (rows.length < 2) throw new Error('El archivo no contiene filas de traducción.');
  const header = rows[0].map(h => h.trim().toLowerCase());
  const keyColumn = Math.max(0, header.indexOf('key')), column = header.indexOf(lang);
  const translation = column >= 0 && column !== keyColumn ? column : header.length - 1;
  if (translation === keyColumn || header.length < 2) throw new Error('El archivo necesita al menos dos columnas: «key» y la traducción.');
  const known = new Map(translatableStrings(doc).map(s => [s.key, s]));
  const target = ensureI18n(doc).translations[lang] ||= {};
  let imported = 0, ignored = 0;
  for (const row of rows.slice(1)) {
    const key = (row[keyColumn] || '').trim(), value = (row[translation] || '').replace(/\r\n?/g, '\n');
    if (!known.has(key)) { ignored++; continue; }
    if (!value.trim()) continue;
    if (value.length > 10000) throw new Error(`La traducción de «${key}» es demasiado larga.`);
    target[key] = value; imported++;
  }
  return {imported, ignored};
}
export function decodeCsv(buffer) {
  try { return new TextDecoder('utf-8', {fatal: true}).decode(buffer); } catch { return new TextDecoder('windows-1252').decode(buffer); }
}
