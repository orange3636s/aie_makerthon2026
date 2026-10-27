"""Install the pinned Windows dopant runtime; never downloads unverified code."""
import hashlib,json,platform,sys,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
if sys.version_info[:2]!=(3,12) or platform.system()!='Windows' or platform.machine().lower() not in ('amd64','x86_64'):
    raise SystemExit('Windows x64 / Python 3.12 is required for setup.cmd. Linux: use Dockerfile.')
archive=root/'vendor/transport-windows-x64.zip';manifest=json.loads((root/'vendor/manifest.json').read_text())
if hashlib.sha256(archive.read_bytes()).hexdigest()!=manifest['files'][archive.name]:raise SystemExit('Runtime checksum mismatch')
dest=root/'.native';dest.mkdir(exist_ok=True)
with zipfile.ZipFile(archive) as z:
    for f in z.infolist():
        if not (dest/f.filename).resolve().is_relative_to(dest.resolve()):raise SystemExit('Invalid archive path')
    z.extractall(dest)
print('Native transport runtime installed.')
