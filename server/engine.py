"""Authoritative form validation and route/score evaluation, independent of HTTP."""
import math
import re

TYPES = {'choice', 'short', 'long', 'number', 'email'}
IDENTIFIER = re.compile(r'^[A-Za-z0-9_-]{1,80}$')


class FormError(ValueError):
    pass


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and abs(value) <= 1e12


def style_errors(style):
    if not isinstance(style, dict):
        return ['La apariencia debe ser un objeto.']
    errors = []
    for key in ['background', 'text', 'titleText', 'optionText', 'button', 'buttonText', 'option', 'overlay']:
        if key in style and not re.fullmatch(r'#[0-9a-fA-F]{6}', str(style[key])):
            errors.append(f'Color inválido: {key}.')
    for key, maximum in [('opacity', 1), ('x', 100), ('y', 100)]:
        if key in style and (not finite(style[key]) or not 0 <= style[key] <= maximum):
            errors.append(f'Valor de apariencia inválido: {key}.')
    if style.get('image') and not re.fullmatch(r'/uploads/[a-f0-9-]+\.webp', style['image']):
        errors.append('La imagen debe subirse desde el editor.')
    if style.get('font', 'sans') not in ['sans', 'serif', 'mono']:
        errors.append('Tipografía inválida.')
    if style.get('titleSize', 'large') not in ['small', 'medium', 'large', 'xlarge', 'huge']:
        errors.append('Tamaño del título inválido. Elige uno de los cinco tamaños disponibles.')
    return errors


def validate_document(doc):
    errors = []
    if not isinstance(doc, dict):
        return ['Documento inválido.']
    questions, results = doc.get('questions', []), doc.get('results', [])
    if not isinstance(questions, list) or not isinstance(results, list):
        return ['Preguntas y resultados deben ser listas.']
    if not 1 <= len(questions) <= 100 or not 1 <= len(results) <= 20:
        return ['Añade entre 1 y 100 preguntas y entre 1 y 20 resultados.']
    screens = [doc.get('welcome', {})] + questions + results
    ids = set()
    errors.extend(style_errors(doc.get('style', {})))
    if not isinstance(doc.get('footer', ''), str) or len(doc.get('footer', '')) > 100:
        errors.append('El texto del pie debe tener como máximo 100 caracteres.')
    for screen in screens:
        if not isinstance(screen, dict):
            return ['Pantalla inválida.']
        sid = screen.get('id', '')
        if not isinstance(sid, str) or not IDENTIFIER.fullmatch(sid) or sid in ids:
            errors.append('Cada pantalla necesita un identificador único válido.')
        ids.add(str(sid))
        if not isinstance(screen.get('title'), str) or not screen['title'].strip() or len(screen['title']) > 500:
            errors.append('Todas las pantallas necesitan un título (máximo 500 caracteres).')
        if not isinstance(screen.get('description', ''), str) or len(screen.get('description', '')) > 10000:
            errors.append('Descripción demasiado larga o inválida.')
        errors.extend(style_errors(screen.get('style', {})))
    qids = {q.get('id') for q in questions}
    for q in questions:
        if q.get('type') not in TYPES:
            errors.append(f'Tipo de pregunta inválido: {q.get("title")}.')
        if not isinstance(q.get('required', False), bool):
            errors.append('La obligatoriedad debe ser verdadera o falsa.')
        targets = [q.get('next', 'next')]
        if q.get('type') == 'choice':
            options = q.get('options', [])
            if not isinstance(options, list) or not 1 <= len(options) <= 50:
                errors.append('Cada pregunta de selección necesita de 1 a 50 opciones.')
                continue
            option_ids = set()
            for opt in options:
                oid = opt.get('id', '')
                if not isinstance(oid, str) or not IDENTIFIER.fullmatch(oid) or oid in option_ids:
                    errors.append('Identificadores de opción inválidos o duplicados.')
                option_ids.add(str(oid))
                if not isinstance(opt.get('label'), str) or not opt['label'].strip() or len(opt['label']) > 1000:
                    errors.append('Cada opción necesita una etiqueta (máximo 1000 caracteres).')
                if not finite(opt.get('points', 0)):
                    errors.append('Los puntos deben ser números finitos entre −10¹² y 10¹².')
                targets.append(opt.get('next') or q.get('next', 'next'))
        for target in targets:
            if target not in {'next', 'end'} | qids:
                errors.append(f'Destino eliminado o inválido en «{q.get("title")}».')
    if errors:
        return list(dict.fromkeys(errors))
    edges = {}
    for i, q in enumerate(questions):
        targets = [q.get('next', 'next')]
        if q['type'] == 'choice':
            targets += [o.get('next') or q.get('next', 'next') for o in q.get('options', [])]
        edges[q['id']] = {(questions[i+1]['id'] if i+1 < len(questions) else 'end') if t == 'next' else t for t in targets}
    visited, active = set(), set()

    def visit(qid):
        if qid == 'end' or qid in visited:
            return
        if qid in active:
            raise FormError('Hay un bucle en los saltos. Todos los recorridos deben terminar.')
        active.add(qid)
        for dest in edges[qid]:
            visit(dest)
        active.remove(qid)
        visited.add(qid)
    try:
        for qid in edges:
            visit(qid)
    except FormError as exc:
        errors.append(str(exc))
    defaults = [r for r in results if r.get('default')]
    if len(defaults) > 1:
        errors.append('Solo puede haber un resultado predeterminado.')
    intervals = []
    if len(results) > 1:
        for r in results:
            if r.get('default'):
                continue
            lo, hi = r.get('min'), r.get('max')
            if (lo is not None and not finite(lo)) or (hi is not None and not finite(hi)):
                errors.append('Los límites de puntuación deben ser números o estar vacíos.')
                continue
            lo, hi = (-math.inf if lo is None else lo), (math.inf if hi is None else hi)
            if lo >= hi:
                errors.append(f'Intervalo vacío o invertido en «{r["title"]}».')
            intervals.append((lo, hi))
        intervals.sort()
        if any(a[1] > b[0] for a, b in zip(intervals, intervals[1:])):
            errors.append('Los intervalos de resultados se solapan.')
        if not defaults and (not intervals or intervals[0][0] != -math.inf or intervals[-1][1] != math.inf or any(a[1] != b[0] for a, b in zip(intervals, intervals[1:]))):
            errors.append('Cubre toda la escala de puntuación o elige un resultado predeterminado.')
    return errors


