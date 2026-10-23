import asyncio
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import sqlite3
import time
import warnings
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, quote, urlparse
from uuid import uuid4

from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps, UnidentifiedImageError

from .storage import ROOT, DATA, init_db, connect, dumps, utcnow, setting, put_setting
from .security import admin, init_security, hash_password, verify_password, sign_version, COOKIE, APP_URL, PRODUCTION
from .engine import FormError, evaluate, validate_document
from .seed import blank_document, example_document
from .google import GoogleClient, GoogleError, process_jobs, resync_form, delete_submissions, BASE_COLUMNS, sheet_range
from .export import make_workbook

init_db()
KEY = init_security()
google = GoogleClient(KEY)
with connect() as db:
    if not setting(db, 'seeded'):
        doc = example_document()
        db.execute('INSERT INTO forms(id,name,draft,updated) VALUES(?,?,?,?)', (str(uuid4()), doc['name'], dumps(doc), utcnow()))
        put_setting(db, 'seeded', '1')


async def worker():
    while True:
        try:
            await asyncio.to_thread(process_jobs, google)
        except Exception:
            import logging
            logging.exception('Error del proceso de sincronización')
        await asyncio.sleep(5)


@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(worker())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title='Gesto', docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)


@app.middleware('http')
async def security_headers(request, call_next):
    if request.method in ('POST', 'PUT', 'DELETE', 'PATCH'):
        origin = request.headers.get('origin')
        # Compare with the configured origin, never a caller-controlled Host header.
        allowed = {APP_URL}
        if not PRODUCTION:
            port = urlparse(APP_URL).port or 8000
            allowed |= {f'http://localhost:{port}', f'http://127.0.0.1:{port}'}
        if origin and origin not in allowed:
            return JSONResponse({'detail': 'Origen no permitido.'}, status_code=403)
        if request.headers.get('sec-fetch-site') == 'cross-site':
            return JSONResponse({'detail': 'Petición entre sitios no permitida.'}, status_code=403)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'same-origin'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    if request.url.path.startswith('/api'):
        response.headers['Cache-Control'] = 'no-store'
    elif not request.url.path.startswith('/uploads'):
        response.headers['Cache-Control'] = 'no-cache'
    if PRODUCTION:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000'
    return response


@app.exception_handler(FormError)
async def form_exception(request, exc):
    return JSONResponse({'detail': str(exc)}, status_code=422)


@app.exception_handler(GoogleError)
async def google_exception(request, exc):
    return JSONResponse({'detail': str(exc)}, status_code=422)


async def body(request):
    raw = await request.body()
    if len(raw) > 2_000_000:
        raise HTTPException(413, 'La petición es demasiado grande.')
    try:
        def reject_constant(value):
            raise ValueError('Número no finito')
        value = json.loads(raw, parse_constant=reject_constant)
        if not isinstance(value, dict):
            raise ValueError()
        return value
    except (ValueError, UnicodeError):
        raise HTTPException(400, 'JSON inválido.')


def get_form(db, form_id):
    row = db.execute('SELECT * FROM forms WHERE id=?', (form_id,)).fetchone()
    if not row:
        raise HTTPException(404, 'No se encuentra el formulario.')
    return row


@app.get('/api/health')
def health():
    with connect() as db:
        db.execute('SELECT 1').fetchone()
    return {'status': 'ok'}


@app.get('/api/auth')
def auth_status(request: Request):
    try:
        admin(request)
        logged_in = True
    except HTTPException:
        logged_in = False
    with connect() as db:
        setup = not bool(setting(db, 'password'))
    return {'authenticated': logged_in, 'setup': setup, 'production': PRODUCTION}


