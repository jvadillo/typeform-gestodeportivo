import os
from pathlib import Path

# Small dotenv reader: no expansion, never executes values.
env = Path(__file__).resolve().parent.parent / '.env'
if env.exists():
    for line in env.read_text(encoding='utf-8-sig').splitlines():
        if line.strip() and not line.lstrip().startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ.setdefault(key.strip(), value.strip().strip('\"').strip("'"))

import uvicorn

if __name__ == '__main__':
    # Behind a reverse proxy, trust X-Forwarded-For only when FORWARDED_ALLOW_IPS is set, so login limits apply per client.
    uvicorn.run('server.app:app', host=os.getenv('HOST', '127.0.0.1'), port=int(os.getenv('PORT', '8000')), proxy_headers=bool(os.getenv('FORWARDED_ALLOW_IPS')))
