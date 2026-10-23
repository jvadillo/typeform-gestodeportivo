import {Journey, resolveStyle, titleSizes, score, resolveResult} from './flow.js';
import {esc, icon, uid} from './ui.js';
export function styleVars(doc, screen) {
  const s = resolveStyle(doc, screen);
  const fonts = {sans: "'Segoe UI', sans-serif", serif: "Georgia, serif", mono: "'Courier New', monospace"};
  return `--screen-bg:${s.background};--screen-text:${s.text};--screen-title-text:${s.titleText};--screen-option-text:${s.optionText};--title-scale:${titleSizes[s.titleSize]?.[1] ?? 1};--screen-button:${s.button};--screen-button-text:${s.buttonText};--screen-option:${s.option};--screen-image:${s.image ? `url('${s.image}')` : 'none'};--screen-position:${s.x}% ${s.y}%;--screen-overlay:${s.overlay};--screen-opacity:${s.image ? s.opacity : 0};--screen-font:${fonts[s.font] || fonts.sans}`;
}
export function answerMarkup(q, value, disabled = false) {
  const off = disabled ? 'disabled' : '';
  if (q.type === 'choice') return `<div class="choices" role="radiogroup" aria-label="${esc(q.title)}">${q.options.map((o, i) => `<button type="button" class="choice ${value === o.id ? 'selected' : ''}" role="radio" aria-checked="${value === o.id}" data-option="${esc(o.id)}" ${off}><span class="key">${i < 26 ? String.fromCharCode(65+i) : i+1}</span><span>${esc(o.label)}</span>${value === o.id ? icon('check') : ''}</button>`).join('')}</div>`;
  const common = `id="participant-answer" aria-label="${esc(q.title)}" aria-describedby="answer-error" ${off} autocomplete="${q.type === 'email' ? 'email' : 'off'}"`;
  return q.type === 'long' ? `<textarea ${common} placeholder="Escribe tu respuesta aquí…" maxlength="10000">${esc(value)}</textarea><small class="answer-hint">Enter para una nueva línea · Ctrl + Enter para continuar</small>` : `<input ${common} type="${q.type === 'number' ? 'number' : q.type === 'email' ? 'email' : 'text'}" ${q.type === 'number' ? 'step="any"' : 'maxlength="1000"'} value="${esc(value)}" placeholder="${q.type === 'email' ? 'nombre@ejemplo.com' : q.type === 'number' ? 'Escribe un número…' : 'Escribe tu respuesta aquí…'}"/>`;
}
// Forms saved before the footer became configurable keep the original text.
export const footerText = doc => doc.footer ?? 'gesto.';
export function screenMarkup(doc, screen, {value, result = false, welcome = false, index = 0, total, error = '', busy = false, preview = false} = {}) {
  return `<div class="screen-bg" aria-hidden="true"></div><div class="screen-content">${welcome ? '' : `<div class="screen-eyebrow">${result ? `${icon('check')} TU PRÓXIMO PASO` : `<span>${String(index + 1).padStart(2, '0')}</span> ${icon('arrow')} ${screen.required ? 'OBLIGATORIA' : 'OPCIONAL'}`}</div>`}<h1 tabindex="-1">${esc(screen.title)}</h1>${screen.description ? `<p class="screen-description">${esc(screen.description)}</p>` : ''}${result ? `${screen.showScore ? `<div class="score"><strong>${esc(total ?? 0)}</strong><span>puntos · tu resultado</span></div>` : ''}<p class="completion">${icon('check')} ${preview ? 'Vista previa completada · no se ha registrado ningún envío' : 'Tus respuestas se han guardado. Gracias por compartirlas.'}</p>` : welcome ? `<button class="screen-button" data-next>${esc(screen.button || 'Empezar')} ${icon('arrow')}</button><p class="screen-hint">A tu ritmo. Una pregunta cada vez.</p>` : `${answerMarkup(screen, value)}<div class="answer-error" id="answer-error" role="alert">${esc(error)}</div><div class="screen-actions"><button class="screen-button" data-next ${busy ? 'disabled' : ''}>${busy ? 'Guardando…' : 'Continuar'} ${icon(busy ? 'clock' : 'arrow')}</button><span class="screen-hint">${screen.type === 'long' ? 'Ctrl + Enter ↵' : 'pulsa Enter ↵'}</span></div>`}</div><footer class="screen-footer"><span class="participant-brand">${esc(footerText(doc))}</span>${!welcome && !result ? `<span class="step-indicator">Paso ${index + 1}</span><button class="screen-back" data-back aria-label="Volver a la pantalla anterior" ${busy ? 'disabled' : ''}>${icon('up')}</button>` : '<span>Hecho para escucharte</span>'}</footer>`;
}
export class Player {
  constructor(container, doc, {submit, preview = false} = {}) {
    this.container = container; this.doc = doc; this.submit = submit; this.preview = preview; this.journey = new Journey(doc); this.id = uid(); this.error = ''; this.busy = false; this.finished = null;
    this.abort = new AbortController(); const signal = this.abort.signal;
    container.addEventListener('click', e => this.click(e), {signal});
    container.addEventListener('input', e => this.input(e), {signal});
    container.addEventListener('keydown', e => this.key(e), {signal});
    this.render();
  }
  cancelAdvance() {
    clearTimeout(this.advanceTimer);
    this.advanceTimer = null;
    this.container.classList.remove('is-leaving');
  }
  destroy() { this.cancelAdvance(); this.abort.abort(); }
  render(focus = false, selection = false) {
    const welcome = this.journey.cursor < 0, screen = this.finished?.result || (welcome ? this.doc.welcome : this.journey.current);
    this.container.className = `participant ${this.preview ? 'is-preview' : ''}`;
    this.container.style.cssText = styleVars(this.doc, screen);
    this.container.innerHTML = screenMarkup(this.doc, screen, {welcome, result: !!this.finished, total: this.finished?.total, value: this.journey.answers[screen.id], index: this.journey.cursor, error: this.error, busy: this.busy, preview: this.preview});
    if (selection) this.container.querySelector('.screen-content').classList.add('choice-feedback');
    if (focus) this.container.querySelector('h1').focus({preventScroll: true});
  }
  selectChoice(id, advance = true) {
    if (this.busy || this.finished || this.abort.signal.aborted) return;
    this.cancelAdvance();
    this.journey.set(id); this.error = ''; this.render(false, true);
    this.container.querySelector(`[data-option="${CSS.escape(id)}"]`)?.focus({preventScroll: true});
    if (!advance) return;
    const questionId = this.journey.current.id;
    const stillCurrent = () => !this.abort.signal.aborted && this.journey.current?.id === questionId;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.advanceTimer = setTimeout(() => {
      if (!stillCurrent()) return;
      if (!reduced) this.container.classList.add('is-leaving');
      this.advanceTimer = setTimeout(() => {
        if (stillCurrent()) this.next();
      }, reduced ? 0 : 160);
    }, 300);
  }
  input(e) {
    if (e.target.id !== 'participant-answer' || this.busy) return;
    const value = e.target.value;
    this.journey.set(this.journey.current.type === 'number' ? e.target.validity.badInput ? NaN : value === '' ? null : Number(value) : value);
    this.error = ''; this.container.querySelector('#answer-error').textContent = '';
  }
  click(e) {
    if (this.busy || this.finished || e.detail > 1) return;
    const choice = e.target.closest('[data-option]');
    if (choice) {this.selectChoice(choice.dataset.option); return;}
    if (e.target.closest('[data-next]')) this.next();
    if (e.target.closest('[data-back]')) {this.cancelAdvance(); this.journey.back(); this.error = ''; this.render(true);}
  }
  key(e) {
    if (this.busy || this.finished || e.repeat) return;
    const q = this.journey.current;
    if (e.key === 'Enter' && (e.target.tagName !== 'BUTTON' || e.target.closest('[data-option]')) && (q?.type !== 'long' || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const choice = e.target.closest('[data-option]');
      if (choice) this.selectChoice(choice.dataset.option); else this.next();
      return;
    }
    if (q?.type === 'choice' && /^[a-z]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const option = q.options[e.key.toUpperCase().charCodeAt(0) - 65];
      if (option) { e.preventDefault(); this.selectChoice(option.id); }
    }
    if (q?.type === 'choice' && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault(); const selected = q.options.findIndex(o => o.id === this.journey.answers[q.id]);
      const idx = (selected + (['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : -1) + q.options.length) % q.options.length;
      // Arrow keys allow exploration; Enter/Space confirms without a timed focus jump.
      this.selectChoice(q.options[idx].id, false);
    }
  }
  async next() {
    this.cancelAdvance();
    if (this.busy || this.finished || this.abort.signal.aborted) return;
    if (this.journey.cursor < 0) { this.journey.start(); this.render(true); return; }
    try {
      if (this.journey.next()) {this.error = ''; this.render(true); return;}
      this.busy = true; this.render();
      const answers = this.journey.activeAnswers();
      if (this.submit) this.finished = await this.submit(this.id, answers);
      else {const total = score(this.doc, answers); const result = resolveResult(this.doc, total); if (!result) throw new Error('No hay un resultado para esta puntuación. Revisa los intervalos.'); this.finished = {total, result};}
      this.error = '';
    } catch (error) { this.error = error.message; }
    this.busy = false; this.render(true);
    if (this.error) this.container.querySelector('#participant-answer')?.setAttribute('aria-invalid', 'true');
  }
}
