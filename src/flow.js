export const baseStyle = { background: '#e9f0e8', text: '#193d31', button: '#193d31', buttonText: '#ffffff', option: '#ffffff', optionOpacity: 1, overlay: '#000000', opacity: .25, image: '', x: 50, y: 50, font: 'sans' };
export const titleSizes = { xsmall: ['Muy pequeño', .45], small: ['Pequeño', .575], medium: ['Mediano', .7], large: ['Grande', .8], xlarge: ['Muy grande', .875], huge: ['Extra grande', .925] };
export const textSizes = { xsmall: ['Muy pequeño', .7], small: ['Pequeño', .8], medium: ['Mediano', .925], large: ['Grande', 1], xlarge: ['Muy grande', 1.1], huge: ['Extra grande', 1.2] };
export function resolveStyle(doc, screen = {}) {
  const style = {...baseStyle, ...doc.style, ...screen.style};
  // Older forms keep their original colors until these overrides are chosen.
  return {...style, titleText: style.titleText ?? style.text, optionText: style.optionText ?? style.text, titleSize: style.titleSize ?? 'large', textSize: style.textSize ?? 'medium'};
}
export const types = { choice: 'Selección única', short: 'Texto corto', long: 'Texto largo', number: 'Número', email: 'Correo electrónico', statement: 'Pantalla de texto' };
// A statement only shows a title, text and a button: it takes no answer and has no points.
export const isStatement = screen => screen?.type === 'statement';
export function validateAnswer(question, value) {
  if (isStatement(question)) return '';
  if (value === undefined || value === null || value === '' || (typeof value === 'string' && !value.trim())) return question.required ? 'Responde a esta pregunta antes de continuar.' : '';
  if (question.type === 'choice' && !question.options.some(o => o.id === value)) return 'Selecciona una opción.';
  if (question.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e12)) return 'Introduce un número válido entre −10¹² y 10¹².';
  if (question.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Introduce un correo electrónico válido.';
  if (typeof value === 'string' && value.length > (question.type === 'long' ? 10000 : 1000)) return 'La respuesta es demasiado larga.';
  if (typeof value === 'string' && /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) return 'La respuesta contiene caracteres de control no permitidos.';
  return '';
}
export function nextQuestion(doc, qid, value) {
  const index = doc.questions.findIndex(q => q.id === qid), q = doc.questions[index];
  const option = q.type === 'choice' ? q.options.find(o => o.id === value) : null;
  const target = option?.next || q.next || 'next';
  return target === 'end' ? null : target === 'next' ? doc.questions[index + 1]?.id || null : target;
}
export function score(doc, answers) {
  return doc.questions.reduce((sum, q) => sum + (q.type === 'choice' ? q.options.find(o => o.id === answers[q.id])?.points || 0 : 0), 0);
}
export function resolveResult(doc, total) {
  return doc.results.length === 1 ? doc.results[0] : doc.results.find(r => !r.default && (r.min == null || total >= r.min) && (r.max == null || total < r.max)) || doc.results.find(r => r.default);
}
export class Journey {
  constructor(doc) { this.doc = doc; this.answers = {}; this.history = []; this.cursor = -1; }
  get current() { return this.doc.questions.find(q => q.id === this.history[this.cursor]); }
  start() { if (!this.history.length) this.history = [this.doc.questions[0].id]; this.cursor = 0; }
  set(value) {
    const q = this.current;
    if (this.answers[q.id] !== value) {
      for (const id of this.history.slice(this.cursor + 1)) delete this.answers[id];
      this.history = this.history.slice(0, this.cursor + 1);
      this.answers[q.id] = value;
    }
  }
  back() { if (this.cursor >= 0) this.cursor--; }
  next() {
    const q = this.current, error = validateAnswer(q, this.answers[q.id]);
    if (error) throw new Error(error);
    const next = nextQuestion(this.doc, q.id, this.answers[q.id]);
    if (next === null) return false;
    if (this.history.slice(0, this.cursor + 1).includes(next)) throw new Error('El recorrido contiene un bucle. Revisa los saltos.');
    if (!this.doc.questions.some(q => q.id === next)) throw new Error('El destino de esta pregunta ya no existe.');
    if (this.history[this.cursor + 1] !== next) this.history = [...this.history.slice(0, this.cursor + 1), next];
    this.cursor++;
    return true;
  }
  activeAnswers() { return Object.fromEntries(this.history.slice(0, this.cursor + 1).filter(id => this.answers[id] !== undefined).map(id => [id, this.answers[id]])); }
}