@app.post('/api/auth/login')
async def login(request: Request):
    data = await body(request)
    password = data.get('password', '')
    if not isinstance(password, str) or len(password) > 1024:
        raise HTTPException(400, 'Contraseña inválida.')
    ip = request.client.host
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        attempt = db.execute('SELECT * FROM login_attempts WHERE ip=?', (ip,)).fetchone()
        if attempt and attempt['since'] > time.time() - 900 and attempt['count'] >= 10:
            raise HTTPException(429, 'Demasiados intentos. Espera 15 minutos.')
        hashed = setting(db, 'password')
        if not hashed:
            if PRODUCTION or ip not in ('127.0.0.1', '::1', 'testclient'):
                raise HTTPException(403, 'Configura la contraseña desde el servidor.')
            if len(password) < 12:
                raise HTTPException(400, 'Elige una contraseña de al menos 12 caracteres.')
            put_setting(db, 'password', hash_password(password))
        elif not verify_password(password, hashed):
            count = attempt['count'] + 1 if attempt and attempt['since'] > time.time() - 900 else 1
            since = attempt['since'] if count > 1 else time.time()
            db.execute('INSERT OR REPLACE INTO login_attempts VALUES(?,?,?)', (ip, count, since))
            db.commit()
            raise HTTPException(401, 'La contraseña no es correcta.')
        db.execute('DELETE FROM login_attempts WHERE ip=?', (ip,))
        db.execute('DELETE FROM sessions WHERE expires<?', (time.time(),))
        token = secrets.token_urlsafe(32)
        db.execute('INSERT INTO sessions VALUES(?,?)', (hashlib.sha256(token.encode()).hexdigest(), time.time() + 43200))
    response = JSONResponse({'ok': True})
    response.set_cookie(COOKIE, token, httponly=True, secure=PRODUCTION, samesite='lax', max_age=43200, path='/')
    return response


@app.post('/api/auth/logout')
def logout(session=Depends(admin)):
    with connect() as db:
        db.execute('DELETE FROM sessions WHERE id=?', (session,))
    response = JSONResponse({'ok': True})
    response.delete_cookie(COOKIE)
    return response


@app.get('/api/forms', dependencies=[Depends(admin)])
def forms():
    with connect() as db:
        return [dict(r) for r in db.execute('SELECT f.id,f.name,f.published,f.updated,f.revision,(SELECT COUNT(*) FROM submissions s WHERE s.form_id=f.id) AS submissions FROM forms f ORDER BY updated DESC')]


@app.post('/api/forms', dependencies=[Depends(admin)])
async def create_form(request: Request):
    data = await body(request)
    name = str(data.get('name', 'Nuevo formulario')).strip()[:200] or 'Nuevo formulario'
    doc = blank_document(name)
    fid = str(uuid4())
    with connect() as db:
        db.execute('INSERT INTO forms(id,name,draft,updated) VALUES(?,?,?,?)', (fid, name, dumps(doc), utcnow()))
    return {'id': fid}


@app.get('/api/forms/{fid}', dependencies=[Depends(admin)])
def form_detail(fid: str):
    with connect() as db:
        form = dict(get_form(db, fid))
    form['draft'] = json.loads(form['draft'])
    form['errors'] = validate_document(form['draft'])
    return form


@app.put('/api/forms/{fid}', dependencies=[Depends(admin)])
async def save_form(fid: str, request: Request):
    data = await body(request)
    doc = data.get('draft')
    if not isinstance(doc, dict) or not isinstance(doc.get('questions'), list) or not isinstance(doc.get('results'), list) or not isinstance(doc.get('welcome'), dict) or len(doc['questions']) > 100 or len(doc['results']) > 20:
        raise HTTPException(422, 'Estructura de borrador inválida (máximo 100 preguntas y 20 resultados).')
    # Incomplete drafts are allowed; publication performs full validation.
    try:
        errors = validate_document(doc)
    except (TypeError, KeyError, AttributeError):
        raise HTTPException(422, 'El borrador contiene valores inválidos.')
    name = str(doc.get('name', '')).strip()[:200]
    if not name:
        raise HTTPException(422, 'El formulario necesita un nombre.')
    with connect() as db:
        get_form(db, fid)
        changed = db.execute('UPDATE forms SET name=?,draft=?,updated=?,revision=revision+1 WHERE id=? AND revision=?', (name, dumps(doc), utcnow(), fid, data.get('revision')))
        if changed.rowcount != 1:
            raise HTTPException(409, 'Este borrador cambió en otra pestaña. Recarga antes de editar.')
        revision = db.execute('SELECT revision FROM forms WHERE id=?', (fid,)).fetchone()['revision']
    return {'revision': revision, 'errors': errors}


