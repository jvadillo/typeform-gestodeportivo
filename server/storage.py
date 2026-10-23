import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get('DATA_DIR', ROOT / 'data')).resolve()


def utcnow():
    return datetime.now(timezone.utc).isoformat()


def dumps(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


@contextmanager
def connect():
    db = sqlite3.connect(DATA / 'gesto.sqlite3', timeout=30)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / 'uploads').mkdir(exist_ok=True)
    with connect() as db:
        db.executescript((ROOT / 'server/schema.sql').read_text())
        if 'slug' not in {c['name'] for c in db.execute('PRAGMA table_info(forms)')}:
            db.execute('ALTER TABLE forms ADD COLUMN slug TEXT')
        db.execute('CREATE UNIQUE INDEX IF NOT EXISTS forms_slug ON forms(slug)')


def setting(db, key, default=None):
    row = db.execute('SELECT value FROM settings WHERE key=?', (key,)).fetchone()
    return row['value'] if row else default


def put_setting(db, key, value):
    db.execute('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', (key, value))
