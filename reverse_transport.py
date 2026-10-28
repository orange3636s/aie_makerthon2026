"""Isolated native 4.7 dopant worker; avoids the Windows CI ray tracer conflict."""
import os,sys,json
from pathlib import Path
os.environ['SIMULATION_DOPING_ENGINE']='1'
import native_runtime
import viennaps as ps
import viennals as ls
from doping_engine import Doping

def run(p):
    ps.setDimension(2);ls.setDimension(2);ps.setNumThreads(1);ps.Length.setUnit('um');ps.Time.setUnit('s');ps.Logger.setLogLevel(ps.LogLevel.ERROR)
    d=ps.Domain(.01,p['width'],2.)
    for row in p['levels']:
        v=ls.Domain();ls.Reader(v,row['file']).apply();d.insertNextLevelSetAsMaterial(v,ps.Material(row['material']),False)
    dop=Doping(d);old=p.get('state')
    if old:
        dop.positions=old['positions'];dop.fields=old['fields'];dop.ready=True;dop.sync()
    if p['operation']=='implant':dop.implant(p['params'])
    elif p['operation']=='anneal':dop.anneal(p['params'])
    elif p['operation']=='predep':dop.diffuse(p['params'],source=True)
    elif p['operation']=='drivein':dop.diffuse(p['params'])
    return dict(state=dict(positions=dop.positions,fields=dop.fields),concentration=dop.snapshot())

if __name__=='__main__':
    try:result=run(json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')))
    except ValueError as error:result={'error':str(error)}
    Path(sys.argv[2]).write_text(json.dumps(result,allow_nan=False),encoding='utf-8')