SLUG = re.compile(r'[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])')
UUID = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')


def slug_error(slug):
    if not SLUG.fullmatch(slug):
        return 'Usa de 3 a 60 letras minúsculas, números o guiones, sin guion al principio ni al final.'
    if UUID.fullmatch(slug):
        return 'El enlace no puede tener la forma de un identificador de formulario.'
    return ''


@app.get('/api/slugs/{slug}', dependencies=[Depends(admin)])
def slug_availability(slug: str, form_id: str = ''):
    error = slug_error(slug)
    if not error:
        with connect() as db:
            if db.execute('SELECT 1 FROM forms WHERE slug=? AND id!=?', (slug, form_id)).fetchone():
                error = 'Ese enlace ya lo usa otro formulario.'
    return {'available': not error, 'message': error}


@app.put('/api/forms/{fid}/slug', dependencies=[Depends(admin)])
async def save_slug(fid: str, request: Request):
    data = await body(request)
    slug = data.get('slug') or None
    if slug is not None:
        error = slug_error(slug) if isinstance(slug, str) else 'Enlace inválido.'
        if error:
            raise HTTPException(422, error)
    with connect() as db:
        get_form(db, fid)
        try:
            db.execute('UPDATE forms SET slug=? WHERE id=?', (slug, fid))
        except sqlite3.IntegrityError:
            raise HTTPException(409, 'Ese enlace ya lo usa otro formulario.') from None
    return {'slug': slug}


@app.post('/api/forms/{fid}/duplicate', dependencies=[Depends(admin)])
def duplicate_form(fid: str):
    with connect() as db:
        old = get_form(db, fid)
        doc = json.loads(old['draft'])
        doc['name'] = old['name'] + ' · copia'
        new_id = str(uuid4())
        db.execute('INSERT INTO forms(id,name,draft,updated) VALUES(?,?,?,?)', (new_id, doc['name'], dumps(doc), utcnow()))
    return {'id': new_id}


@app.delete('/api/forms/{fid}', dependencies=[Depends(admin)])
def delete_form(fid: str):
    with connect() as db:
        get_form(db, fid)
        db.execute('DELETE FROM forms WHERE id=?', (fid,))
    return {'ok': True}


@app.post('/api/forms/{fid}/publish', dependencies=[Depends(admin)])
def publish_form(fid: str):
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        form = get_form(db, fid)
        doc = json.loads(form['draft'])
        errors = validate_document(doc)
        if errors:
            raise HTTPException(422, errors)
        version = (form['published'] or 0) + 1
        db.execute('INSERT INTO versions VALUES(?,?,?,?)', (fid, version, dumps(doc), utcnow()))
        db.execute('UPDATE forms SET published=?,updated=? WHERE id=?', (version, utcnow(), fid))
    return {'version': version, 'url': APP_URL + '/f/' + fid}


@app.get('/api/uploads', dependencies=[Depends(admin)])
def list_images():
    # The gallery reuses earlier uploads; newest first.
    files = [f for f in (DATA / 'uploads').iterdir() if re.fullmatch(r'[a-f0-9-]+\.webp', f.name)]
    files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
    return [{'url': '/uploads/' + f.name, 'uploaded': datetime.fromtimestamp(f.stat().st_mtime, timezone.utc).isoformat()} for f in files]


