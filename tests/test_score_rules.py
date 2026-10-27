import copy
import json
import unittest
from pathlib import Path

from server.engine import FormError, evaluate, validate_document, SCORE_OPERATORS
from server.seed import blank_document


def rule_document():
    doc = blank_document('Reglas de puntuación')
    doc['questions'] = [
        {'id': 'first', 'title': 'Primera', 'type': 'choice', 'required': True, 'next': 'next',
         'options': [{'id': 'a', 'label': 'A', 'points': 2}, {'id': 'b', 'label': 'B', 'points': -2}]},
        {'id': 'second', 'title': 'Segunda', 'type': 'choice', 'required': True, 'next': 'end',
         'options': [{'id': 'yes', 'label': 'Sí', 'points': 4, 'next': 'end'}]},
        {'id': 'target', 'title': 'Destino', 'type': 'short', 'required': False, 'next': 'end'}]
    return doc


class ScoreRuleTests(unittest.TestCase):
    def test_decimal_sums_cancellation_and_exponential_notation(self):
        for points, total in [([.1, .2], .3), ([1e12, .1, -1e12], .1), ([1e-7, 2e-7], 3e-7), ([5e-324, 5e-324], 1e-323)]:
            with self.subTest(points=points):
                doc = rule_document()
                doc['questions'] = [
                    {'id': f'q{i}', 'title': str(i), 'type': 'choice', 'next': 'next',
                     'options': [{'id': 'a', 'label': 'A', 'points': p}]} for i, p in enumerate(points)]
                doc['questions'][-1]['scoreRules'] = [{'operator': 'eq', 'value': total, 'next': 'end'}]
                doc['questions'].append({'id': 'unwanted', 'title': 'No mostrar', 'type': 'short', 'required': True})
                self.assertEqual(validate_document(doc), [])
                self.assertEqual(evaluate(doc, {f'q{i}': 'a' for i in range(len(points))})['total'], total)

    def test_all_operators_share_browser_boundary_cases(self):
        cases = json.loads(Path(__file__).with_name('score_rule_cases.json').read_text(encoding='utf-8'))
        for case in cases:
            for operator in SCORE_OPERATORS:
                with self.subTest(case=case, operator=operator):
                    doc = rule_document()
                    first = doc['questions'][0]
                    first['next'] = 'end'
                    first['options'][0]['points'] = case['total']
                    first['scoreRules'] = [{'operator': operator, 'value': case['value'], 'next': 'target'}]
                    self.assertEqual(validate_document(doc), [])
                    result = evaluate(doc, {'first': 'a'})
                    self.assertEqual(result['total'], case['total'])
                    self.assertEqual('target' in [a['question_id'] for a in result['answers']], operator in case['matches'])

    def test_accumulated_score_includes_current_answer_and_first_rule_wins(self):
        doc = rule_document()
        doc['questions'][1]['scoreRules'] = [
            {'operator': 'gt', 'value': 5, 'next': 'target'},
            {'operator': 'gte', 'value': 6, 'next': 'end'}]
        result = evaluate(doc, {'first': 'a', 'second': 'yes', 'target': 'Hecho'})
        self.assertEqual(result['total'], 6)
        self.assertEqual(result['answers'][-1]['question_id'], 'target')
        # A supplied answer in a future screen cannot influence this decision.
        with self.assertRaises(FormError):
            evaluate(doc, {'first': 'b', 'second': 'yes', 'target': 'Rama abandonada'})

    def test_rules_work_on_every_content_type_and_optional_omissions(self):
        for kind in ['statement', 'short', 'long', 'email', 'number', 'choice']:
            with self.subTest(kind=kind):
                doc = rule_document()
                doc['questions'][1].update(type=kind, required=False, scoreRules=[{'operator': 'eq', 'value': 2, 'next': 'next'}])
                self.assertEqual(validate_document(doc), [])
                result = evaluate(doc, {'first': 'a', 'target': 'Destino'})
                self.assertEqual(result['total'], 2)
                self.assertEqual(result['answers'][-1]['question_id'], 'target')

    def test_end_rule_at_zero_and_backward_compatible_fallbacks(self):
        doc = rule_document()
        doc['questions'][0].update(type='statement', scoreRules=[{'operator': 'eq', 'value': 0, 'next': 'end'}])
        self.assertEqual(validate_document(doc), [])
        self.assertEqual(evaluate(doc, {})['total'], 0)
        doc = rule_document()
        doc['questions'][0]['scoreRules'] = [{'operator': 'gt', 'value': 100, 'next': 'target'}]
        self.assertEqual(evaluate(doc, {'first': 'a', 'second': 'yes'})['total'], 6)
        doc['questions'][0]['options'][0]['next'] = 'end'
        self.assertEqual(evaluate(doc, {'first': 'a'})['total'], 2)

    def test_invalid_rules_return_validation_errors(self):
        valid = {'operator': 'gt', 'value': 5, 'next': 'target'}
        malformed = [None, {}, 'bad', [None], [42], [{}], [valid] * 51]
        malformed += [[{**valid, 'operator': op}] for op in [None, 'unknown', [], True]]
        malformed += [[{**valid, 'value': v}] for v in [None, '', '5', True, [], float('nan'), float('inf'), 1e13]]
        malformed += [[{**valid, 'next': dest}] for dest in [None, '', [], 'removed']]
        for rules in malformed:
            with self.subTest(rules=rules):
                doc = rule_document()
                doc['questions'][0]['scoreRules'] = rules
                self.assertTrue(validate_document(doc))

    def test_rules_validate_cycles_including_unreachable_and_reordered_content(self):
        doc = rule_document()
        doc['questions'][2]['scoreRules'] = [{'operator': 'gt', 'value': 999, 'next': 'target'}]
        self.assertTrue(any('bucle' in e for e in validate_document(doc)))
        doc['questions'][2]['scoreRules'][0]['next'] = 'removed'
        self.assertTrue(any('Destino' in e for e in validate_document(doc)))
        doc = rule_document()
        doc['questions'][0]['scoreRules'] = [{'operator': 'eq', 'value': 2, 'next': 'target'}]
        original = copy.deepcopy(doc)
        doc['questions'][1], doc['questions'][2] = doc['questions'][2], doc['questions'][1]
        self.assertEqual(validate_document(doc), [])
        self.assertEqual(evaluate(doc, {'first': 'a'}), evaluate(original, {'first': 'a'}))
