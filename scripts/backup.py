"""Consistent SQLite backup, including images and the local encryption key.

Usage: python scripts/backup.py /secure/path/backup-directory
Stop the service during backup if simultaneous image changes must be atomic.
"""
import argparse
import os
import shutil
import sqlite3
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('destination', type=Path)
parser.add_argument('--data-dir', type=Path, default=Path(os.getenv('DATA_DIR', 'data')))
args = parser.parse_args()
source = args.data_dir.resolve()
destination = args.destination.resolve()
if source == destination or source in destination.parents:
    parser.error('El destino debe estar fuera del directorio de datos.')
destination.mkdir(parents=True, exist_ok=False)
with sqlite3.connect(source / 'gesto.sqlite3') as original, sqlite3.connect(destination / 'gesto.sqlite3') as backup:
    original.backup(backup)
shutil.copytree(source / 'uploads', destination / 'uploads')
if (source / 'secret.key').exists():
    shutil.copy2(source / 'secret.key', destination / 'secret.key')
print(f'Copia creada en {destination}. Conserva también el SECRET_KEY externo si lo utilizas.')
