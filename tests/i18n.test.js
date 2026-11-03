import test from 'node:test';
import assert from 'node:assert/strict';
import {localize, translatableStrings, translator, translateMessage, progress, exportCsv, importCsv, parseCsv, detectDelimiter, decodeCsv, ensureI18n, i18nConfig} from '../src/i18n.js';

globalThis.document = {querySelector: () => null};
globalThis.CSS = {escape: value => value};
globalThis.window = {matchMedia: () => ({matches: false})};
const {screenMarkup, switcherMarkup} = await import('../src/player.js');

const form = () => ({
  name: 'Demo', footer: 'gesto.', welcome: {id: 'w', title: 'Hola', description: 'Bienvenido', button: 'Empezar ya'},
  questions: [
    {id: 'q1', type: 'choice', title: '¿Qué prefieres?', description: '', required: true, options: [{id: 'a', label: 'Mar'}, {id: 'b', label: 'Montaña'}]},
    {id: 'q2', type: 'short', title: 'Tu nombre', required: false}
  ],
  results: [{id: 'r', title: 'Gracias', description: 'Hecho', showScore: false}]
});
const withEu = () => {
  const doc = form(), i18n = ensureI18n(doc);
  i18n.languages.push({code: 'eu', name: 'Euskera', short: 'EU'});
  i18n.translations.eu = {'w.title': 'Kaixo', 'q1.title': 'Zer nahiago duzu?', 'q1.option.a': 'Itsasoa', 'r.description': '   '};
  return doc;
};

test('a form without i18n keeps working in Spanish', () => {
  const doc = form();
  assert.equal(localize(doc, 'es'), doc);
  assert.equal(localize(doc, 'eu'), doc);
  assert.equal(translator(doc, 'es')('continue'), 'Continuar');
  assert.equal(switcherMarkup(doc, 'es'), '');
});

test('localize replaces translated texts and falls back to the main language', () => {
  const doc = withEu(), eu = localize(doc, 'eu');
  assert.equal(eu.welcome.title, 'Kaixo');
  assert.equal(eu.welcome.description, 'Bienvenido');
  assert.equal(eu.questions[0].title, 'Zer nahiago duzu?');
  assert.deepEqual(eu.questions[0].options.map(o => [o.id, o.label]), [['a', 'Itsasoa'], ['b', 'Montaña']]);
  assert.equal(eu.results[0].description, 'Hecho', 'blank translation falls back');
  assert.equal(doc.welcome.title, 'Hola', 'the source document is not modified');
  assert.equal(localize(doc, 'es'), doc);
});

test('interface texts: custom, built-in, English fallback', () => {
  const doc = withEu();
  assert.equal(translator(doc, 'eu')('continue'), 'Jarraitu');
  doc.i18n.translations.eu['ui.continue'] = 'Aurrera';
  assert.equal(translator(doc, 'eu')('continue'), 'Aurrera');
  assert.equal(translator(doc, 'de')('continue'), 'Continue');
  assert.equal(translateMessage(translator(doc, 'eu'), 'Selecciona una opción.'), 'Hautatu aukera bat.');
  assert.equal(translateMessage(translator(doc, 'eu'), 'Otro mensaje'), 'Otro mensaje');
});

test('progress counts content texts only', () => {
  const doc = withEu(), keys = translatableStrings(doc).filter(s => !s.ui).map(s => s.key);
  assert.ok(keys.includes('q1.option.b') && keys.includes('footer') && !keys.includes('q1.description'));
  assert.deepEqual(progress(doc, 'eu'), {done: 3, total: keys.length});
});

test('the switcher honours position and label', () => {
  const doc = withEu();
  assert.equal(switcherMarkup(doc, 'es'), '');
  doc.i18n.switcher = {enabled: true, position: 'bottom-center', label: 'short'};
  const html = switcherMarkup(doc, 'eu');
  assert.match(html, /is-bottom is-center/);
  assert.match(html, />ES<\/button>/);
  assert.match(html, /data-lang="eu"[^>]*aria-pressed="true"[^>]*>EU</);
  doc.i18n.switcher.label = 'full';
  assert.match(switcherMarkup(doc, 'es'), />Español<\/button>.*>Euskera<\/button>/);
  const top = screenMarkup(Object.assign(doc, {}), doc.welcome, {welcome: true});
  assert.ok(top.indexOf('lang-switcher') > top.indexOf('screen-bg'));
  doc.i18n.switcher.position = 'top-left';
  const markup = screenMarkup(doc, doc.welcome, {welcome: true, lang: 'es'});
  assert.ok(markup.indexOf('lang-switcher') < markup.indexOf('screen-content'));
});

