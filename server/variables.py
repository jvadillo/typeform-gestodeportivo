"""Named variables, exact decimal arithmetic and legacy score compatibility."""
import json
import math
import re
from fractions import Fraction

OPERATIONS = {'add', 'subtract', 'multiply', 'divide'}
COMPARATORS = {'gt', 'lt', 'eq', 'gte', 'lte', 'neq'}
IDENTIFIER = re.compile(r'^[A-Za-z0-9_-]{1,80}$')


def definitions(doc):
    return doc.get('variables', [{'id': 'score', 'name': 'Puntuación', 'initial': 0}])


def result_variable(doc):
    return doc.get('resultVariable', 'score')


def calculations(owner):
    return owner.get('calculations', [{'variable': 'score', 'operation': 'add', 'value': owner['points']}] if owner.get('points') else [])


def conditions(rule):
    return rule.get('conditions', [{'variable': rule.get('variable', 'score'), 'operator': rule.get('operator'), 'value': rule.get('value')}])


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and abs(value) <= 1e12


def variable_errors(doc):
    variables = definitions(doc)
    if not isinstance(variables, list) or not 1 <= len(variables) <= 20:
        return ['Define entre 1 y 20 variables en el formulario.']
    errors, ids, names = [], set(), set()
    for variable in variables:
        if not isinstance(variable, dict):
            errors.append('Variable inválida.')
            continue
        vid, name = variable.get('id'), variable.get('name')
        if not isinstance(vid, str) or not IDENTIFIER.fullmatch(vid) or vid in ids or vid in {'__proto__', 'constructor', 'prototype'}:
            errors.append('Cada variable necesita un identificador único válido.')
        else:
            ids.add(vid)
        if not isinstance(name, str) or not name.strip() or len(name) > 80 or re.search(r'[\x00-\x1f]', name):
            errors.append('Cada variable necesita un nombre de 1 a 80 caracteres.')
        elif name.strip().lower() in names:
            errors.append('Los nombres de las variables no pueden repetirse.')
        else:
            names.add(name.strip().lower())
        if not finite(variable.get('initial', 0)):
            errors.append('El valor inicial de cada variable debe ser un número entre −10¹² y 10¹².')
    if not isinstance(result_variable(doc), str) or result_variable(doc) not in ids:
        errors.append('Elige una variable existente para los resultados.')
    return errors


def calculation_errors(owner, variable_ids, kind):
    items = calculations(owner)
    if not isinstance(items, list) or len(items) > 50:
        return ['Cada respuesta admite una lista de hasta 50 cálculos.']
    errors = []
    for calc in items:
        if not isinstance(calc, dict):
            errors.append('Cálculo inválido.')
            continue
        if not isinstance(calc.get('variable'), str) or calc['variable'] not in variable_ids:
            errors.append('Un cálculo usa una variable eliminada o inválida.')
        if not isinstance(calc.get('operation'), str) or calc['operation'] not in OPERATIONS:
            errors.append('Operación inválida. Elige sumar, restar, multiplicar o dividir.')
        source = calc.get('source', 'constant')
        if source == 'answer':
            if kind != 'number':
                errors.append('Solo una pregunta numérica puede usar su respuesta como valor del cálculo.')
        elif source != 'constant' or not finite(calc.get('value')):
            errors.append('El valor del cálculo debe ser un número entre −10¹² y 10¹².')
        elif calc.get('operation') == 'divide' and calc['value'] == 0:
            errors.append('No se puede dividir una variable entre cero.')
    return errors


def condition_errors(rule, variable_ids):
    items = conditions(rule)
    if not isinstance(items, list) or not 1 <= len(items) <= 20:
        return ['Cada regla necesita entre 1 y 20 condiciones.']
    errors = []
    if rule.get('match', 'all') not in ('all', 'any'):
        errors.append('Elige si deben cumplirse todas o cualquiera de las condiciones.')
    for condition in items:
        if not isinstance(condition, dict):
            errors.append('Condición inválida.')
            continue
        if not isinstance(condition.get('variable'), str) or condition['variable'] not in variable_ids:
            errors.append('Una condición usa una variable eliminada o inválida.')
        if not isinstance(condition.get('operator'), str) or condition['operator'] not in COMPARATORS:
            errors.append('El comparador de la regla de puntuación no es válido.')
        if not finite(condition.get('value')):
            errors.append('El valor de la regla de puntuación debe ser un número finito entre −10¹² y 10¹².')
    return errors


def initial_values(doc):
    return {v['id']: Fraction(str(v.get('initial', 0))) for v in definitions(doc)}


def apply_calculations(state, owner, answer):
    for calc in calculations(owner):
        vid = calc['variable']
        value = Fraction(str(answer if calc.get('source') == 'answer' else calc['value']))
        current = state[vid]
        if calc['operation'] == 'add':
            current += value
        elif calc['operation'] == 'subtract':
            current -= value
        elif calc['operation'] == 'multiply':
            current *= value
        elif calc['operation'] == 'divide':
            if not value:
                raise ValueError('No se puede dividir una variable entre cero. Cambia la respuesta o revisa el cálculo.')
            current /= value
        else:
            raise ValueError('Operación de cálculo inválida.')
        if abs(current) > 10**14:
            raise ValueError('El valor de una variable supera el límite de ±10¹⁴. Revisa los cálculos.')
        if current.numerator.bit_length() > 16384 or current.denominator.bit_length() > 16384:
            raise ValueError('El cálculo supera la precisión admitida. Simplifica las operaciones.')
        state[vid] = current


def matches_rule(rule, state):
    matches = []
    for condition in conditions(rule):
        current, value = state[condition['variable']], Fraction(str(condition['value']))
        matches.append({'gt': current > value, 'lt': current < value, 'eq': current == value,
                        'gte': current >= value, 'lte': current <= value, 'neq': current != value}[condition['operator']])
    return any(matches) if rule.get('match') == 'any' else all(matches)


def snapshots(doc, state):
    return [{'id': v['id'], 'name': v['name'], 'value': float(state[v['id']])} for v in definitions(doc)]


def stored_variables(submission):
    raw = dict(submission).get('variable_values') or '[]'
    return json.loads(raw) or [{'id': 'score', 'name': 'Puntuación', 'value': submission['total']}]
