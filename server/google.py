"""Google OAuth and durable, idempotent Sheets delivery. No participant secrets."""
import json
import os
import time
from contextlib import contextmanager
from urllib.parse import quote
from uuid import uuid4
import httpx
from cryptography.fernet import Fernet
from .engine import is_statement
from .variables import stored_variables
from .storage import DATA, connect, dumps, put_setting, setting, utcnow

BASE_COLUMNS = [('_id', 'Identificador del envío'), ('_version', 'Versión'), ('_date', 'Fecha y hora (UTC)'), ('_score', 'Puntuación'), ('_result', 'Resultado')]


class GoogleError(ValueError):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


@contextmanager
def worker_lock():
    """OS lock is released on crash; shared by every process using this data dir."""
    handle = (DATA / 'sync.lock').open('a+b')
    handle.seek(0)
    locked = False
    try:
        if os.name == 'nt':
            import msvcrt
            try:
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                locked = True
            except OSError:
                pass
        else:
            import fcntl
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
                locked = True
            except BlockingIOError:
                pass
        yield locked
    finally:
        if locked:
            handle.seek(0)
            if os.name == 'nt':
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle, fcntl.LOCK_UN)
        handle.close()


@contextmanager
def exclusive(timeout=30):
    """Waits for the worker to finish its current batch, then holds the lock."""
    deadline = time.time() + timeout
    while True:
        with worker_lock() as acquired:
            if acquired:
                yield
                return
        if time.time() > deadline:
            raise GoogleError('La sincronización está ocupada. Inténtalo de nuevo en unos segundos.')
        time.sleep(0.2)


class GoogleClient:
    def __init__(self, key):
        self.cipher = Fernet(key)

    def store_tokens(self, data):
        with connect() as db:
            old = setting(db, 'google_tokens')
            previous = json.loads(self.cipher.decrypt(old.encode())) if old else {}
            if not data.get('refresh_token'):
                data['refresh_token'] = previous.get('refresh_token')
            if not data.get('refresh_token'):
                raise GoogleError('Google no concedió acceso sin conexión. Vuelve a conectar y acepta el permiso.')
            data['expires_at'] = time.time() + data.get('expires_in', 3600)
            put_setting(db, 'google_tokens', self.cipher.encrypt(dumps(data).encode()).decode())

    def exchange(self, code, redirect):
        try:
            response = httpx.post('https://oauth2.googleapis.com/token', data={'code': code, 'client_id': os.getenv('GOOGLE_CLIENT_ID'), 'client_secret': os.getenv('GOOGLE_CLIENT_SECRET'), 'redirect_uri': redirect, 'grant_type': 'authorization_code'}, timeout=20)
        except httpx.HTTPError:
            raise GoogleError('No se pudo contactar con Google. Comprueba la conexión y vuelve a autorizar.') from None
        if response.status_code != 200:
            raise GoogleError('No se pudo autorizar Google. Revisa el cliente OAuth y vuelve a conectar.')
        self.store_tokens(response.json())

    def token(self):
        with connect() as db:
            encrypted = setting(db, 'google_tokens')
        if not encrypted:
            raise GoogleError('Conecta Google desde los ajustes del formulario.')
        data = json.loads(self.cipher.decrypt(encrypted.encode()))
        if data.get('expires_at', 0) < time.time() + 60:
            try:
                response = httpx.post('https://oauth2.googleapis.com/token', data={'client_id': os.getenv('GOOGLE_CLIENT_ID'), 'client_secret': os.getenv('GOOGLE_CLIENT_SECRET'), 'refresh_token': data['refresh_token'], 'grant_type': 'refresh_token'}, timeout=20)
            except httpx.HTTPError:
                raise GoogleError('No se pudo renovar la conexión con Google. Se reintentará automáticamente.') from None
            if response.status_code != 200:
                raise GoogleError('El permiso de Google ha caducado o fue revocado. Vuelve a conectar Google.')
            fresh = response.json()
            fresh['refresh_token'] = data['refresh_token']
            self.store_tokens(fresh)
            data = fresh
        return data['access_token']

    def request(self, method, path, **kwargs):
        try:
            response = httpx.request(method, 'https://sheets.googleapis.com/v4/spreadsheets/' + path, headers={'Authorization': 'Bearer ' + self.token()}, timeout=20, **kwargs)
        except httpx.HTTPError:
            raise GoogleError('No se pudo contactar con Google Sheets. Comprueba la conexión e inténtalo de nuevo.') from None
        if response.status_code >= 400:
            messages = {401: 'Vuelve a conectar Google.', 403: 'Google ha denegado el acceso. Comprueba los permisos de edición y que la API Sheets esté habilitada.', 404: 'No se encuentra el documento o la pestaña de destino.', 429: 'Google está limitando las peticiones. Se reintentará automáticamente.'}
            raise GoogleError(messages.get(response.status_code, f'Google Sheets no respondió correctamente (HTTP {response.status_code}).'), response.status_code)
        return response.json()

    def metadata(self, spreadsheet):
        return self.request('GET', spreadsheet, params={'fields': 'spreadsheetId,properties(title),sheets(properties)'})

    def values(self, spreadsheet, cell_range):
        return self.request('GET', spreadsheet + '/values/' + quote(cell_range, safe=''), params={'valueRenderOption': 'UNFORMATTED_VALUE'}).get('values', [])

    def write(self, spreadsheet, cell_range, rows):
        return self.request('PUT', spreadsheet + '/values/' + quote(cell_range, safe=''), params={'valueInputOption': 'RAW'}, json={'values': rows})

    def clear(self, spreadsheet, ranges):
        return self.request('POST', spreadsheet + '/values:batchClear', json={'ranges': ranges})

    def ensure_size(self, spreadsheet, props, rows, columns):
        grid = props.get('gridProperties', {})
        if rows <= grid.get('rowCount', 0) and columns <= grid.get('columnCount', 0):
            return
        self.request('POST', spreadsheet + ':batchUpdate', json={'requests': [{'updateSheetProperties': {'properties': {'sheetId': props['sheetId'], 'gridProperties': {'rowCount': max(rows, grid.get('rowCount', 0)), 'columnCount': max(columns, grid.get('columnCount', 0))}}, 'fields': 'gridProperties(rowCount,columnCount)'}}]})


