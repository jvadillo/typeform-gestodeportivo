import copy
import json
import sqlite3
import unittest
from pathlib import Path

from server.engine import evaluate, validate_document, FormError
from server.seed import blank_document


def document():
    doc = blank_document('Variables')
    doc.update(variables=[{'id': 'x', 'name': 'Fuerza', 'initial': 1}, {'id': 'y', 'name': 'Resistencia', 'initial': 0}], resultVariable='x')
    doc['questions'] = [
        {'id': 'first', 'title': 'Primera', 'type': 'choice', 'required': True, 'next': 'third', 'options': [
            {'id': 'a', 'label': 'A', 'calculations': [{'variable': 'x', 'operation': 'add', 'value': 2}]},
            {'id': 'b', 'label': 'B', 'calculations': [{'variable': 'x', 'operation': 'subtract', 'value': 2}]}]},
        {'id': 'second', 'title': 'Segunda', 'type': 'number', 'required': False, 'next': 'end', 'calculations': [{'variable': 'x', 'operation': 'add', 'source': 'answer'}]},
        {'id': 'third', 'title': 'Tercera', 'type': 'choice', 'required': True, 'next': 'second', 'options': [{'id': 'a', 'label': 'A', 'calculations': [{'variable': 'x', 'operation': 'multiply', 'value': 3}]}]}]
    return doc


