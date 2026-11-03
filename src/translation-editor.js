import {esc, field, input, select, toggle, button, icon, toast, modal, confirmDelete} from './ui.js';
import {Player} from './player.js';
import {LANGUAGES, POSITIONS, LABELS, CODE, languageOf, i18nConfig, ensureI18n, translatableStrings, progress, translator, languageUrl, exportCsv, importCsv, decodeCsv} from './i18n.js';

const download = (name, text) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], {type: 'text/csv;charset=utf-8'}));
  link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
const languageOptions = (exclude, custom = true) => [...Object.entries(LANGUAGES).filter(([code]) => !exclude.includes(code)).map(([code, [name]]) => [code, `${name} (${code})`]), ...(custom ? [['custom', 'Otro idioma…']] : [])];

export const translationEditor = {
  translationsMarkup() {
    const cfg = i18nConfig(this.doc), used = [cfg.default.code, ...cfg.languages.map(l => l.code)];
    if (!cfg.languages.some(l => l.code === this.trLang)) this.trLang = cfg.languages[0]?.code;
    return `<section class="integration-page translations-page"><span class="eyebrow">UN FORMULARIO, VARIOS IDIOMAS</span><h1>Traducciones</h1><p class="lead">Escribe el formulario en el idioma principal y añade el resto aquí. Las respuestas se guardan juntas, en el mismo formulario, y siempre con los textos del idioma principal.</p>
      <div class="integration-card translation-card"><h2>Idiomas</h2>
        ${field('Idioma principal', select('data-i18n="default"', cfg.default.code, languageOptions(used.filter(c => c !== cfg.default.code), false).concat(LANGUAGES[cfg.default.code] ? [] : [[cfg.default.code, `${cfg.default.name} (${cfg.default.code})`]])), 'Es el idioma en el que has escrito el formulario. Su enlace es /f/…/' + esc(cfg.default.code) + ' y también el enlace sin sufijo.')}
        <div class="language-chips">${cfg.languages.map(l => `<span class="chip">${esc(l.name)} <small>${esc(l.code)}</small></span>`).join('') || '<small class="field-hint">Todavía no hay traducciones.</small>'}</div>
        <div class="add-language">${field('Añadir un idioma', select('data-i18n="new-language"', this.newLanguage || '', [['', 'Elige un idioma…'], ...languageOptions(used)]))}${this.newLanguage === 'custom' ? `<div class="custom-language">${field('Código', input('data-i18n="custom-code"', '', 'text', 'maxlength="12" placeholder="por ejemplo, ast"'), 'Minúsculas: «ast», «pt-br»…')}${field('Nombre', input('data-i18n="custom-name"', '', 'text', 'maxlength="40"'))}${field('Abreviatura', input('data-i18n="custom-short"', '', 'text', 'maxlength="8"'))}</div>` : ''}${button('add-language', 'Añadir idioma', 'plus', 'primary', this.newLanguage ? '' : 'disabled')}</div>
      </div>
      <div class="integration-card translation-card"><h2>Selector de idioma</h2><p class="field-hint">Un pequeño selector en la pantalla para que cada persona cambie de idioma sin perder sus respuestas.</p>
        ${toggle('data-i18n="switcher-enabled"', cfg.switcher.enabled, 'Mostrar el selector de idioma')}
        ${cfg.switcher.enabled ? `${field('Posición', select('data-i18n="switcher-position"', cfg.switcher.position, Object.entries(POSITIONS)))}${field('Texto del selector', select('data-i18n="switcher-label"', cfg.switcher.label, Object.entries(LABELS)))}` : ''}
        ${cfg.switcher.enabled && !cfg.languages.length ? '<p class="notice">El selector aparecerá cuando añadas al menos un idioma.</p>' : ''}
      </div>
      ${cfg.languages.length ? this.translatorMarkup(cfg) : ''}</section>`;
  },
  translatorMarkup(cfg) {
    const lang = cfg.languages.find(l => l.code === this.trLang), own = cfg.translations[lang.code] || {}, t = translator(this.doc, lang.code);
    const done = progress(this.doc, lang.code), key = this.form.slug || this.form.id, url = languageUrl(location.origin, key, lang.code);
    const groups = []; for (const s of translatableStrings(this.doc)) {
      if (this.trPending && (s.ui || own[s.key]?.trim())) continue;
      let g = groups.at(-1); if (!g || g.name !== s.group) groups.push(g = {name: s.group, items: []}); g.items.push(s);
    }
    return `<div class="integration-card translation-card translator"><div class="language-tabs" role="tablist">${cfg.languages.map(l => `<button role="tab" aria-selected="${l.code === lang.code}" data-action="tr-lang" data-value="${esc(l.code)}" class="${l.code === lang.code ? 'active' : ''}">${esc(l.name)}</button>`).join('')}</div>
      <div class="translation-head"><div><h2>${esc(lang.name)}</h2><p class="field-hint tr-progress">${done.done} de ${done.total} textos traducidos${this.form.published ? '' : ' · el formulario aún no está publicado'}</p></div><div class="progress-bar" aria-hidden="true"><span style="width:${done.total ? Math.round(done.done / done.total * 100) : 0}%"></span></div></div>
      <div class="share-url">${input('readonly aria-label="Enlace de este idioma" id="lang-url"', url)}${button('copy-lang-url', 'Copiar', 'copy')}</div>
      <div class="language-fields">${field('Nombre en el selector', input(`data-i18n="lang-name" data-code="${esc(lang.code)}"`, lang.name, 'text', 'maxlength="40"'))}${field('Abreviatura', input(`data-i18n="lang-short" data-code="${esc(lang.code)}"`, lang.short, 'text', 'maxlength="8"'))}</div>
      <div class="inline-actions">${button('tr-preview', 'Probar este idioma', 'play')}${button('tr-export', 'Descargar CSV', 'download')}<label class="btn upload-csv">${icon('plus')}<span>Importar CSV</span><input type="file" accept=".csv,.txt,text/csv" data-i18n="import" data-code="${esc(lang.code)}" hidden/></label>${button('remove-language', 'Eliminar idioma', 'trash', 'danger', `data-value="${esc(lang.code)}"`)}</div>
      <p class="field-hint">El CSV tiene las columnas <code>key</code>, <code>${esc(cfg.default.code)}</code> (texto original) y <code>${esc(lang.code)}</code> (traducción). Rellena la última y súbelo: solo se importan las filas con texto y se reconocen por la clave. Admite separador «;» o «,».</p>
      <label class="toggle"><input type="checkbox" data-i18n="pending" ${this.trPending ? 'checked' : ''}/><span>Mostrar solo lo pendiente</span></label>
      <div class="translation-table">${groups.map(g => `<div class="translation-group"><h3>${esc(g.name)}</h3>${g.items.map(s => `<div class="translation-row"><div class="tr-source"><small>${esc(s.ui ? 'Interfaz · ' + s.field : s.field)}</small><p>${esc(s.source)}</p></div><textarea data-tr="${esc(s.key)}" data-code="${esc(lang.code)}" lang="${esc(lang.code)}" rows="${s.long || s.source.length > 60 ? 3 : 1}" maxlength="10000" aria-label="Traducción: ${esc(s.source.slice(0, 60))}" placeholder="${esc(s.ui ? t(s.key.slice(3)) : '')}">${esc(own[s.key] || '')}</textarea></div>`).join('')}</div>`).join('') || '<p class="notice">No queda nada pendiente. 🎉</p>'}</div></div>`;
  },
  updateTranslationProgress() {
    const node = document.querySelector('.tr-progress'); if (!node || !this.trLang) return;
    const done = progress(this.doc, this.trLang); node.textContent = `${done.done} de ${done.total} textos traducidos` + (this.form.published ? '' : ' · el formulario aún no está publicado');
    const bar = document.querySelector('.progress-bar span'); if (bar) bar.style.width = (done.total ? Math.round(done.done / done.total * 100) : 0) + '%';
  },
  onTranslationInput(target) {
    if (target.matches('[data-tr]')) {
      const texts = ensureI18n(this.doc).translations[target.dataset.code] ||= {};
      if (target.value.trim()) texts[target.dataset.tr] = target.value; else delete texts[target.dataset.tr];
      this.markDirty(); this.updateTranslationProgress(); return true;
    }
    if (target.matches('[data-i18n="lang-name"],[data-i18n="lang-short"]')) {
      const lang = ensureI18n(this.doc).languages.find(l => l.code === target.dataset.code);
      if (lang) { lang[target.dataset.i18n === 'lang-name' ? 'name' : 'short'] = target.value; this.markDirty(); }
      return true;
    }
    return target.matches('[data-i18n]');
  },
  async onTranslationChange(target) {
    if (!target.matches('[data-i18n]')) return false;
    const kind = target.dataset.i18n, cfg = ensureI18n(this.doc);
    if (kind === 'default') {
      if (cfg.languages.some(l => l.code === target.value)) { target.value = cfg.default.code; throw new Error('Ese idioma ya está añadido como traducción. Elimínalo antes de elegirlo como principal.'); }
      cfg.default = languageOf(target.value); this.markDirty();
    } else if (kind === 'new-language') this.newLanguage = target.value;
    else if (kind === 'switcher-enabled') { cfg.switcher.enabled = target.checked; this.markDirty(); }
    else if (kind === 'switcher-position') { cfg.switcher.position = target.value; this.markDirty(); }
    else if (kind === 'switcher-label') { cfg.switcher.label = target.value; this.markDirty(); }
    else if (kind === 'pending') this.trPending = target.checked;
    else if (kind === 'import') {
      const file = target.files[0]; target.value = '';
      if (!file) return true;
      if (file.size > 2_000_000) throw new Error('El archivo es demasiado grande.');
      const result = importCsv(this.doc, target.dataset.code, decodeCsv(await file.arrayBuffer()));
      this.markDirty(); toast(`${result.imported} traducciones importadas${result.ignored ? ` · ${result.ignored} filas ignoradas por no coincidir con ningún texto` : ''}`);
    }
    this.render(); return true;
  },
  async onTranslationAction(action, value, target) {
    if (!['tr-lang', 'add-language', 'remove-language', 'copy-lang-url', 'tr-export', 'tr-preview'].includes(action)) return false;
    const cfg = ensureI18n(this.doc);
    if (action === 'tr-lang') { this.trLang = value; this.render(); return true; }
    if (action === 'add-language') {
      let lang;
      if (this.newLanguage === 'custom') {
        const q = name => document.querySelector(`[data-i18n="${name}"]`).value.trim();
        lang = {code: q('custom-code').toLowerCase(), name: q('custom-name'), short: q('custom-short')};
        if (!CODE.test(lang.code)) throw new Error('El código debe ser de 2 o 3 letras minúsculas, por ejemplo «ast» o «pt-br».');
        if (!lang.name) throw new Error('Escribe el nombre del idioma.');
        lang.short ||= lang.code.toUpperCase();
      } else lang = languageOf(this.newLanguage);
      if (cfg.languages.length >= 12) throw new Error('El máximo es de 12 traducciones.');
      if ([cfg.default, ...cfg.languages].some(l => l.code === lang.code)) throw new Error('Ese idioma ya está en el formulario.');
      cfg.languages.push(lang); cfg.translations[lang.code] = {}; this.trLang = lang.code; this.newLanguage = ''; this.markDirty(); this.render(); return true;
    }
    if (action === 'remove-language') {
      const lang = cfg.languages.find(l => l.code === value);
      if (await confirmDelete('Eliminar idioma', `Se borrarán todas las traducciones de ${lang.name} y su enlace dejará de funcionar al publicar.`)) {
        cfg.languages = cfg.languages.filter(l => l.code !== value); delete cfg.translations[value]; this.trLang = undefined; this.markDirty(); this.render();
      }
      return true;
    }
    if (action === 'copy-lang-url') {
      const field = document.querySelector('#lang-url');
      try { await navigator.clipboard.writeText(field.value); toast('Enlace copiado'); } catch { field.select(); toast('Selecciona y copia el enlace.'); }
      return true;
    }
    if (action === 'tr-export') { download(`${(this.doc.name || 'formulario').replace(/[^\w-]+/g, '-')}-${this.trLang}.csv`, exportCsv(this.doc, this.trLang)); return true; }
    if (action === 'tr-preview') {
      await this.save();
      const dialog = modal('Vista previa · no se guardan respuestas', '<div id="preview-player"></div>', true);
      const player = new Player(dialog.querySelector('#preview-player'), structuredClone(this.doc), {preview: true, lang: this.trLang});
      dialog.addEventListener('close', () => player.destroy()); return true;
    }
    return false;
  }
};
