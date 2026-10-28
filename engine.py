"""Run one isolated ViennaPS calculation and export native 2D mesh contours."""
import os
os.environ.setdefault("OMP_NUM_THREADS", "2")
import json
import sys
import time
from pathlib import Path
from collections import defaultdict
from importlib.metadata import version
import native_runtime
import viennaps as ps
import viennals as ls
from catalog import validate


def contour_mesh(mesh, default_material=10, force_material=False, x_bounds=None, boundary_tolerance=1e-6):
    nodes = mesh.getNodes()
    lines = mesh.getLines()
    cell = mesh.getCellData()
    ids = [default_material] * len(lines)
    if not force_material:
        for i in range(cell.getScalarDataSize()):
            if cell.getScalarDataLabel(i) == "MaterialIds": ids = cell.getScalarData(i)
    groups = defaultdict(list)
    for line, material in zip(lines, ids): groups[int(material)].append(line)
    polygons = []
    for material, edges in groups.items():
        # Weld geometric duplicates produced at material/domain boundaries.
        coords, lookup, converted = [], {}, []
        for edge in edges:
            pair = []
            for index in edge:
                p = tuple(round(float(v), 7) for v in nodes[index][:2])
                if p not in lookup:
                    lookup[p] = len(coords); coords.append(p)
                pair.append(lookup[p])
            if pair[0] != pair[1]: converted.append(pair)
        adj = defaultdict(list)
        for i, (a,b) in enumerate(converted):
            adj[a].append((i,b)); adj[b].append((i,a))
        # Native hull extraction can omit a clipping cap at a reflective x edge.
        # Close only endpoint pairs on that same domain boundary, never interior
        # gaps. This changes the exported polygon cap, not the solved surface.
        if x_bounds:
            for edge_x in x_bounds:
                ends=sorted((k for k,v in adj.items() if len(v)%2 and abs(coords[k][0]-edge_x)<=boundary_tolerance),key=lambda k:coords[k][1])
                if len(ends)%2:continue
                for a,b in zip(ends[::2],ends[1::2]):
                    index=len(converted);converted.append((a,b));adj[a].append((index,b));adj[b].append((index,a))
        unused = set(range(len(converted)))
        while unused:
            first = next(iter(unused)); start = converted[first][0]
            current, path = start, [start]
            while True:
                choices = [(e,n) for e,n in adj[current] if e in unused]
                if not choices: break
                edge, nxt = choices[0]; unused.remove(edge); path.append(nxt); current=nxt
                if current == start: break
            area=abs(sum(coords[a][0]*coords[b][1]-coords[b][0]*coords[a][1] for a,b in zip(path,path[1:])))
            if len(path) > 3 and area>1e-12:
                polygons.append(dict(material=material, closed=path[0]==path[-1], points=[coords[i] for i in path]))
    return polygons


