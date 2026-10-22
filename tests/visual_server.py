"""Isolated UI fixture. Disposable data, loopback only, no external credentials.

Run manually: python -m tests.visual_server
This server deliberately bypasses owner login for visual QA; never deploy it.
"""
import os
import secrets
import tempfile
from uuid import uuid4

directory = tempfile.TemporaryDirectory(prefix='gesto-visual-')
os.environ.update(DATA_DIR=directory.name, APP_ENV='development', APP_URL='http://localhost:8001', ADMIN_PASSWORD=secrets.token_urlsafe(32))
for key in ('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'SECRET_KEY'):
    os.environ.pop(key, None)

from fastapi.responses import JSONResponse
from server.app import app
from server.security import admin
from server.storage import connect, utcnow

app.dependency_overrides[admin] = lambda: 'isolated-visual-fixture'


@app.middleware('http')
async def visual_auth(request, call_next):
    if request.url.path == '/api/auth':
        return JSONResponse({'authenticated': True, 'setup': False, 'production': False})
    return await call_next(request)


with connect() as db:
    form = db.execute('SELECT * FROM forms LIMIT 1').fetchone()
    db.execute('INSERT INTO versions VALUES(?,?,?,?)', (form['id'], 1, form['draft'], utcnow()))
    db.execute('UPDATE forms SET published=1 WHERE id=?', (form['id'],))
    print('Visual form:', form['id'])

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8001, proxy_headers=False)
