"""Google OAuth and durable, idempotent Sheets delivery. No participant secrets."""
import json
import os
import time
from contextlib import contextmanager
from urllib.parse import quote
from uuid import uuid4
import httpx
from cryptography.fernet import Fernet
from .storage import DATA, connect, dumps, put_setting, setting, utcnow

BASE_COLUMNS = [('_id', 'Identificador del envío'), ('_version', 'Versión'), ('_date', 'Fecha y hora (UTC)'), ('_score', 'Puntuación'), ('_result', 'Resultado')]


class GoogleError(ValueError):
    pass


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
            raise GoogleError(messages.get(response.status_code, f'Google Sheets no respondió correctamente (HTTP {response.status_code}).'))
        return response.json()

    def metadata(self, spreadsheet):
        return self.request('GET', spreadsheet, params={'fields': 'spreadsheetId,properties(title),sheets(properties)'})

    def values(self, spreadsheet, cell_range):
        return self.request('GET', spreadsheet + '/values/' + quote(cell_range, safe=''), params={'valueRenderOption': 'UNFORMATTED_VALUE'}).get('values', [])

    def write(self, spreadsheet, cell_range, rows):
        return self.request('PUT', spreadsheet + '/values/' + quote(cell_range, safe=''), params={'valueInputOption': 'RAW'}, json={'values': rows})

    def ensure_size(self, spreadsheet, props, rows, columns):
        grid = props.get('gridProperties', {})
        if rows <= grid.get('rowCount', 0) and columns <= grid.get('columnCount', 0):
            return
        self.request('POST', spreadsheet + ':batchUpdate', json={'requests': [{'updateSheetProperties': {'properties': {'sheetId': props['sheetId'], 'gridProperties': {'rowCount': max(rows, grid.get('rowCount', 0)), 'columnCount': max(columns, grid.get('columnCount', 0))}}, 'fields': 'gridProperties(rowCount,columnCount)'}}]})


def sheet_range(title, suffix):
    return "'" + title.replace("'", "''") + "'!" + suffix


def sync_job(client, submission_id):
    with connect() as db:
        job = dict(db.execute('SELECT * FROM jobs WHERE submission_id=?', (submission_id,)).fetchone())
        sub = dict(db.execute('SELECT * FROM submissions WHERE id=?', (submission_id,)).fetchone())
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
        if qkey not in known:
            columns.append([qkey, q['title'] + ' [' + qkey + ']'])
            known.add(qkey)
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
    answers = {sub['form_id'] + ':' + a['question_id']: a['label'] for a in json.loads(sub['answers'])}
    values = {'_id': sub['id'], '_version': sub['version'], '_date': sub['completed'], '_score': sub['total'], '_result': sub['result_title'], **answers}
    client.write(spreadsheet, sheet_range(title, f'A{row}'), [[values.get(c[0]) if values.get(c[0]) is not None else '' for c in columns]])
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
