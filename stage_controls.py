"""Per-phase controls for the cyclic native Bosch model (one-based frame IDs)."""
import math

def controls(params,overrides=None):
    overrides=overrides or {}
    def field(frame,key,label,value,lo,hi,unit):
        return dict(frame=frame,key=key,label=label,value=value,min=lo,max=hi,unit=unit)
    rows=[field(1,'etch_time','초기 식각 시간',params['etch_time'],.2,2.,'s')]
    for cycle in range(int(params['cycles'])):
        rows += [field(2+cycle*3,'coating','보호막 성장량',params['coating'],.03,.15,'µm'),
                 field(3+cycle*3,'opening','바닥 보호막 제거량',overrides.get(str(2+cycle*3),params['coating'])+.04,.03,.25,'µm'),
                 field(4+cycle*3,'etch_time','사이클 식각 시간',params['etch_time'],.2,2.,'s')]
    return rows

def validate(data,params):
    given=data.get('stages',{})
    if not isinstance(given,dict):raise ValueError('단계 조건 형식을 확인하세요.')
    fields={str(f['frame']):f for f in controls(params)}
    if set(given)-set(fields):raise ValueError('지원하지 않는 Bosch 단계입니다.')
    clean={}
    for key,value in given.items():
        f=fields[key]
        if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or not f['min']<=value<=f['max']:raise ValueError(f['label']+': 값의 범위를 확인하세요.')
        clean[key]=value
    return clean