def answer_value(q, value):
    if value is None or value == '':
        if q.get('required'):
            raise FormError(f'Responde «{q["title"]}» antes de continuar.')
        return None
    kind = q['type']
    if kind == 'choice':
        if value not in [o['id'] for o in q['options']]:
            raise FormError('Selecciona una opción válida.')
    elif kind == 'number':
        if not finite(value):
            raise FormError('Introduce un número válido entre −10¹² y 10¹².')
    else:
        if not isinstance(value, str) or len(value) > (10000 if kind == 'long' else 1000):
            raise FormError('La respuesta es demasiado larga o inválida.')
        if re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', value):
            raise FormError('La respuesta contiene caracteres de control no permitidos.')
        if not value.strip():
            if q.get('required'):
                raise FormError('Esta pregunta es obligatoria.')
            return None
        if kind == 'email' and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
            raise FormError('Introduce un correo electrónico válido.')
    return value


def evaluate(doc, answers):
    if not isinstance(answers, dict):
        raise FormError('Respuestas inválidas.')
    active, seen, total = [], set(), 0
    questions = doc['questions']
    by_id = {q['id']: i for i, q in enumerate(questions)}
    index = 0
    while index < len(questions):
        q = questions[index]
        if q['id'] in seen:
            raise FormError('El recorrido contiene un bucle.')
        seen.add(q['id'])
        value = answer_value(q, answers.get(q['id']))
        opt = next((o for o in q.get('options', []) if q['type'] == 'choice' and o['id'] == value), None)
        points = opt.get('points', 0) if opt else 0
        total += points
        active.append({'question_id': q['id'], 'title': q['title'], 'type': q['type'], 'value': value, 'label': opt['label'] if opt else value, 'points': points})
        target = (opt.get('next') if opt else None) or q.get('next', 'next')
        if target == 'end':
            break
        index = index + 1 if target == 'next' else by_id[target]
    # Reject stale branch answers rather than allowing tampered submissions to hide data.
    if set(answers) - seen:
        raise FormError('Hay respuestas de una rama que ya no forma parte del recorrido.')
    results = doc['results']
    result = results[0] if len(results) == 1 else next((r for r in results if not r.get('default') and (r.get('min') is None or total >= r['min']) and (r.get('max') is None or total < r['max'])), next((r for r in results if r.get('default')), None))
    if not result:
        raise FormError('No hay un resultado para esta puntuación.')
    return {'answers': active, 'total': total, 'result': result}