@app.post('/api/uploads', dependencies=[Depends(admin)])
async def upload_image(file: UploadFile = File(...)):
    data = await file.read(8 * 1024 * 1024 + 1)
    await file.close()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, 'La imagen debe ocupar menos de 8 MB.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            picture = Image.open(io.BytesIO(data))
            if picture.format not in ('JPEG', 'PNG', 'WEBP') or picture.width * picture.height > 25_000_000:
                raise ValueError()
            picture.load()
            picture = ImageOps.exif_transpose(picture).convert('RGB')
            picture.thumbnail((2560, 2560))
            name = str(uuid4()) + '.webp'
            # Quality 80 with the slowest/most efficient method: about a third lighter than 88 with no visible difference.
            picture.save(DATA / 'uploads' / name, 'WEBP', quality=80, method=6)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, 'Sube una imagen JPEG, PNG o WebP válida de hasta 25 megapíxeles.')
    return {'url': '/uploads/' + name}


@app.get('/api/public/{key}')
def public_form(key: str):
    # Either the form ID or its custom link.
    with connect() as db:
        row = db.execute('SELECT v.* FROM versions v JOIN forms f ON f.id=v.form_id AND f.published=v.version WHERE f.id=? OR f.slug=?', (key, key.lower())).fetchone()
        if not row:
            raise HTTPException(404, 'Este formulario todavía no está publicado o ya no existe.')
    fid = row['form_id']
    return {'id': fid, 'version': row['version'], 'document': json.loads(row['document']), 'token': sign_version(KEY, fid, row['version'])}