class VariableTests(unittest.TestCase):
    def test_schema_upgrade_preserves_legacy_rows_and_is_repeatable(self):
        schema = (Path(__file__).parents[1] / 'server' / 'schema.sql').read_text(encoding='utf-8')
        old_schema = '\n'.join(line for line in schema.splitlines() if 'CREATE TABLE IF NOT EXISTS submission_variables' not in line)
        with sqlite3.connect(':memory:') as db:
            db.executescript(old_schema)
            db.execute("INSERT INTO forms(id,name,draft,updated) VALUES('form','Original','{}','2026-10-27')")
            original = ('sub', 'form', 1, '2026-10-27', '[]', 6, 'result', 'Resultado', 'fingerprint')
            db.execute('INSERT INTO submissions VALUES(?,?,?,?,?,?,?,?,?)', original)
            db.executescript(schema)
            db.executescript(schema)
            self.assertEqual(db.execute('SELECT * FROM submissions').fetchone(), original)
            self.assertEqual(db.execute('PRAGMA user_version').fetchone()[0], 2)
            db.execute('INSERT INTO submission_variables VALUES(?,?)', ('sub', '[]'))
            db.execute("DELETE FROM submissions WHERE id='sub'")
            self.assertEqual(db.execute('SELECT COUNT(*) FROM submission_variables').fetchone()[0], 0)

    def test_shared_arithmetic_cases_and_exact_rules(self):
        cases = json.loads(Path(__file__).with_name('variable_cases.json').read_text(encoding='utf-8'))
        for case in cases:
            with self.subTest(case=case['name']):
                doc = document()
                doc['variables'] = case['variables']
                doc['questions'] = doc['questions'][:1]
                q = doc['questions'][0]
                q['next'] = 'end'
                q['options'] = [{'id': 'a', 'label': 'A', 'calculations': case['calculations']}]
                self.assertEqual(validate_document(doc), [])
                result = evaluate(doc, {'first': 'a'})
                self.assertEqual({v['id']: v['value'] for v in result['variables']}, case['expected'])

    def test_visited_order_optional_answers_and_named_result(self):
        doc = document()
        self.assertEqual(validate_document(doc), [])
        result = evaluate(doc, {'first': 'a', 'third': 'a', 'second': 2})
        self.assertEqual(result['total'], 11)
        self.assertEqual([a['question_id'] for a in result['answers']], ['first', 'third', 'second'])
        self.assertEqual(evaluate(doc, {'first': 'b', 'third': 'a'})['total'], -3)
        doc['resultVariable'] = 'y'
        self.assertEqual(evaluate(doc, {'first': 'a', 'third': 'a'})['total'], 0)

    def test_all_any_priority_and_tampered_future_answers(self):
        doc = document()
        conditions = [{'variable': 'x', 'operator': 'gte', 'value': 3}, {'variable': 'y', 'operator': 'eq', 'value': 1}]
        doc['questions'][0]['scoreRules'] = [{'match': 'all', 'conditions': conditions, 'next': 'end'}, {'match': 'any', 'conditions': conditions, 'next': 'second'}]
        self.assertEqual(validate_document(doc), [])
        self.assertEqual(evaluate(doc, {'first': 'a', 'second': 2})['total'], 5)
        with self.assertRaises(FormError):
            evaluate(doc, {'first': 'a', 'third': 'a', 'second': 2})
        doc['questions'][0]['options'][0]['calculations'].append({'variable': 'y', 'operation': 'add', 'value': 1})
        self.assertEqual(evaluate(doc, {'first': 'a'})['total'], 3)

    def test_runtime_division_by_zero_and_overflow(self):
        doc = document()
        doc['questions'][1]['calculations'][0]['operation'] = 'divide'
        with self.assertRaisesRegex(FormError, 'cero'):
            evaluate(doc, {'first': 'a', 'third': 'a', 'second': 0})
        self.assertEqual(evaluate(doc, {'first': 'a', 'third': 'a', 'second': 3})['total'], 3)
        doc['questions'][0]['options'][0]['calculations'] = [{'variable': 'x', 'operation': 'multiply', 'value': 1e12}] * 2
        with self.assertRaisesRegex(FormError, 'límite'):
            evaluate(doc, {'first': 'a', 'third': 'a'})

    def test_invalid_definitions_operations_and_conditions(self):
        for variables in [None, [], {}, [None], [{'id': '__proto__', 'name': 'X'}], [{'id': 'x', 'name': ''}], [{'id': 'x', 'name': 'X', 'initial': True}], [{'id': 'x', 'name': 'X'}, {'id': 'y', 'name': ' x '}], [{'id': 'x', 'name': 'X'}] * 21]:
            with self.subTest(variables=variables):
                doc = document(); doc['variables'] = variables
                self.assertTrue(validate_document(doc))
        valid = {'variable': 'x', 'operation': 'add', 'value': 1}
        for bad in [None, {}, [None], [valid]*51, [{**valid, 'variable': 'deleted'}], [{**valid, 'value': None}], [{**valid, 'value': True}], [{**valid, 'operation': 'power'}], [{**valid, 'operation': 'divide', 'value': 0}], [{**valid, 'source': 'answer'}]]:
            with self.subTest(calculations=bad):
                doc = document(); doc['questions'][0]['options'][0]['calculations'] = bad
                self.assertTrue(validate_document(doc))
        for rule in [{'conditions': []}, {'conditions': [None]}, {'conditions': [{'variable': 'deleted', 'operator': 'gt', 'value': 1}]}, {'match': 'invalid', 'variable': 'x', 'operator': 'gt', 'value': 1}]:
            doc = document(); doc['questions'][0]['scoreRules'] = [{**rule, 'next': 'end'}]
            self.assertTrue(validate_document(doc))

    def test_legacy_points_and_rules_migrate_without_double_awards(self):
        from server.seed import example_document
        doc = example_document()
        original = evaluate(doc, {'interes': 'fuerza', 'entrenamiento': 'regular'})
        doc.update(variables=[{'id': 'score', 'name': 'Nuevo nombre', 'initial': 0}], resultVariable='score')
        opt = doc['questions'][0]['options'][0]
        opt['calculations'] = [{'variable': 'score', 'operation': 'add', 'value': opt['points']}]
        result = evaluate(doc, {'interes': 'fuerza', 'entrenamiento': 'regular'})
        self.assertEqual(result['total'], original['total'])
        self.assertEqual(result['variables'][0]['name'], 'Nuevo nombre')