test('screens use the interface language', () => {
  const doc = withEu(), eu = localize(doc, 'eu');
  const html = screenMarkup(eu, eu.questions[1], {index: 1, lang: 'eu'});
  assert.match(html, /Idatzi hemen zure erantzuna…/);
  assert.match(html, /Urratsa 2/);
  assert.match(html, /Jarraitu/);
});

test('CSV parsing handles quotes, line breaks, BOM and both delimiters', () => {
  const text = '﻿key;es;eu\r\nw.title;"Hola; ""mundo""";"Kaixo\nmunduko"\r\nx;y;\r\n';
  assert.equal(detectDelimiter(text), ';');
  assert.deepEqual(parseCsv(text, ';'), [['key', 'es', 'eu'], ['w.title', 'Hola; "mundo"', 'Kaixo\nmunduko'], ['x', 'y', '']]);
  assert.equal(detectDelimiter('key,es,eu\n'), ',');
});

test('CSV export and import round-trip', () => {
  const doc = withEu(), csv = exportCsv(doc, 'eu');
  assert.ok(csv.startsWith('﻿key;es;eu'));
  const other = withEu(); other.i18n.translations.eu = {};
  const result = importCsv(other, 'eu', csv);
  assert.equal(result.ignored, 0);
  assert.equal(other.i18n.translations.eu['w.title'], 'Kaixo');
  assert.equal(other.i18n.translations.eu['q1.option.a'], 'Itsasoa');
  assert.equal(other.i18n.translations.eu['q1.title'], 'Zer nahiago duzu?');
});

test('CSV import ignores unknown keys and empty cells, and picks the language column', () => {
  const doc = withEu();
  const result = importCsv(doc, 'eu', 'key,es,eu\nw.title,Hola,Aupa\nq2.title,Tu nombre,\nnada.title,x,y\n');
  assert.deepEqual(result, {imported: 1, ignored: 1});
  assert.equal(doc.i18n.translations.eu['w.title'], 'Aupa');
  assert.equal(doc.i18n.translations.eu['q2.title'], undefined);
  assert.throws(() => importCsv(doc, 'eu', 'key\nw.title'), /dos columnas/);
  const fresh = form();
  ensureI18n(fresh).languages.push({code: 'ca', name: 'Català', short: 'CA'});
  importCsv(fresh, 'ca', 'key;es;ca\nw.title;Hola;Hola!');
  assert.equal(i18nConfig(fresh).translations.ca['w.title'], 'Hola!');
});

test('CSV files saved by Excel in ANSI are decoded', () => {
  const ansi = Uint8Array.from([0x6b, 0x3b, 0x61, 0xf1, 0x6f]);
  assert.equal(decodeCsv(ansi.buffer), 'k;año');
  assert.equal(decodeCsv(new TextEncoder().encode('k;año').buffer), 'k;año');
});

const {Player} = await import('../src/player.js');
function mount(doc, options) {
  const container = {style: {}, className: '', innerHTML: '', addEventListener() {}, classList: {add() {}, remove() {}}, querySelector: () => ({focus() {}, setAttribute() {}, classList: {add() {}}, dataset: {}})};
  return {container, player: new Player(container, doc, options)};
}

test('changing language keeps the journey, answers and result; submit reports the language', async () => {
  const doc = withEu(); doc.i18n.translations.eu['r.title'] = 'Eskerrik asko';
  const seen = [], sent = [];
  const {container, player} = mount(doc, {lang: 'eu', onLanguage: code => seen.push(code), submit: async (id, answers, lang) => { sent.push([answers, lang]); return {id, total: 0, result: doc.results[0]}; }});
  assert.equal(player.lang, 'eu');
  assert.match(container.innerHTML, /Kaixo/);
  player.next();
  player.journey.set('a');
  player.setLanguage('es');
  assert.deepEqual(seen, ['es']);
  assert.match(container.innerHTML, /¿Qué prefieres\?/);
  assert.equal(player.journey.answers.q1, 'a');
  player.setLanguage('eu');
  player.journey.next();
  player.journey.set('Ane');
  await player.next();
  assert.deepEqual(sent, [[{q1: 'a', q2: 'Ane'}, 'eu']]);
  assert.match(container.innerHTML, /Eskerrik asko/);
  assert.match(container.innerHTML, /Zure erantzunak gorde dira/);
  player.destroy();
});

test('an unknown language falls back to the main one and validation messages are translated', () => {
  const {container, player} = mount(withEu(), {lang: 'xx'});
  assert.equal(player.lang, 'es');
  player.setLanguage('eu');
  player.next(); player.journey.start();
  player.next();
  assert.match(player.error, /Erantzun galdera honi/);
  assert.match(container.innerHTML, /Erantzun galdera honi/);
  player.destroy();
});
