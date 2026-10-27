from pathlib import Path
import sys, os, json
native = Path(os.environ.get('SIMULATION_NATIVE_ROOT',str(Path(__file__).resolve().parent / '.native')))
# The Windows 4.7 CI ray tracer fails with OMP #132. Keep production
# geometry/ray-tracing recipes on the installed wheel; use CI for dopants.
advanced = os.environ.get('SIMULATION_DOPING_ENGINE') == '1'
if len(sys.argv)>1 and Path(sys.argv[1]).is_file():
    try:
        payload=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
        advanced=advanced or any(row.get('op') in ('implant','anneal') for row in payload.get('steps',[]))
    except (ValueError,OSError,AttributeError):pass
if native.exists() and advanced:
    sys.path.insert(0, str(native))