@app.post('/api/public/{fid}/submit')
async def submit(fid: str, request: Request):
    data = await body(request)
    version, sid = data.get('version'), data.get('id')
    if not isinstance(version, int) or not isinstance(sid, str) or not re.fullmatch(r'[a-f0-9-]{36}', sid):
        raise HTTPException(422, 'Identificador de envío o versión inválido.')
    if not hmac.compare_digest(str(data.get('token', '')), sign_version(KEY, fid, version)):
        raise HTTPException(403, 'La versión del formulario no es válida.')
    fingerprint = hashlib.sha256(json.dumps({'form': fid, 'version': version, 'answers': data.get('answers')}, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()).hexdigest()
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        published = db.execute('SELECT document FROM versions WHERE form_id=? AND version=?', (fid, version)).fetchone()
        if not published:
            raise HTTPException(404, 'La versión publicada ya no existe.')
        doc = json.loads(published['document'])
        evaluated = evaluate(doc, data.get('answers'))
        prior = db.execute('SELECT fingerprint FROM submissions WHERE id=?', (sid,)).fetchone()
        if prior:
            if prior['fingerprint'] != fingerprint:
                raise HTTPException(409, 'Este identificador de envío ya se utilizó con otras respuestas.')
        else:
            db.execute('INSERT INTO submissions VALUES(?,?,?,?,?,?,?,?,?)', (sid, fid, version, utcnow(), dumps(evaluated['answers']), evaluated['total'], evaluated['result']['id'], evaluated['result']['title'], fingerprint))
            integration = db.execute('SELECT * FROM integrations WHERE form_id=? AND enabled=1', (fid,)).fetchone()
            if integration:
                db.execute('INSERT INTO jobs(submission_id,destination_id) VALUES(?,?)', (sid, integration['destination_id']))
    return {'id': sid, 'result': evaluated['result'], 'total': evaluated['total'] if evaluated['result'].get('showScore') else None}


def date_range(start, end):
    try:
        lower = datetime.strptime(start, '%Y-%m-%d').replace(tzinfo=timezone.utc).isoformat() if start else ''
        upper = (datetime.strptime(end, '%Y-%m-%d').replace(tzinfo=timezone.utc) + timedelta(days=1)).isoformat() if end else '9999'
        if lower >= upper:
            raise ValueError()
        return lower, upper
    except ValueError:
        raise HTTPException(422, 'El intervalo de fechas no es válido.')


@app.get('/api/forms/{fid}/submissions', dependencies=[Depends(admin)])
def submissions(fid: str, start: str = '', end: str = ''):
    lower, upper = date_range(start, end)
    with connect() as db:
        get_form(db, fid)
        rows = db.execute("SELECT s.*,COALESCE(j.status,'disabled') AS sync_status,j.error,j.attempts,j.destination_id,d.spreadsheet,d.title AS sheet_title FROM submissions s LEFT JOIN jobs j ON j.submission_id=s.id LEFT JOIN destinations d ON d.id=j.destination_id WHERE s.form_id=? AND s.completed>=? AND s.completed<? ORDER BY completed DESC", (fid, lower, upper)).fetchall()
    return [{**dict(row), 'answers': json.loads(row['answers'])} for row in rows]


@app.delete('/api/forms/{fid}/submissions', dependencies=[Depends(admin)])
async def delete_all_submissions(fid: str):
    with connect() as db:
        get_form(db, fid)
    return {'deleted': await asyncio.to_thread(delete_submissions, google, fid)}


@app.post('/api/submissions/{sid}/retry', dependencies=[Depends(admin)])
def retry(sid: str):
    with connect() as db:
        updated = db.execute("UPDATE jobs SET status='pending',attempts=0,next_attempt=0,error=NULL WHERE submission_id=? AND status!='synced'", (sid,))
        if not updated.rowcount:
            raise HTTPException(422, 'Este envío no tiene una sincronización pendiente.')
    return {'ok': True}


@app.get('/api/forms/{fid}/export', dependencies=[Depends(admin)])
def export(fid: str, start: str = '', end: str = ''):
    lower, upper = date_range(start, end)
    with connect() as db:
        form = get_form(db, fid)
        rows = db.execute('SELECT * FROM submissions WHERE form_id=? AND completed>=? AND completed<? ORDER BY completed', (fid, lower, upper)).fetchall()
        versions = [json.loads(v['document']) for v in db.execute('SELECT document FROM versions WHERE form_id=? ORDER BY version', (fid,))]
        if not versions:
            versions = [json.loads(form['draft'])]
        name = re.sub(r'[^\w-]+', '-', form['name'], flags=re.UNICODE).strip('-') or 'formulario'
    return Response(make_workbook(rows, versions), media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers={'Content-Disposition': "attachment; filename*=UTF-8''" + quote(name + '-' + datetime.now(timezone.utc).strftime('%Y-%m-%d') + '.xlsx')})


@app.get('/api/forms/{fid}/integration', dependencies=[Depends(admin)])
def integration_status(fid: str):
    with connect() as db:
        get_form(db, fid)
        row = db.execute('SELECT i.*,d.spreadsheet,d.sheet_id,d.title FROM integrations i LEFT JOIN destinations d ON d.id=i.destination_id WHERE form_id=?', (fid,)).fetchone()
        connected = bool(setting(db, 'google_tokens'))
    return {'connected': connected, 'configured': bool(os.getenv('GOOGLE_CLIENT_ID') and os.getenv('GOOGLE_CLIENT_SECRET')), 'integration': dict(row) if row else None, 'redirect': APP_URL + '/api/google/callback'}


@app.post('/api/forms/{fid}/integration/check', dependencies=[Depends(admin)])
async def check_integration(fid: str, request: Request):
    data = await body(request)
    with connect() as db:
        get_form(db, fid)
    spreadsheet = parse_spreadsheet(data.get('spreadsheet', ''))
    meta = await asyncio.to_thread(google.metadata, spreadsheet)
    return {'spreadsheet': spreadsheet, 'title': meta['properties']['title'], 'sheets': [s['properties'] for s in meta['sheets'] if s['properties'].get('sheetType', 'GRID') == 'GRID']}


def parse_spreadsheet(value):
    match = re.search(r'/spreadsheets/d/([a-zA-Z0-9_-]+)', str(value))
    value = match[1] if match else str(value).strip()
    if not re.fullmatch(r'[a-zA-Z0-9_-]{10,200}', value):
        raise HTTPException(422, 'Introduce una URL o un identificador de Google Sheets válido.')
    return value


@app.put('/api/forms/{fid}/integration', dependencies=[Depends(admin)])
async def save_integration(fid: str, request: Request):
    data = await body(request)
    with connect() as db:
        get_form(db, fid)
        if not data.get('enabled'):
            db.execute('UPDATE integrations SET enabled=0 WHERE form_id=?', (fid,))
            return {'ok': True}
    spreadsheet = parse_spreadsheet(data.get('spreadsheet', ''))
    meta = await asyncio.to_thread(google.metadata, spreadsheet)
    props = next((s['properties'] for s in meta['sheets'] if s['properties']['sheetId'] == data.get('sheet_id')), None)
    if not props:
        raise HTTPException(422, 'Selecciona una pestaña válida.')
    with connect() as db:
        destination = db.execute('SELECT id FROM destinations WHERE spreadsheet=? AND sheet_id=?', (spreadsheet, props['sheetId'])).fetchone()
    if not destination:
        occupied = await asyncio.to_thread(google.values, spreadsheet, sheet_range(props['title'], 'A:ZZ'))
        if occupied:
            raise HTTPException(422, 'Elige una pestaña vacía dedicada a estos envíos. Así se conservan las columnas y filas estables.')
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('INSERT OR IGNORE INTO destinations(id,spreadsheet,sheet_id,title,columns) VALUES(?,?,?,?,?)', (str(uuid4()), spreadsheet, props['sheetId'], props['title'], dumps(BASE_COLUMNS)))
        did = db.execute('SELECT id FROM destinations WHERE spreadsheet=? AND sheet_id=?', (spreadsheet, props['sheetId'])).fetchone()['id']
        db.execute('INSERT INTO integrations VALUES(?,?,1) ON CONFLICT(form_id) DO UPDATE SET destination_id=excluded.destination_id,enabled=1', (fid, did))
    return {'ok': True}


@app.post('/api/forms/{fid}/integration/resync', dependencies=[Depends(admin)])
async def resync_integration(fid: str):
    with connect() as db:
        get_form(db, fid)
    return {'synced': await asyncio.to_thread(resync_form, google, fid)}


@app.get('/api/google/connect')
def google_connect(form_id: str, session=Depends(admin)):
    if not os.getenv('GOOGLE_CLIENT_ID') or not os.getenv('GOOGLE_CLIENT_SECRET'):
        raise HTTPException(422, 'Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env y reinicia el servidor.')
    state = secrets.token_urlsafe(32)
    with connect() as db:
        get_form(db, form_id)
        db.execute('DELETE FROM oauth_states WHERE expires<?', (time.time(),))
        db.execute('INSERT INTO oauth_states VALUES(?,?,?,?)', (state, session, form_id, time.time() + 600))
    params = {'client_id': os.environ['GOOGLE_CLIENT_ID'], 'redirect_uri': APP_URL + '/api/google/callback', 'response_type': 'code', 'scope': 'https://www.googleapis.com/auth/spreadsheets', 'access_type': 'offline', 'prompt': 'consent', 'state': state}
    return RedirectResponse('https://accounts.google.com/o/oauth2/v2/auth?' + urlencode(params))


@app.get('/api/google/callback')
def google_callback(state: str = '', code: str = '', error: str = '', session=Depends(admin)):
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        saved = db.execute('SELECT * FROM oauth_states WHERE state=? AND session_id=? AND expires>?', (state, session, time.time())).fetchone()
        if not saved:
            raise HTTPException(403, 'La autorización ha caducado. Vuelve a conectar Google.')
        db.execute('DELETE FROM oauth_states WHERE state=?', (state,))
    if error or not code:
        return RedirectResponse('/admin/forms/' + saved['form_id'] + '?google=cancelled')
    google.exchange(code, APP_URL + '/api/google/callback')
    return RedirectResponse('/admin/forms/' + saved['form_id'] + '?google=connected')


app.mount('/src', StaticFiles(directory=ROOT / 'src'), name='source')
app.mount('/uploads', StaticFiles(directory=DATA / 'uploads'), name='uploads')


@app.get('/{path:path}')
def frontend(path: str):
    if path.startswith('api/'):
        raise HTTPException(404, 'Ruta no encontrada.')
    return FileResponse(ROOT / 'index.html')