def sheet_range(title, suffix):
    return "'" + title.replace("'", "''") + "'!" + suffix


def column_name(number):
    name = ''
    while number:
        number, rest = divmod(number - 1, 26)
        name = chr(65 + rest) + name
    return name


def row_values(sub, columns):
    answers = {sub['form_id'] + ':' + a['question_id']: a['label'] for a in json.loads(sub['answers'])}
    values = {'_id': sub['id'], '_version': sub['version'], '_date': sub['completed'], '_score': sub['total'], '_result': sub['result_title'], **answers}
    values.update({sub['form_id'] + ':variable:' + v['id']: v['value'] for v in stored_variables(sub)})
    return [values.get(c[0]) if values.get(c[0]) is not None else '' for c in columns]


def rebuild(client, destination_id, submission_ids, missing_ok=False):
    """Rewrites a destination tab with exactly these submissions, oldest first.

    Writes before clearing the leftovers, so a failure never leaves the tab empty.
    The caller holds the worker lock; the jobs only change after Google succeeds."""
    with connect() as db:
        dest = dict(db.execute('SELECT * FROM destinations WHERE id=?', (destination_id,)).fetchone())
        subs = [dict(r) for r in db.execute('SELECT s.*,v.values_json AS variable_values FROM submissions s LEFT JOIN submission_variables v ON v.submission_id=s.id WHERE id IN (SELECT value FROM json_each(?)) ORDER BY completed,id', (dumps(submission_ids),))]
        forms = list(dict.fromkeys(s['form_id'] for s in subs))
        versions = {fid: [json.loads(v['document']) for v in db.execute('SELECT document FROM versions WHERE form_id=? ORDER BY version', (fid,))] for fid in forms}
    spreadsheet = dest['spreadsheet']
    try:
        meta = client.metadata(spreadsheet)
    except GoogleError as exc:
        if missing_ok and exc.status == 404:
            return
        raise
    props = next((s['properties'] for s in meta['sheets'] if s['properties']['sheetId'] == dest['sheet_id']), None)
    if not props:
        if missing_ok:
            return
        raise GoogleError('La pestaña de destino fue eliminada. Restaúrala o elige otro destino.')
    title = props['title']
    # Latest title wins; the column keeps the position where it first appeared.
    titles = {}
    for fid in forms:
        for doc in versions[fid]:
            for q in doc['questions']:
                if not is_statement(q):
                    titles[fid + ':' + q['id']] = q['title']
            for variable in doc.get('variables', []):
                titles[fid + ':variable:' + variable['id']] = variable['name']
    columns = [list(c) for c in BASE_COLUMNS] + [[key, t + ' [' + key + ']'] for key, t in titles.items()]
    rows = [[c[1] for c in columns]] + [row_values(s, columns) for s in subs]
    grid = props.get('gridProperties', {})
    client.ensure_size(spreadsheet, props, len(rows), len(columns))
    client.write(spreadsheet, sheet_range(title, 'A1'), rows)
    width, height = max(grid.get('columnCount', 0), len(columns)), max(grid.get('rowCount', 0), len(rows))
    stale = []
    if height > len(rows):
        stale.append(sheet_range(title, f'A{len(rows) + 1}:{column_name(width)}{height}'))
    if width > len(columns):
        stale.append(sheet_range(title, f'{column_name(len(columns) + 1)}1:{column_name(width)}{len(rows)}'))
    if stale:
        client.clear(spreadsheet, stale)
    now = utcnow()
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('UPDATE destinations SET columns=?,next_row=?,title=? WHERE id=?', (dumps(columns), len(rows) + 1, title, destination_id))
        for row, sub in enumerate(subs, start=2):
            db.execute("INSERT INTO jobs(submission_id,destination_id,status,row_number,synced_at) VALUES(?,?,'synced',?,?) ON CONFLICT(submission_id) DO UPDATE SET destination_id=excluded.destination_id,status='synced',attempts=0,next_attempt=0,error=NULL,row_number=excluded.row_number,synced_at=excluded.synced_at", (sub['id'], destination_id, row, now))
    return len(subs)


