import base64
import hashlib
import hmac
import os
import secrets
import time
from cryptography.fernet import Fernet
from fastapi import HTTPException, Request
from .storage import DATA, connect, setting, put_setting

PRODUCTION = os.getenv('APP_ENV') == 'production'
APP_URL = os.getenv('APP_URL', 'http://localhost:8000').rstrip('/')
COOKIE = 'gesto_session'


def init_security():
    configured = os.getenv('SECRET_KEY')
    if PRODUCTION and (not configured or len(os.getenv('ADMIN_PASSWORD', '')) < 12 or not APP_URL.startswith('https://')):
        raise RuntimeError('Producción requiere SECRET_KEY, ADMIN_PASSWORD de al menos 12 caracteres y APP_URL HTTPS.')
    keyfile = DATA / 'secret.key'
    if configured:
        key = configured.encode()
    elif keyfile.exists():
        key = keyfile.read_bytes()
    else:
        key = Fernet.generate_key()
        keyfile.write_bytes(key)
        keyfile.chmod(0o600)
    Fernet(key)  # Fail early if the configured key is invalid.
    with connect() as db:
        if os.getenv('ADMIN_PASSWORD'):
            current = setting(db, 'password')
            if not current or not verify_password(os.environ['ADMIN_PASSWORD'], current):
                put_setting(db, 'password', hash_password(os.environ['ADMIN_PASSWORD']))
                db.execute('DELETE FROM sessions')
    return key


def hash_password(password):
    salt = secrets.token_bytes(16)
    hashed = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1)
    return base64.b64encode(salt + hashed).decode()


def verify_password(password, hashed):
    data = base64.b64decode(hashed)
    return hmac.compare_digest(data[16:], hashlib.scrypt(password.encode(), salt=data[:16], n=16384, r=8, p=1))


def admin(request: Request):
    token = request.cookies.get(COOKIE, '')
    sid = hashlib.sha256(token.encode()).hexdigest()
    with connect() as db:
        row = db.execute('SELECT id FROM sessions WHERE id=? AND expires>?', (sid, time.time())).fetchone()
    if not row:
        raise HTTPException(401, 'Inicia sesión para acceder a la administración.')
    return sid


def sign_version(key, form_id, version):
    return hmac.new(key, f'{form_id}:{version}'.encode(), hashlib.sha256).hexdigest()