def run(data):
    spec, p = validate(data)
    from process_presets import IDS as process_ids,run as process_run
    if spec['id'] in process_ids:return process_run(spec,p)
    from advanced_devices import SOURCES,simulate
    if spec['id'] in SOURCES:return simulate(spec,p)
    from learning_examples import IDS as learning_ids, run as run_learning
    if spec['id'] in learning_ids:
        return run_learning(spec, p)
    if spec['id'] in ('mosfet','finfet','mbcfet','sti','locos','fin'):
        from native_presets import run as run_preset
        return run_preset(spec,p)
    from preset_geometry import IDS, run as run_geometry, compact_native
    if spec['id'] in IDS:
        return run_geometry(spec,p)
    ps.setDimension(2); ls.setDimension(2); ps.setNumThreads(1)
    ps.Logger.setLogLevel(ps.LogLevel.INFO if os.environ.get("SIMULATION_DEBUG") else ps.LogLevel.ERROR)
    ps.Length.setUnit("nm" if spec["id"] == "regrowth" else "um")
    ps.Time.setUnit("s")
    frames=[]; start=time.perf_counter()
    domain=None

    def snap(label, progress):
        print(label, flush=True)
        polygons=[]
        for material in sorted(domain.getMaterialsInDomain(),key=int):
            level=domain.getMaterialLevelSet(material)
            hull=ls.Mesh(); converter=ls.ToHullMesh(hull,level)
            converter.setBottomExtension(3 if spec["unit"]=="µm" else 60); converter.apply()
            polygons.extend(contour_mesh(hull,int(material),True))
        if spec['id']=='regrowth':
            # The native transport example stores regrown oxide in the Polymer
            # level-set slot. Export its actual material for a shared palette.
            for region in polygons:
                if region['material']==1:region['material']=30
        surface=domain.getSurfaceMesh(False)
        points=surface.getNodes()
        if not polygons: raise RuntimeError("빈 구조: "+label)
        frames.append(dict(label=label, progress=progress, polygons=polygons,
                           lowest=min((q[1] for q in points),default=0), highest=max((q[1] for q in points),default=0)))

    def advance(model, duration, particles=False, stencil=False):
        proc=ps.Process(domain,model,duration)
        if particles:
            rp=ps.RayTracingParameters(); rp.raysPerPoint=100; rp.useRandomSeeds=False; rp.rngSeed=1729; proc.setParameters(rp)
        if stencil:
            ap=ps.AdvectionParameters(); ap.spatialScheme=ps.SpatialScheme.STENCIL_LOCAL_LAX_FRIEDRICHS_1ST_ORDER; proc.setParameters(ap)
        proc.apply()

    kind=spec["id"]
    if kind in ("bosch","trench","sf6","wet"):
        grid=.025 if kind=="sf6" else .02 if kind=="bosch" else .04
        extent=1.4 if kind=="sf6" else 4.0
        domain=ps.Domain(gridDelta=grid,xExtent=extent,yExtent=extent)
        ps.MakeTrench(domain=domain,trenchWidth=p["width"],trenchDepth=p.get("depth",0),maskHeight=0 if kind=="trench" else .4).apply()
        if kind=="trench": domain.duplicateTopLevelSet(ps.Material.SiO2)
        snap("초기 구조",0)
        if kind=="bosch":
            direction=[0.,-1.,0.]
            etch=ps.DirectionalProcess(direction=direction,directionalVelocity=-.1,isotropicVelocity=-.2,maskMaterial=[ps.Material.Mask,ps.Material.Polymer])
            cycles=int(p["cycles"])
            advance(etch,p["etch_time"])
            snap("초기 트렌치 식각",.05)
            for n in range(cycles):
                domain.duplicateTopLevelSet(ps.Material.Polymer)
                advance(ps.SphereDistribution(radius=p["coating"]),1)
                snap(f"{n+1}회 · 보호막 형성",.05+.95*(n+.25)/cycles)
                advance(ps.DirectionalProcess(direction=direction,directionalVelocity=-(p["coating"]+.04),isotropicVelocity=0.,maskMaterial=ps.Material.Mask),1)
                snap(f"{n+1}회 · 바닥 개방",.05+.95*(n+.5)/cycles)
                advance(ps.DirectionalProcess(direction=direction,directionalVelocity=-.1,isotropicVelocity=-.2,maskMaterial=[ps.Material.Mask,ps.Material.Polymer]),p["etch_time"])
                domain.removeTopLevelSet()
                snap(f"{n+1}회 · 식각·보호막 제거",.05+.95*(n+1)/cycles)
        else:
            if kind=="trench":
                model=ps.SingleParticleProcess(rate=.3,stickingProbability=p["sticking"],sourceExponent=1.)
            elif kind=="sf6":
                mp=ps.SF6O2Etching.defaultParameters()
                mp.ionFlux=10.; mp.etchantFlux=4500.; mp.passivationFlux=p["oxygen"]
                mp.Ions.meanEnergy=p["energy"]; mp.Ions.sigmaEnergy=10.; mp.Ions.exponent=1000.
                mp.Passivation.A_ie=2.; mp.Substrate.A_ie=7.; mp.etchStopDepth=-3.
                model=ps.SF6O2Etching(mp)
            else:
                model=ps.WetEtching(direction100=[1.,0.,0.],direction010=[0.,1.,0.],rate100=.797/60,rate110=1.455/60*p["anisotropy"],rate111=.005/60,rate311=1.436/60,materialRates=[(ps.Material.Si,-1.)])
            duration=p["duration"]*(60 if kind=="sf6" else 1)
            for n in range(1,6):
                advance(model,duration/5,kind in ("trench","sf6"),kind=="wet")
                snap(f"{p['duration']*n/5:.2f} {'min' if kind=='sf6' else 's'}",n/5)
    elif kind=="epi":
        domain=ps.Domain(.04,4.,4.); ps.MakeFin(domain,p["width"],.8).apply()
        ps.MakePlane(domain,.2,ps.Material.SiO2,True).apply()
        domain.duplicateTopLevelSet(ps.Material.SiGe); snap("초기 구조",0)
        model=ps.SelectiveEpitaxy(materialRates=[(ps.Material.Si,.25),(ps.Material.SiGe,.25)],rate111=p["ratio"],rate100=1.)
        for n in range(1,6):
            advance(model,p["duration"]/5,stencil=True); snap(f"{p['duration']*n/5:.2f} s",n/5)
    elif kind=="regrowth":
        domain=ps.Domain(4.,160.,100.); top=30+int(p["layers"])*20
        ps.MakeStack(domain=domain,numLayers=int(p["layers"]),layerHeight=20.,substrateHeight=30.,holeRadius=0.,trenchWidth=60.,maskHeight=0.).apply()
        domain.duplicateTopLevelSet(ps.Material.Polymer)
        domain.generateCellSet(top+10.,ps.Material.GAS,True)
        cells=domain.getCellSet(); cells.addScalarData("byproductSum",0.); cells.buildNeighborhood()
        model=ps.OxideRegrowth(6.5/60.,0.,p["redeposition"],.2,20.,50.,.1,5.,7.5,top,60.,.245)
        snap("초기 적층",0)
        for n in range(1,4):
            proc=ps.Process(domain,model,p["duration"]/3); ap=ps.AdvectionParameters(); ap.ignoreVoids=True; proc.setParameters(ap); proc.apply()
            snap(f"{p['duration']*n/3:.0f} s",n/3)
    elif kind=="gds":
        grid=.02
        mask=ps.GDSGeometry(grid,[ps.BoundaryType.REFLECTIVE_BOUNDARY]*2)
        mask.setBoundaryPadding(.3,.3)
        # Native sigmas are in grid-cell units; configure blur before reading GDS.
        mask.addBlur(sigmas=[p["sigma"]/grid,p["sigma"]*3/grid],weights=[.8,.2],threshold=p["threshold"],delta=grid,gridRefinement=2)
        gds=Path(__file__).parent/"assets"/"myTest.gds"
        if not gds.exists():gds=Path(__file__).parent/"myTest.gds"
        ps.GDSReader(mask,str(gds)).apply()
        layers=sorted(mask.getAllLayers()); layer=layers[0]
        for blur in (False,True):
            level=mask.layerToLevelSet(layer,blurLayer=blur); mesh=ls.Mesh(); ls.ToSurfaceMesh(level,mesh).apply()
            pts=mesh.getNodes()
            if not pts: raise RuntimeError("이 블러·임계값에서는 패턴이 소실됩니다. 블러 길이나 임계값을 줄여 주세요.")
            frames.append(dict(label="블러 적용" if blur else "원본 마스크",progress=int(blur),polygons=contour_mesh(mesh,0),lowest=min(q[1] for q in pts),highest=max(q[1] for q in pts)))
    elif kind=='rie':
        domain=ps.Domain(gridDelta=.02,xExtent=3.,yExtent=3.)
        ps.MakePlane(domain,0.,ps.Material.Si).apply()
        ps.MakePlane(domain,.7,ps.Material.SiO2,True).apply()
        snap('산화막 증착',0)
        a=p['width']/2
        for x0,x1 in [(-1.5,-.6-a),(-.6+a,.6-a),(.6+a,1.5)]:
            level=ls.Domain(domain.getGrid());ls.MakeGeometry(level,ls.Box([x0,.7],[x1,.85])).apply()
            domain.insertNextLevelSetAsMaterial(level,ps.Material.Mask,True)
        snap('식각 마스크',.2)
        model=ps.DirectionalProcess(direction=[0.,-1.,0.],directionalVelocity=-p['rate']*(1-p['lateral']),isotropicVelocity=-p['rate']*p['lateral'],maskMaterial=[ps.Material.Mask,ps.Material.Si])
        advance(model,p['duration']/2);snap('RIE 식각 · 중간',.6)
        advance(model,p['duration']/2);snap('RIE 식각 · 최종',1.)
    elif kind in ("mosfet","finfet","fin"):
        domain=ps.Domain(gridDelta=.01,xExtent=1.6 if kind=="mosfet" else .9,yExtent=2.)
        def box(x0,y0,x1,y1):
            level=ls.Domain(domain.getGrid());ls.MakeGeometry(level,ls.Box([x0,y0],[x1,y1])).apply();return level
        def add_box(material,x0,y0,x1,y1):
            domain.insertNextLevelSetAsMaterial(box(x0,y0,x1,y1),material,True)
        def coat(material,thickness):
            domain.duplicateTopLevelSet(material);advance(ps.SphereDistribution(radius=thickness),0)
        ps.MakePlane(domain,0.,ps.Material.Si).apply();snap("Si 기판",0)
        if kind=="mosfet":
            ox=p["oxide"]; half=p["gate_length"]/2; top=ox+.25
            coat(ps.Material.SiO2,ox);snap("게이트 산화막 · 지정 두께",.1)
            ps.MakePlane(domain,top,ps.Material.PolySi,True).apply();snap("Poly-Si blanket 증착",.2)
            domain.removeMaterial(ps.Material.PolySi)
            add_box(ps.Material.PolySi,-half,ox-.001,half,top);snap("게이트 패턴 · Boolean",.3)
            coat(ps.Material.Si3N4,p["spacer"]);snap("스페이서 conformal 증착",.4)
            dist=ps.DirectionalProcess(direction=[0.,-1.,0.],directionalVelocity=-1.,isotropicVelocity=0.,maskMaterial=[ps.Material.Si,ps.Material.SiO2,ps.Material.PolySi])
            advance(dist,p["spacer"]+.015);snap("스페이서 방향성 제거",.5)
            ps.MakePlane(domain,top+.1,ps.Material.Dielectric,True).apply();snap("층간 절연막 충전",.6)
            ps.Planarize(domain,top+.05).apply();snap("절연막 CMP · 지정 높이",.7)
            # Level sets are cumulative: cut every upper level, even where its
            # named material is absent, to avoid assigning ghost material below a contact.
            contact=(half+p["spacer"]+.12+.7)/2
            for center in (-contact,contact):
                window=box(center-.045,0.,center+.045,top+.1)
                for idx,level in enumerate(domain.getLevelSets()):
                    if domain.getMaterialMap().getMaterialAtIdx(idx)!=ps.Material.Si:
                        ls.BooleanOperation(level,window,ls.BooleanOperationEnum.RELATIVE_COMPLEMENT).apply()
            snap("접촉 개구 · 지정 위치",.8)
            for center in (-contact,contact):add_box(ps.Material.Metal,center-.045,0.,center+.045,top+.05)
            snap("S/D 위치 금속 접촉 · 도핑 미포함",1.)
        else:
            h=p["height"];half=p["width"]/2
            add_box(ps.Material.Mask,-half,-.001,half,.06);snap("fin 하드마스크",.12)
            advance(ps.DirectionalProcess(direction=[0.,-1.,0.],directionalVelocity=-1.,maskMaterial=ps.Material.Mask),h)
            snap("Si fin 방향성 식각",.25)
            domain.removeMaterial(ps.Material.Mask);snap("하드마스크 제거",.37)
            ps.MakePlane(domain,.05,ps.Material.SiO2,True).apply();snap("STI 절연막 충전",.5)
            ps.Planarize(domain,0.).apply();snap("STI CMP",.62)
            # Recess oxide alone, preserving the fin with a material mask.
            dist=ps.DirectionalProcess(direction=[0.,-1.,0.],directionalVelocity=-1.,maskMaterial=ps.Material.Si);advance(dist,h*p.get('recess',60)/100)
            snap("STI recess · fin 노출",.75)
            if kind=='finfet':
                coat(ps.Material.HfO2,p["oxide"]);snap("HfO₂ conformal 증착",.87)
                coat(ps.Material.TiN,p["gate"]);snap("게이트 증착 · 횡단면",1.)
    elif kind=="locos":
        grid=.025; extent=.7 if kind=='fin' else .2
        domain=ps.Domain(gridDelta=grid,xExtent=2*extent,boundary=ps.BoundaryType.REFLECTIVE_BOUNDARY)
        if kind=="fin":
            ps.MakeFin(domain,p["width"],.5).apply(); domain.duplicateTopLevelSet(ps.Material.SiO2)
            advance(ps.SphereDistribution(radius=grid),1)
        else:
            ps.MakePlane(domain,0.,ps.Material.Si).apply(); ps.MakePlane(domain,.025,ps.Material.SiO2,True).apply()
            # Solve a reflective half-period (mask centre to opening centre).
            # Reflect this solved cell four times below, producing two islands
            # without the unconstrained floating-mask mechanics singularity.
            mask=ls.Domain(domain.getGrid())
            geom=ls.MakeGeometry(mask,ls.Box([-extent,.025-1e-6],[0.,.025+p['mask']]))
            geom.setIgnoreBoundaryConditions([False,True,False]);geom.apply()
            domain.insertNextLevelSetAsMaterial(mask,ps.Material.Si3N4,False)
        snap("초기 산화막 포함" if kind=='fin' else 'Pad oxide · 좌우 질화막',0)
        model=ps.Oxidation(); model.setTemperature(p["temperature"]); model.setPressure(1.)
        model.setOxidant(getattr(ps.OxidantType,'WET',getattr(ps.OxidantType,'Wet',None))); model.setOrientation(ps.SiliconOrientation.Si100)
        model.setInitialOxideThickness(grid if kind=="fin" else .025); model.setMaxGridPoints(200000)
        for n in range(1,4):
            model.setTime(p["duration"]/3); model.setTimeStep(p["duration"]/6)
            advance(model,0); snap(f"열산화 · {p['duration']*n/3:.3f} h",n/3 if kind=='fin' else n/4)
        if kind=='locos':
            domain.removeMaterial(ps.Material.Si3N4)
            snap('질화막 제거 · 산화막 단면',1.)
            # Merge shared edges so the displayed periodic extension has no
            # artificial vertical seams, including in 2.5D and PNG exports.
            for f in frames:
                edge_groups=defaultdict(dict)
                for poly in f['polygons']:
                    for sign,shift in [(-1,-.6),(1,-.2),(-1,.2),(1,.6)]:
                        points=[(round(sign*x+shift,6),round(y,6)) for x,y in poly['points']]
                        for a,b in zip(points,points[1:]+points[:1]):
                            if a==b:continue
                            key=tuple(sorted((a,b)));edges=edge_groups[poly['material']]
                            if key in edges:del edges[key]
                            else:edges[key]=(a,b)
                merged=[]
                for material,edges in edge_groups.items():
                    adjacency=defaultdict(list)
                    for key,(a,b) in edges.items():adjacency[a].append((key,b));adjacency[b].append((key,a))
                    remaining=set(edges)
                    while remaining:
                        key=next(iter(remaining));start_point=edges[key][0];point=start_point;path=[point]
                        while True:
                            options=[e for e in adjacency[point] if e[0] in remaining]
                            if not options:break
                            key,point=options[0];remaining.remove(key);path.append(point)
                            if point==start_point:break
                        merged.append(dict(material=material,closed=path[0]==path[-1],points=path))
                f['polygons']=merged

    if not frames or any(not f["polygons"] for f in frames): raise RuntimeError("계산된 구조가 비어 있습니다.")
    all_points=[pt for f in frames for poly in f["polygons"] for pt in poly["points"]]
    xmin=min(p[0] for p in all_points); xmax=max(p[0] for p in all_points)
    if kind=="gds":
        ymin=min(p[1] for p in all_points); ymax=max(p[1] for p in all_points)
    else:
        ymin=min(f["lowest"] for f in frames); ymax=max(f["highest"] for f in frames)
    pad=max((xmax-xmin)*.1,(ymax-ymin)*.12,.02)
    bounds=[xmin-pad,xmax+pad,ymin-pad,ymax+pad]
    if kind=='locos':bounds=[-.86,.86,-.28,max(.24,max(f['highest'] for f in frames)+.05)]
    if kind=='rie':bounds=[-1.65,1.65,-.3,1.05]
    return compact_native(dict(example=kind,params=p,frames=frames,bounds=bounds,previewFrame=len(frames)-2 if kind=='locos' else len(frames)-1,
                unit=spec["unit"],elapsed=round(time.perf_counter()-start,3),
                engine="ViennaPS "+version("ViennaPS"),viennals=version("ViennaLS"),
                mode=spec.get("mode","physics"),model=spec["model"],note=spec["note"],source=spec["source"]))

if __name__=="__main__":
    result=run(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")))
    Path(sys.argv[2]).write_text(json.dumps(result,ensure_ascii=False,allow_nan=False),encoding="utf-8")