def resync_form(client, form_id):
    """Empties the form's destination tab and writes every stored submission again."""
    with exclusive():
        with connect() as db:
            integration = db.execute('SELECT destination_id FROM integrations WHERE form_id=? AND enabled=1', (form_id,)).fetchone()
            if not integration:
                raise GoogleError('Activa la sincronización con Google Sheets antes de volcar las respuestas.')
            destination = integration['destination_id']
            # Other forms sharing the tab keep their rows.
            ids = [r['id'] for r in db.execute('SELECT id FROM submissions WHERE form_id=? UNION SELECT submission_id FROM jobs WHERE destination_id=?', (form_id, destination))]
        return rebuild(client, destination, ids)


def delete_submissions(client, form_id):
    """Removes the form's rows from every tab they were sent to, then deletes them here."""
    with exclusive():
        with connect() as db:
            destinations = [r['destination_id'] for r in db.execute('SELECT DISTINCT j.destination_id FROM jobs j JOIN submissions s ON s.id=j.submission_id WHERE s.form_id=?', (form_id,))]
        for destination in destinations:
            with connect() as db:
                keep = [r['submission_id'] for r in db.execute('SELECT j.submission_id FROM jobs j JOIN submissions s ON s.id=j.submission_id WHERE j.destination_id=? AND s.form_id!=?', (destination, form_id))]
            rebuild(client, destination, keep, missing_ok=True)
        with connect() as db:
            return db.execute('DELETE FROM submissions WHERE form_id=?', (form_id,)).rowcount


