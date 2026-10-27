"""Native, sequential reverse-design simulator. No arbitrary user code is executed."""
import os,sys,json,math,time,subprocess
from pathlib import Path
import native_runtime
import viennaps as ps
import viennals as ls
from engine import contour_mesh
from reverse_catalog import validate,BY_OP
from measurements import side_coverage

ROOT=Path(__file__).resolve().parent
def run(data):
    target,steps=validate(data);started=time.perf_counter()
    ps.setDimension(2);ls.setDimension(2);ps.setNumThreads(1);ps.Length.setUnit('um');ps.Time.setUnit('s');ps.Logger.setLogLevel(ps.LogLevel.ERROR)
    periodic=target['id']=='locos'
    width=target['width']/4 if periodic else target['width']
    d=ps.Domain(gridDelta=.01,xExtent=width,yExtent=2.,boundary=ps.BoundaryType.REFLECTIVE_BOUNDARY)
    if periodic:
        ps.MakePlane(d,0.,ps.Material.Si).apply()
    else:
        # The lower level set bounds the native dopant cell grid below the wafer.
        ps.MakePlane(d,-1.2,ps.Material.Si).apply()
        ps.MakePlane(d,0.,ps.Material.Si,True).apply()
    frames=[];cmp_stop=None;doping_state=None;concentration=None;failure=None
    def box(x0,y0,x1,y1):
        level=ls.Domain(d.getGrid());geom=ls.MakeGeometry(level,ls.Box([x0,y0],[x1,y1]));geom.setIgnoreBoundaryConditions([True,True,False]);geom.apply();return level
    def surface_top():return max(p[1] for p in d.getSurfaceMesh(False).getNodes())
    def ray_params():
        rp=ps.RayTracingParameters();rp.raysPerPoint=120;rp.useRandomSeeds=False;rp.rngSeed=1729;return rp
    def advance(model,t,particles=False):
        proc=ps.Process(d,model,t)
        if particles:proc.setParameters(ray_params())
        proc.apply()
    def snap(label,extra=None):
        polygons=[]
        for m in sorted(d.getMaterialsInDomain(),key=int):
            mesh=ls.Mesh();convert=ls.ToHullMesh(mesh,d.getMaterialLevelSet(m));convert.setBottomExtension(2.);convert.apply()
            polygons+=contour_mesh(mesh,int(m),True)
        if not polygons or any(not p['closed'] for p in polygons):raise ValueError('닫힌 재료 경계를 계산하지 못했습니다. 조건을 줄여 주세요.')
        if periodic:
            polygons=[dict(material=q['material'],closed=q['closed'],points=[[round(sign*x+shift,6),y] for x,y in q['points']]) for q in polygons for sign,shift in [(-1,-.6),(1,-.2),(-1,.2),(1,.6)]]
        surface=d.getSurfaceMesh(False).getNodes()
        frame=dict(label=label,polygons=polygons,lowest=min(p[1] for p in surface),highest=max(p[1] for p in surface),metrics=extra or {})
        if concentration:frame['concentration']=concentration
        frames.append(frame)
    def transport(op,params):
        nonlocal doping_state,concentration
        prefix=Path.cwd()/('transport-'+str(len(frames)));prefix.mkdir(exist_ok=True)
        levels=[]
        for i,v in enumerate(d.getLevelSets()):
            name=prefix/f'level-{i}.lvst';ls.Writer(v,str(name)).apply()
            levels.append(dict(file=str(name),material=int(d.getMaterialMap().getMaterialAtIdx(i))))
        payload=dict(width=target['width'],levels=levels,state=doping_state,operation=op,params=params)
        src=prefix/'input.json';out=prefix/'output.json';src.write_text(json.dumps(payload),encoding='utf-8')
        env={**os.environ,'SIMULATION_DOPING_ENGINE':'1','PYTHONIOENCODING':'utf-8'}
        r=subprocess.run([sys.executable,str(ROOT/'reverse_transport.py'),str(src),str(out)],env=env,capture_output=True,timeout=35)
        if r.returncode:raise ValueError('주입·확산 계산 실패: '+r.stderr.decode('utf-8',errors='replace')[-240:])
        result=json.loads(out.read_text(encoding='utf-8'));doping_state=result['state'];concentration=result['concentration']
    snap('Si substrate')
    for i,row in enumerate(steps):
        try:
            op=row['op'];p=row['params'];mats=d.getMaterialsInDomain();metric={};label=BY_OP[op]['title']
            if op=='photo':
                if p['action']=='Strip':
                    if ps.Material.Mask not in mats:raise ValueError('제거할 PR이 없습니다.')
                    d.removeMaterial(ps.Material.Mask);label='PR strip'
                else:
                    if ps.Material.Mask in mats:raise ValueError('기존 PR을 먼저 제거하세요.')
                    d.duplicateTopLevelSet(ps.Material.Mask);advance(ps.SphereDistribution(radius=p['thickness']),0)
                    pr=d.getMaterialLevelSet(ps.Material.Mask)
                    centers=[p['offset']] if p['pattern']=='Central' else [p['offset']-p['pitch']/2,p['offset']+p['pitch']/2] if p['pattern']=='Double' else [p['offset']+j*p['pitch'] for j in range(-8,9) if abs(p['offset']+j*p['pitch'])<target['width']/2+p['width']/2]
                    if periodic:
                        if p['pattern']!='Double' or p['offset']!=0 or p['pitch']!=.8:raise ValueError('LOCOS 대칭 계산은 Double 마스크, pitch 0.8 µm, offset 0을 사용합니다.')
                        centers=[-.2]
                    intervals=sorted((max(-width/2,c-p['width']/2),min(width/2,c+p['width']/2)) for c in centers)
                    intervals=[(a,b) for a,b in intervals if b>a]
                    if p['tone']=='Positive':
                        kept=[];end=-width/2
                        for a,b in intervals:
                            if a>end:kept.append((end,a))
                            end=max(end,b)
                        if end<width/2:kept.append((end,width/2))
                        intervals=kept
                    pattern=None
                    # Intersect retained intervals then unite the finite PR
                    # pieces. Avoid the signed-run complement edge case in LS.
                    for a,b in intervals:
                        piece=ls.Domain();piece.deepCopy(pr)
                        ls.BooleanOperation(piece,box(a,-2,b,2),ls.BooleanOperationEnum.INTERSECT).apply()
                        if pattern is None:pattern=piece
                        else:ls.BooleanOperation(pattern,piece,ls.BooleanOperationEnum.UNION).apply()
                    if pattern is None:raise ValueError('남는 PR이 없습니다. 패턴 폭과 극성을 확인하세요.')
                    pr=pattern
                    d.removeMaterial(ps.Material.Mask);d.insertNextLevelSetAsMaterial(pr,ps.Material.Mask,True)
                    label=f"Photo · {p['tone']} PR"
            elif op=='etch':
                m=getattr(ps.Material,p['material'])
                if m not in mats:raise ValueError(p['material']+' 재료가 없습니다.')
                if p['method']=='Selective removal':
                    if m==ps.Material.Si:raise ValueError('기판 전체 제거는 지원하지 않습니다. 식각률·시간을 지정하세요.')
                    d.removeMaterial(m)
                else:
                    ratio=1. if p['method']=='Isotropic' else p['isotropic']
                    advance(ps.DirectionalProcess(direction=[0.,-1.,0.],directionalVelocity=-p['rate']*(1-ratio),isotropicVelocity=-p['rate']*ratio,maskMaterial=[a for a in mats if a!=m]),p['time'])
                label=f"Etch · {p['material']}"
            elif op=='deposition':
                cmp_stop=surface_top();m=getattr(ps.Material,p['material']);d.duplicateTopLevelSet(m)
                if p['method'] in ('PVD','CVD'):
                    advance(ps.SingleParticleProcess(rate=p['rate'],stickingProbability=p['sticking'],sourceExponent=p['exponent']),p['time'],True)
                else:
                    ap=ps.SingleParticleALDParams();ap.stickingProbability=p['ald_sticking'];ap.s0=3.36;ap.incomingFlux=2e6;ap.evaporationFlux=2.5
                    # Same macro-cycle acceleration as the official ALD example.
                    batch=min(int(p['cycles']),10);ap.growthPerCycle=p['gpc']*p['cycles']/batch
                    proc=ps.Process(d,ps.SingleParticleALD(ap));cy=ps.AtomicLayerProcessParameters();cy.numCycles=batch;cy.pulseTime=p['pulse'];cy.coverageTimeStep=min(.01,p['pulse']/5)
                    proc.setParameters(cy);proc.setParameters(ray_params());proc.apply()
                label=f"{p['method']} · {p['material']}"
                metric={'topGrowthUm':round(surface_top()-cmp_stop,5),'nominalGrowthUm':p['gpc']*p['cycles'] if p['method']=='ALD' else p['rate']*p['time']}
            elif op=='diffusion':
                if p['method']=='Ion implantation':transport('implant',p);label=f"Implant · {p['species']}"
                elif p['method']=='Anneal':transport('anneal',p);label='Anneal'
                else:
                    if ps.Material.SiO2 not in mats:raise ValueError('산화 전에 SiO₂ seed 막이 필요합니다.')
                    if any(m not in [ps.Material.Si,ps.Material.SiO2,ps.Material.Si3N4] for m in mats):raise ValueError('열산화는 Si / SiO₂ / Si₃N₄ 구조에서 실행하세요.')
                    # Oxidation requires a non-wrapped mechanical mask, unlike
                    # the cumulative level sets used by generic processes.
                    rebuilt=ps.Domain(gridDelta=.01,xExtent=width,yExtent=2.,boundary=ps.BoundaryType.REFLECTIVE_BOUNDARY)
                    rebuilt.insertNextLevelSetAsMaterial(d.getMaterialLevelSet(ps.Material.Si),ps.Material.Si,False)
                    rebuilt.insertNextLevelSetAsMaterial(d.getMaterialLevelSet(ps.Material.SiO2),ps.Material.SiO2,True)
                    if ps.Material.Si3N4 in mats:rebuilt.insertNextLevelSetAsMaterial(d.getMaterialLevelSet(ps.Material.Si3N4),ps.Material.Si3N4,False)
                    d=rebuilt
                    model=ps.Oxidation();model.setTemperature(p['temperature']);model.setPressure(1.);model.setTime(p['oxidation_time']);model.setTimeStep(p['oxidation_time']/3)
                    name='Wet' if p['method'].startswith('Wet') else 'Dry';model.setOxidant(getattr(ps.OxidantType,name));model.setOrientation(ps.SiliconOrientation.Si100);model.setInitialOxideThickness(.025);model.setMaxGridPoints(100000)
                    advance(model,0);label=p['method']
            elif op=='cmp':
                if cmp_stop is None:raise ValueError('증착 후에 Global planarization을 추가하세요.')
                ps.Planarize(d,cmp_stop).apply();label='Global planarization';metric={'stopHeightUm':cmp_stop}
            if doping_state and op!='diffusion':transport('sync',{})
            snap(label,metric)
            if op=='deposition' and not periodic:
                measurement=side_coverage(frames[-2]['polygons'],frames[-1]['polygons'],int(m),metric['topGrowthUm'],width)
                if measurement:frames[-1]['metrics'].update(measurement)
            if frames[-1]['highest']>1.5 or frames[-1]['lowest']<-.9:raise ValueError('학습 영역을 벗어났습니다. 공정 시간이나 식각률을 줄이세요.')
        except (ValueError,RuntimeError,subprocess.TimeoutExpired) as e:
            failure=dict(step=i+1,message=str(e));break
    for i,f in enumerate(frames):f['progress']=i/max(1,len(frames)-1)
    bounds=list(target['bounds'])
    bounds[2]=min(bounds[2],min(f['lowest'] for f in frames)-.08)
    bounds[3]=max(bounds[3],max(f['highest'] for f in frames)+.08)
    return dict(target=target['id'],example=target['id'],frames=frames,steps=steps,bounds=bounds,roi=target['roi'],unit='µm',elapsed=round(time.perf_counter()-started,3),failure=failure,model='Native process flow',engine='ViennaPS '+ps.__version__)

if __name__=='__main__':
    result=run(json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')))
    Path(sys.argv[2]).write_text(json.dumps(result,ensure_ascii=False,allow_nan=False),encoding='utf-8')
