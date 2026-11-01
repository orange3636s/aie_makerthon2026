"""Native, sequential reverse-design simulator. No arbitrary user code is executed."""
import os,sys,json,math,time,subprocess
from pathlib import Path
import native_runtime
import viennaps as ps
import viennals as ls
from engine import contour_mesh
from reverse_catalog import validate,BY_OP
from measurements import side_coverage
from recipe_models import resolve
from photo_model import openings,complement,DEVELOP_RATE

ROOT=Path(__file__).resolve().parent
def run(data):
    from reverse_catalog import BY_TARGET
    from structure_recipes import modernize
    if data.get('target') in BY_TARGET:data={**data,'steps':modernize(data.get('steps',[]))}
    target,steps=validate(data);started=time.perf_counter()
    ps.setDimension(2);ls.setDimension(2);ps.setNumThreads(1);ps.Length.setUnit('um');ps.Time.setUnit('s');ps.Logger.setLogLevel(ps.LogLevel.ERROR)
    periodic=target['id']=='locos'
    width=target['width']/4 if periodic else target['width']
    d=ps.Domain(gridDelta=.01,xExtent=width,yExtent=2.,boundary=ps.BoundaryType.REFLECTIVE_BOUNDARY)
    substrate_depth=target.get('substrateThickness')
    if substrate_depth is None and target.get('substrateRoughness',0)>0:
        substrate_depth=abs(target['bounds'][2])
    if substrate_depth is not None:
        def initial_layer(y0,y1,mat):
            level=ls.Domain(d.getGrid())
            geom=ls.MakeGeometry(level,ls.Box([-width/2,y0],[width/2,y1]))
            geom.setIgnoreBoundaryConditions([True,True,False]);geom.apply()
            d.insertNextLevelSetAsMaterial(level,mat,True)
        if target.get('wafer'):
            body=target['wafer']['body'];box_thickness=target['wafer']['box']
            initial_layer(-substrate_depth,-body-box_thickness,ps.Material.BulkSi)
            initial_layer(-body-box_thickness,-body,ps.Material.SiO2)
            initial_layer(-body,0.,ps.Material.Si)
        else:
            initial_layer(-substrate_depth,0.,ps.Material.Si)
    elif periodic:
        ps.MakePlane(d,0.,ps.Material.Si).apply()
    else:
        # The lower level set bounds the native dopant cell grid below the wafer.
        # Keep the passive SOI handle distinct in the transport solver. The
        # Pearson tail must not restart in Si below the blocking BOX layer.
        handle=ps.Material.BulkSi if target.get('wafer') else ps.Material.Si
        ps.MakePlane(d,-1.2,handle).apply()
        if target.get('wafer'):
            body=target['wafer']['body'];box_thickness=target['wafer']['box']
            ps.MakePlane(d,-body-box_thickness,handle,True).apply()
            ps.MakePlane(d,-body,ps.Material.SiO2,True).apply()
        ps.MakePlane(d,0.,ps.Material.Si,True).apply()
    frames=[];cmp_stop=None;doping_state=None;concentration=None;failure=None;oxidized=False
    implanted=set();diffused=set();annealed=set();mask_intervals=None;current_step=0
    process_state={};defects=[]
    photo_mask=None;pr_tone='Positive';pr_top=0.;developed_depth=0.;pr_thickness=.06
    def material(name):return ps.Material({'HfZrO2':201,'Al':202}[name]) if name in ('HfZrO2','Al') else getattr(ps.Material,name)
    def box(x0,y0,x1,y1):
        level=ls.Domain(d.getGrid());geom=ls.MakeGeometry(level,ls.Box([x0,y0],[x1,y1]));geom.setIgnoreBoundaryConditions([True,True,False]);geom.apply();return level
    def surface_top():return max(p[1] for p in d.getSurfaceMesh(False).getNodes())
    def replace_material(selected,level):
        nonlocal d
        # Preserve raw material volumes; reinserting Si above the dielectric stack
        # would otherwise overwrite the material order in a multi-tier device.
        volumes={}
        for mat in d.getMaterialsInDomain():
            v=level if mat==selected else d.getMaterialLevelSet(mat)
            if v.getNumberOfPoints()==0:continue
            copy=ls.Domain();copy.deepCopy(v);volumes[mat]=copy
        rebuilt=ps.Domain(gridDelta=.01,xExtent=width,yExtent=2.,boundary=ps.BoundaryType.REFLECTIVE_BOUNDARY)
        order=sorted(volumes,key=lambda mat:(0 if mat in (ps.Material.Si,ps.Material.BulkSi) else 2 if mat==ps.Material.Mask else 1,int(mat)))
        for index,mat in enumerate(order):rebuilt.insertNextLevelSetAsMaterial(volumes[mat],mat,index>0)
        d=rebuilt
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
            display_material=int(ps.Material.Si) if m==ps.Material.BulkSi else int(m)
            polygons+=contour_mesh(mesh,display_material,True,x_bounds=(-width/2,width/2),boundary_tolerance=.001)
        # Preserve both actual planar interfaces for sub-grid thermal oxide.
        # Boolean shell meshing otherwise shifts a <10 nm outer interface.
        if ps.Material.SiO2 in d.getMaterialsInDomain():
            from planar_oxidation import interfaces
            pair=interfaces(ps,ls,d,width)
            if pair and 0<pair[1]-pair[0]<.01:
                bottom,top=pair
                polygons=[q for q in polygons if q['material']!=int(ps.Material.SiO2)]
                polygons.append(dict(material=int(ps.Material.SiO2),closed=True,points=[[-width/2,bottom],[width/2,bottom],[width/2,top],[-width/2,top],[-width/2,bottom]]))
        if not polygons or any(not p['closed'] for p in polygons):raise ValueError('닫힌 재료 경계를 계산하지 못했습니다. 조건을 줄여 주세요.')
        if periodic:
            polygons=[dict(material=q['material'],closed=q['closed'],points=[[round(sign*x+shift,6),y] for x,y in q['points']]) for q in polygons for sign,shift in [(-1,-.6),(1,-.2),(-1,.2),(1,.6)]]
        surface=d.getSurfaceMesh(False).getNodes()
        frame=dict(label=label,stepIndex=current_step,polygons=polygons,lowest=min(p[1] for p in surface),highest=max(p[1] for p in surface),metrics=extra or {})
        if frame['highest']>1.5 or frame['lowest']<-max(.9,(substrate_depth or 0)+.02):raise ValueError('학습 영역을 벗어났습니다. 공정 시간이나 식각률을 줄이세요.')
        if concentration:frame['concentration']=concentration
        if photo_mask and current_step and steps[current_step-1]['op']=='photo':frame['photoMask']={**photo_mask,'tone':pr_tone,'arrows':steps[current_step-1]['params']['action']=='Develop'}
        # Evidence records completed operations only, independently of user labels.
        frame['processEvidence']=dict(implantedSpecies=sorted(implanted),diffusedSpecies=sorted(diffused),dopedSpecies=sorted(implanted|diffused),annealedSpecies=sorted(annealed))
        frame['processState']=dict(process_state)
        frame['defects']=[dict(e) for e in defects]
        frames.append(frame)
    def transport(op,params):
        nonlocal doping_state,concentration
        if periodic:raise ValueError('LOCOS 대칭 단면은 주입·확산을 지원하지 않습니다. MOSFET 등 전체 단면에서 실험하세요.')
        if oxidized:raise ValueError('열산화 후 주입·확산 연결은 지원하지 않습니다. 산화와 도핑 실험을 분리하세요.')
        prefix=Path.cwd()/('transport-'+str(len(frames)));prefix.mkdir(exist_ok=True)
        levels=[]
        for i,v in enumerate(d.getLevelSets()):
            name=prefix/f'level-{i}.lvst';ls.Writer(v,str(name)).apply()
            levels.append(dict(file=str(name),material=int(d.getMaterialMap().getMaterialAtIdx(i))))
        payload=dict(width=target['width'],levels=levels,state=doping_state,operation=op,params=params)
        src=prefix/'input.json';out=prefix/'output.json';src.write_text(json.dumps(payload),encoding='utf-8')
        env={**os.environ,'SIMULATION_DOPING_ENGINE':'1','PYTHONIOENCODING':'utf-8'}
        r=subprocess.run([sys.executable,str(ROOT/'reverse_transport.py'),str(src),str(out)],env=env,capture_output=True,timeout=60)
        if r.returncode:raise ValueError('주입·확산 계산 실패: '+r.stderr.decode('utf-8',errors='replace')[-240:])
        result=json.loads(out.read_text(encoding='utf-8'))
        if result.get('error'):raise ValueError(result['error'])
        doping_state=result['state'];concentration=result['concentration']
    roughness=target.get('substrateRoughness',0.)
    if roughness:
        from wafer_model import levelset
        bottom=-target['wafer']['body'] if target.get('wafer') else -(substrate_depth or 1.2)
        replace_material(ps.Material.Si,levelset(ls,d.getGrid(),width,bottom,roughness))
    snap('Wafer',dict(roughnessRqNm=roughness*1000))
    for i,row in enumerate(steps):
        current_step=i+1
        try:
            op=row['op'];p=row['params'];mats=d.getMaterialsInDomain();metric={};label=BY_OP[op]['title']
            p,response,flags=resolve(op,p,process_state)
            defects.extend(dict(code=code,step=current_step,severity='risk') for code in flags)
            if op=='photo':
                if p['action'] in ('HMDS','Soft bake','Hard bake','PEB'):
                    if p['action']!='HMDS' and ps.Material.Mask not in mats:raise ValueError('PR coating을 먼저 추가하세요.')
                    label=p['action']
                elif p['action']=='Ashing':
                    if ps.Material.Mask not in mats:raise ValueError('제거할 PR이 없습니다.')
                    advance(ps.DirectionalProcess(direction=[0.,-1.,0.],directionalVelocity=-response['prRemovalUm'],isotropicVelocity=0.,maskMaterial=[v for v in mats if v!=ps.Material.Mask],calculateVisibility=False),1.)
                    if ps.Material.Mask not in d.getMaterialsInDomain() or d.getMaterialLevelSet(ps.Material.Mask).getNumberOfPoints()==0:
                        mask_intervals=None;photo_mask=None
                    label='PR ashing'
                elif p['action']=='Strip':
                    if ps.Material.Mask not in mats:raise ValueError('제거할 PR이 없습니다.')
                    d.removeMaterial(ps.Material.Mask);label='PR strip';mask_intervals=None;photo_mask=None
                elif p['action']=='Coat':
                    if ps.Material.Mask in mats:raise ValueError('기존 PR을 먼저 제거하세요.')
                    d.duplicateTopLevelSet(ps.Material.Mask);advance(ps.SphereDistribution(radius=p['thickness']),0)
                    pr_tone=p['tone'];pr_top=surface_top();pr_thickness=p['thickness'];developed_depth=0.;photo_mask=None;mask_intervals=None
                    label='PR coating'
                elif p['action'] in ('Patterning','Exposure'):
                    if ps.Material.Mask not in mats:raise ValueError('PR coating을 먼저 추가하세요.')
                    if periodic and (p['pattern']!='Double' or p['offset']!=0 or p['pitch']!=.8):raise ValueError('LOCOS는 Double 마스크, 간격 800 nm, 위치 0 nm를 사용합니다.')
                    photo_mask={k:p[k] for k in ('pattern','width','pitch','offset')};developed_depth=0.;pr_top=surface_top()
                    label=p['action']
                elif p['action']=='Develop':
                    if ps.Material.Mask not in mats or not photo_mask:raise ValueError('PR coating과 Patterning을 먼저 추가하세요.')
                    windows=openings(photo_mask,target['width'])
                    if periodic:windows=[(-width/2,min(width/2,-.2+photo_mask['width']/2))]
                    dissolving=windows if pr_tone=='Positive' else complement(windows,width)
                    mask_intervals=complement(dissolving,width)
                    developed_depth+=DEVELOP_RATE*p['develop_time']
                    pr=d.getMaterialLevelSet(ps.Material.Mask)
                    blur=response.get('edgeBlurUm',0.)
                    for a,b in dissolving:
                        if blur>0:
                            # Eight vertical slices approximate a focus-dependent taper.
                            for band in range(8):
                                y0=pr_top-developed_depth*(band+1)/8;y1=pr_top-developed_depth*band/8
                                shrink=min((b-a)*.45,blur*(band+1)/8)
                                ls.BooleanOperation(pr,box(a+shrink,y0,b-shrink,y1+.001),ls.BooleanOperationEnum.RELATIVE_COMPLEMENT).apply()
                        else:ls.BooleanOperation(pr,box(a,pr_top-developed_depth,b,2),ls.BooleanOperationEnum.RELATIVE_COMPLEMENT).apply()
                    d.removeMaterial(ps.Material.Mask);d.insertNextLevelSetAsMaterial(pr,ps.Material.Mask,True)
                    metric={'development':dict(intervals=dissolving,fraction=min(1.,developed_depth/pr_thickness),depthNm=round(developed_depth*1000,3))}
                    if response.get('darkLossUm',0)>0:
                        advance(ps.DirectionalProcess(direction=[0.,-1.,0.],directionalVelocity=-response['darkLossUm'],isotropicVelocity=0.,maskMaterial=[v for v in d.getMaterialsInDomain() if v!=ps.Material.Mask],calculateVisibility=False),1.)
                    label='Developing'
                else:
                    if ps.Material.Mask in mats:raise ValueError('기존 PR을 먼저 제거하세요.')
                    d.duplicateTopLevelSet(ps.Material.Mask);advance(ps.SphereDistribution(radius=p['thickness']),0)
                    if data.get('_photoPreview'):
                        snap('PR coating')
                        snap('Mask alignment / exposure · schematic')
                        frames[-1]['exposure']=dict(pattern=p['pattern'],width=p['width'],pitch=p['pitch'],offset=p['offset'],tone=p['tone'])
                    pr=d.getMaterialLevelSet(ps.Material.Mask)
                    centers=[p['offset']] if p['pattern']=='Central' else [p['offset']-p['pitch']/2,p['offset']+p['pitch']/2] if p['pattern']=='Double' else [p['offset']+j*p['pitch'] for j in (-1,0,1)] if p['pattern']=='Triple' else [p['offset']+j*p['pitch'] for j in range(-8,9) if abs(p['offset']+j*p['pitch'])<target['width']/2+p['width']/2]
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
                    mask_intervals=intervals
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
                if oxidized:
                    # Rewrap the oxidation solver's mechanical-mask domain for
                    # generic material-selective level-set evolution.
                    rebuilt=ps.Domain(gridDelta=.01,xExtent=width,yExtent=2.,boundary=ps.BoundaryType.REFLECTIVE_BOUNDARY)
                    for name in (ps.Material.Si,ps.Material.SiO2,ps.Material.Si3N4):
                        if name in d.getMaterialsInDomain():rebuilt.insertNextLevelSetAsMaterial(d.getMaterialLevelSet(name),name,name!=ps.Material.Si)
                    d=rebuilt;oxidized=False
                m=material(p['material'])
                if m not in mats:raise ValueError(p['material']+' 재료가 없습니다.')
                if p['method']=='Selective removal':
                    if m==ps.Material.Si:raise ValueError('기판 전체 제거는 지원하지 않습니다. 식각률·시간을 지정하세요.')
                    d.removeMaterial(m)
                elif p['method']=='Pattern transfer':
                    if not mask_intervals:raise ValueError('패턴 전사 식각 전에 PR 마스크를 추가하세요.')
                    material_level=d.getMaterialLevelSet(m)
                    mesh=ls.Mesh();ls.ToSurfaceMesh(material_level,mesh).apply()
                    top=max(v[1] for v in mesh.getNodes())
                    # Ideal vertical pattern transfer, explicitly geometric.
                    # The finite etch budget prevents erasing the bulk substrate.
                    windows=[];end=-width/2
                    for a,b in mask_intervals:
                        if a>end:windows.append((end,a))
                        end=max(end,b)
                    if end<width/2:windows.append((end,width/2))
                    for a,b in windows:
                        ls.BooleanOperation(material_level,box(a,top-p['rate']*p['time'],b,2),ls.BooleanOperationEnum.RELATIVE_COMPLEMENT).apply()
                    d.removeMaterial(m);d.insertNextLevelSetAsMaterial(material_level,m,True)
                elif p['method']=='Isotropic' and p.get('access')=='Section sides':
                    # Explicit reduced-dimensional release: the selected film is
                    # accessible from out-of-plane sides. Other materials stay fixed.
                    # This is not an exposed-surface transport or 3D chemistry solve.
                    isolated=ps.Domain(gridDelta=.01,xExtent=width,yExtent=2.,boundary=ps.BoundaryType.REFLECTIVE_BOUNDARY)
                    level=ls.Domain();level.deepCopy(d.getMaterialLevelSet(m))
                    isolated.insertNextLevelSetAsMaterial(level,m,False)
                    ps.Process(isolated,ps.DirectionalProcess(direction=[0.,-1.,0.],directionalVelocity=0.,isotropicVelocity=-p['rate'],maskMaterial=[],calculateVisibility=False),p['time']).apply()
                    remaining=isolated.getMaterialLevelSet(m)
                    replace_material(m,remaining)
                    metric={'accessAssumption':'Out-of-plane film access; isolated-material isotropic retreat','etchBudgetNm':p['rate']*p['time']*1000}
                else:
                    # Effective ALE depth, not a precursor/reaction kinetics model.
                    ratio=1. if p['method']=='Isotropic' else 0. if p['method']=='ALE' else p['isotropic']
                    rate=p['epc']*p['cycles'] if p['method']=='ALE' else p['rate']
                    duration=1. if p['method']=='ALE' else p['time']
                    protected=None
                    if target.get('projectedMask') and mask_intervals and p['method'] in ('Directional','ALE') and p.get('input_mode')!='Equipment':
                        before=d.getMaterialLevelSet(m)
                        undercut=rate*duration*ratio
                        for a,b in mask_intervals:
                            if b-a<=2*undercut:continue
                            piece=ls.Domain();piece.deepCopy(before)
                            ls.BooleanOperation(piece,box(a+undercut,-2,b-undercut,2),ls.BooleanOperationEnum.INTERSECT).apply()
                            if protected is None:protected=piece
                            else:ls.BooleanOperation(protected,piece,ls.BooleanOperationEnum.UNION).apply()
                    chunks=4 if response.get('prLossUm') and ps.Material.Mask in mats else 1
                    for chunk in range(chunks):
                        live_mats=d.getMaterialsInDomain()
                        if chunks>1 and ps.Material.Mask in live_mats:
                            advance(ps.DirectionalProcess(direction=[0.,-1.,0.],directionalVelocity=-response['prLossUm']/chunks,isotropicVelocity=0.,maskMaterial=[v for v in live_mats if v!=ps.Material.Mask],calculateVisibility=False),1.)
                        advance(ps.DirectionalProcess(direction=[0.,-1.,0.],directionalVelocity=-rate*(1-ratio),isotropicVelocity=-rate*ratio,maskMaterial=[a for a in d.getMaterialsInDomain() if a!=m]),duration/chunks)
                    if protected is not None:
                        remaining=d.getMaterialLevelSet(m)
                        ls.BooleanOperation(remaining,protected,ls.BooleanOperationEnum.UNION).apply()
                        replace_material(m,remaining)
                label=f"Etch · {p['material']}"
            elif op=='deposition':
                cmp_stop=surface_top();m=material(p['material']);d.duplicateTopLevelSet(m)
                if p['method']=='Conformal':
                    advance(ps.SphereDistribution(radius=p['rate']*p['time']),0)
                elif p['method'] in ('PVD','CVD'):
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
                if p['method']=='Ion implantation':
                    saved=None;temporary=p['implant_mask']!='Existing'
                    if temporary:
                        if ps.Material.Mask in mats:
                            saved=ls.Domain();saved.deepCopy(d.getMaterialLevelSet(ps.Material.Mask));d.removeMaterial(ps.Material.Mask)
                        spans=openings(dict(pattern=p['implant_mask'],width=p['implant_width'],pitch=p['implant_pitch'],offset=p['implant_offset']),width)
                        stop=complement(spans,width);screen=None;top=surface_top()
                        for a,b in stop:
                            piece=box(a,top+.05,b,top+.15)
                            if screen is None:screen=piece
                            else:ls.BooleanOperation(screen,piece,ls.BooleanOperationEnum.UNION).apply()
                        if saved is not None:
                            if screen is None:screen=ls.Domain();screen.deepCopy(saved)
                            else:ls.BooleanOperation(screen,saved,ls.BooleanOperationEnum.UNION).apply()
                        if screen is not None:d.insertNextLevelSetAsMaterial(screen,ps.Material.Mask,True)
                    try:transport('implant',p)
                    finally:
                        if temporary:
                            d.removeMaterial(ps.Material.Mask)
                            if saved is not None:d.insertNextLevelSetAsMaterial(saved,ps.Material.Mask,True)
                    label=f"Implant · {p['species']}"
                    implanted.add(p['species']);annealed.discard(p['species'])
                elif p['method']=='Anneal':
                    if ps.Material.Mask in mats:raise ValueError('고온 열처리 전에 PR을 제거하세요.')
                    transport('anneal',p);label='Anneal';annealed.update(implanted|diffused)
                elif p['method'] in ('Pre-deposition','Drive-in'):
                    if ps.Material.Mask in mats:raise ValueError('고온 확산 전에 PR을 제거하세요. SiO₂ 또는 Si₃N₄ 확산 마스크를 사용하세요.')
                    source=p['method']=='Pre-deposition'
                    transport('predep' if source else 'drivein',p)
                    if source:diffused.add(p['species'])
                    annealed.update(implanted|diffused);label=p['method']+(' · '+p['species'] if source else '')
                else:
                    if doping_state:raise ValueError('도핑 후 열산화의 재분배는 지원하지 않습니다. 산화와 도핑 실험을 분리하세요.')
                    from planar_oxidation import apply as planar_oxidation
                    planar=planar_oxidation(ps,ls,d,width,p)
                    if planar:
                        d,metric=planar;label=p['method'];oxidized=False
                    else:
                        if ps.Material.SiO2 not in mats:raise ValueError('현재 seed 없는 열산화는 평탄한 Si 표면을 지원합니다. 거칠기·단차 또는 마스크를 확인하세요.')
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
                        advance(model,0);label=p['method'];oxidized=True
            elif op=='cmp' and p['action']=='Cleaning':
                loss=response.get('filmLossUm',0.)
                if loss and ps.Material.SiO2 in mats:
                    advance(ps.DirectionalProcess(direction=[0.,-1.,0.],directionalVelocity=0.,isotropicVelocity=-loss,maskMaterial=[v for v in mats if v!=ps.Material.SiO2],calculateVisibility=False),1.)
                label=p['chemical']+' cleaning'
            elif op=='cmp':
                if cmp_stop is None:raise ValueError('증착 후에 Global planarization을 추가하세요.')
                top=surface_top();cut=max(cmp_stop,top-p['rate']*p['time'])
                ps.Planarize(d,cut).apply();label='C&C';metric={'stopHeightUm':cmp_stop,'cutHeightUm':cut,'removedHeightNm':round((top-cut)*1000,3),'slurryRecord':p['slurry']}
            if doping_state and op!='diffusion':transport('sync',{})
            metric.update(response)
            snap(row.get('label',label),metric)
            if op=='deposition' and not periodic:
                measurement=side_coverage(frames[-2]['polygons'],frames[-1]['polygons'],int(m),metric['topGrowthUm'],width)
                if measurement:frames[-1]['metrics'].update(measurement)
        except (ValueError,RuntimeError,subprocess.TimeoutExpired) as e:
            failure=dict(step=i+1,message=str(e));break
    for i,f in enumerate(frames):f['progress']=i/max(1,len(frames)-1)
    bounds=list(target['bounds'])
    bounds[2]=min(bounds[2],min(f['lowest'] for f in frames)-.08)
    bounds[3]=max(bounds[3],max(f['highest'] for f in frames)+.08)
    if substrate_depth is not None:bounds[2]=-substrate_depth-.04
    return dict(**({'substrateThickness':substrate_depth} if substrate_depth is not None else {}),substrateRoughness=roughness,target=target['id'],view=data.get('view','gate'),section=target['section'],example=target['id'],frames=frames,steps=steps,bounds=bounds,roi=target['roi'],unit='µm',elapsed=round(time.perf_counter()-started,3),failure=failure,model='Native process flow',engine='ViennaPS '+ps.__version__)

if __name__=='__main__':
    result=run(json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')))
    Path(sys.argv[2]).write_text(json.dumps(result,ensure_ascii=False,allow_nan=False),encoding='utf-8')