def sync_job(client, submission_id):
    with connect() as db:
        job = dict(db.execute('SELECT * FROM jobs WHERE submission_id=?', (submission_id,)).fetchone())
        sub = dict(db.execute('SELECT s.*,v.values_json AS variable_values FROM submissions s LEFT JOIN submission_variables v ON v.submission_id=s.id WHERE s.id=?', (submission_id,)).fetchone())
        dest = dict(db.execute('SELECT * FROM destinations WHERE id=?', (job['destination_id'],)).fetchone())
        doc = json.loads(db.execute('SELECT document FROM versions WHERE form_id=? AND version=?', (sub['form_id'], sub['version'])).fetchone()['document'])
    spreadsheet = dest['spreadsheet']
    meta = client.metadata(spreadsheet)
    props = next((s['properties'] for s in meta['sheets'] if s['properties']['sheetId'] == dest['sheet_id']), None)
    if not props:
        raise GoogleError('La pestaña de destino fue eliminada. Restaúrala para reintentar este envío.')
    title = props['title']
    columns = json.loads(dest['columns']) or [list(c) for c in BASE_COLUMNS]
    known = {c[0] for c in columns}
    for q in doc['questions']:
        # Form ID namespaces IDs when several forms share a destination.
        qkey = sub['form_id'] + ':' + q['id']
        if qkey not in known and not is_statement(q):
            columns.append([qkey, q['title'] + ' [' + qkey + ']'])
            known.add(qkey)
    for variable in doc.get('variables', []):
        vkey = sub['form_id'] + ':variable:' + variable['id']
        if vkey not in known:
            columns.append([vkey, variable['name'] + ' [' + vkey + ']'])
            known.add(vkey)
    first = client.values(spreadsheet, sheet_range(title, '1:1'))
    if first:
        actual = first[0]
        expected = [c[1] for c in columns]
        if any(value != expected[i] for i, value in enumerate(actual) if value != '' and i < len(expected)) or len(actual) > len(expected):
            raise GoogleError('Las columnas de la pestaña han cambiado. Restaura sus encabezados y orden antes de reintentar.')
    remote_ids = client.values(spreadsheet, sheet_range(title, 'A:A'))
    existing = next((i + 1 for i, row in enumerate(remote_ids) if row and row[0] == submission_id), None)
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        # Durable reservation BEFORE the external write: retry always uses the same row.
        row = existing or job['row_number'] or max(dest['next_row'], len(remote_ids) + 1, 2)
        if row <= len(remote_ids) and remote_ids[row-1] and remote_ids[row-1][0] not in ('', submission_id):
            raise GoogleError('La fila reservada contiene otro envío. Restaura el orden de filas de la pestaña.')
        db.execute('UPDATE destinations SET columns=?,next_row=MAX(next_row,?),title=? WHERE id=?', (dumps(columns), row + 1, title, dest['id']))
        db.execute('UPDATE jobs SET row_number=? WHERE submission_id=?', (row, submission_id))
    client.ensure_size(spreadsheet, props, row, len(columns))
    client.write(spreadsheet, sheet_range(title, 'A1'), [[c[1] for c in columns]])
    client.write(spreadsheet, sheet_range(title, f'A{row}'), [row_values(sub, columns)])
    with connect() as db:
        db.execute("UPDATE jobs SET status='synced',error=NULL,synced_at=? WHERE submission_id=?", (utcnow(), submission_id))


def process_jobs(client):
    with worker_lock() as acquired:
        if not acquired:
            return
        with connect() as db:
            pending = db.execute("SELECT submission_id,attempts FROM jobs WHERE status IN ('pending','error') AND attempts<8 AND next_attempt<=? ORDER BY next_attempt LIMIT 10", (time.time(),)).fetchall()
        for job in pending:
            try:
                sync_job(client, job['submission_id'])
            except Exception as exc:
                attempts = job['attempts'] + 1
                error = str(exc) if isinstance(exc, GoogleError) else 'No se pudo contactar con Google. Se conservará el envío para reintentar.'
                with connect() as db:
                    db.execute("UPDATE jobs SET status='error',attempts=?,next_attempt=?,error=? WHERE submission_id=?", (attempts, time.time() + min(3600, 15 * 2 ** attempts), error, job['submission_id']))
