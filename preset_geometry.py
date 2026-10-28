"""Explicit educational geometry recipes, not calibrated plasma/device solvers.

All coordinates are µm. Returned material regions use even-odd polygon holes.
The native process recipes remain in engine.py; provenance is carried per result.
"""
import math
import time

IDS = {'cryo','lele','sadp','sti','mbcfet','planarization','stack'}

def poly(material, points):
    pts = [[round(float(x),7),round(float(y),7)] for x,y in points]
    if pts[0] != pts[-1]: pts.append(pts[0][:])
    return dict(material=material,points=pts,closed=True)

def rect(material,x0,y0,x1,y1):
    return poly(material,[(x0,y0),(x1,y0),(x1,y1),(x0,y1)])

def clip_y(points,low,high):
    out=points[:-1] if points[0]==points[-1] else points[:]
    for value,sign in [(low,1),(high,-1)]:
        src=out;out=[]
        if not src:break
        a=src[-1]
        for b in src:
            ain=sign*(a[1]-value)>=-1e-9;bin=sign*(b[1]-value)>=-1e-9
            if ain!=bin:
                t=(value-a[1])/(b[1]-a[1]);out.append([a[0]+t*(b[0]-a[0]),value])
            if bin:out.append(b)
            a=b
    return out

def run(spec,p):
    start=time.perf_counter();kind=spec['id'];frames=[]
    def snap(label,regions):
        points=[pt for r in regions for pt in r['points']]
        frames.append(dict(label=label,polygons=regions,lowest=min(y for x,y in points),highest=max(y for x,y in points)))
    if kind=='cryo':
        # Prescribed vertical rate + wall angle; rounded bottom, no scallops.
        depth=p['duration']/60*p['rate'];a=p['width']/2;extent=max(1.1,a+.45)
        base=-depth-.28
        def cavity(d):
            bottom=max(a*.25,a-d/math.tan(math.radians(p['angle'])))
            radius=min(bottom,d*.15)
            pts=[(-extent,0),(-a,0),(-bottom,-d+radius)]
            for i in range(13):
                t=math.pi+math.pi/2*i/12
                pts.append((-bottom+radius+radius*math.cos(t),-d+radius+radius*math.sin(t)))
            pts.append((bottom-radius,-d))
            for i in range(13):
                t=-math.pi/2+math.pi/2*i/12
                pts.append((bottom-radius+radius*math.cos(t),-d+radius+radius*math.sin(t)))
            pts += [(a,0),(extent,0),(extent,base),(-extent,base)]
            return poly(10,pts)
        mask=[rect(0,-extent,0,-a,.22),rect(0,a,0,extent,.22)]
        snap('마스크 · Si', [rect(10,-extent,base,extent,0)]+mask)
        snap('저온 식각 · 중간', [cavity(depth*.5)]+mask)
        snap('저온 식각 · 최종', [cavity(depth)]+mask)
        bounds=[-extent-.12,extent+.12,base-.08,.36]
    elif kind in ('lele','sadp'):
        pitch=p['pitch'];centers=[-pitch,0,pitch];extent=1.8*pitch
        base=[rect(10,-extent,-.2,extent,-.04)]
        target=rect(16,-extent,-.04,extent,.09)
        if kind=='lele':
            cd=p['cd'];first=[rect(30,c-cd/2,.09,c+cd/2,.25) for c in centers]
            second=[rect(0,c+pitch/2+p['overlay']-cd/2,.09,c+pitch/2+p['overlay']+cd/2,.25) for c in centers[:-1]]
            snap('박막 증착',base+[target,rect(30,-extent,.09,extent,.25)])
            snap('1차 패턴 식각',base+[target]+first)
            snap('2차 패턴 식각',base+[target]+first+second)
            lines=[(c-cd/2,c+cd/2) for c in centers]+[(c+pitch/2+p['overlay']-cd/2,c+pitch/2+p['overlay']+cd/2) for c in centers[:-1]]
            snap('하부막 패턴 전사',base+[rect(16,l,-.04,r,.09) for l,r in sorted(lines)])
        else:
            a=p['mandrel']/2;s=p['spacer'];top=.27
            mandrels=[rect(0,c-a,.09,c+a,top) for c in centers]
            snap('Mandrel 식각',base+[target]+mandrels)
            # Continuous blanket plus three U-shaped, disjoint conformal shells.
            coat=[rect(30,-extent,.09,extent,.09+s)]
            for c in centers:
                coat.append(poly(30,[(c-a-s,.09+s),(c-a-s,top+s),(c+a+s,top+s),(c+a+s,.09+s),(c+a,.09+s),(c+a,top),(c-a,top),(c-a,.09+s)]))
            snap('스페이서 증착',base+[target]+mandrels+coat)
            spacers=[rect(30,c+sign*a-(s if sign<0 else 0),.09,c+sign*a+(s if sign>0 else 0),top) for c in centers for sign in [-1,1]]
            snap('스페이서 Etch-back',base+[target]+mandrels+spacers)
            snap('Mandrel 제거',base+[target]+spacers)
            snap('하부막 패턴 전사',base+[rect(16,r['points'][0][0],-.04,r['points'][1][0],.09) for r in spacers])
        bounds=[-extent-.06,extent+.06,-.25,.4]
    elif kind=='sti':
        a=p['width']/2;d=p['depth'];b=max(.04,a-d/math.tan(math.radians(p['angle'])));base=-d-.2
        substrate=poly(10,[(-1,base),(1,base),(1,0),(a,0),(b,-d),(-b,-d),(-a,0),(-1,0)])
        mask=[rect(16,-1,.025,-a,.10),rect(16,a,.025,1,.10)]
        pad=[rect(30,-1,0,-a,.025),rect(30,a,0,1,.025)]
        snap('기판 · 보호막',[rect(10,-1,base,1,0),rect(30,-1,0,1,.025),rect(16,-1,.025,1,.10)])
        snap('트렌치 식각',[substrate]+pad+mask)
        fill=poly(30,[(-1,0),(-a,0),(-b,-d),(b,-d),(a,0),(1,0),(1,.24),(-1,.24)])
        # The oxide fills the ideal cavity and covers the nitride masks.
        snap('산화막 충전',[substrate,fill]+mask)
        top=p['cmp']
        oxide=poly(30,[(-1,0),(-a,0),(-b,-d),(b,-d),(a,0),(1,0),(1,top),(-1,top)])
        snap('CMP · 보호막 제거',[substrate,oxide])
        bounds=[-1.1,1.1,base-.06,.34]
    elif kind=='mbcfet':
        n=int(p['sheets']);a=p['width']/2;t=p['thickness'];gap=p['gap'];pedestal=.06
        base=[rect(10,-.5,-.2,.5,0)]
        def stack(half):
            regions=[];channels=[];y=pedestal
            for i in range(n):
                regions.append(rect(13,-half,y,half,y+gap));y+=gap
                channels.append(rect(10,-half,y,half,y+t));y+=t
            return regions+channels,channels,y
        blanket,_,top=stack(.5)
        snap('Si / SiGe 적층',base+[rect(10,-.5,0,.5,pedestal)]+blanket)
        layers,channels,top=stack(a)
        finbase=base+[rect(10,-a,0,a,pedestal)]
        snap('Fin 식각',finbase+layers)
        sti=[rect(30,-.5,0,-a,pedestal),rect(30,a,0,.5,pedestal)]
        snap('STI 충전 · Recess',finbase+sti+layers)
        snap('SiGe 제거 · 채널 분리',finbase+sti+channels)
        oxide=[];gate=[rect(79,-a-.08,pedestal,a+.08,top+.055)]
        for ch in channels:
            y0=ch['points'][0][1];y1=ch['points'][2][1];k=.005
            outer=rect(32,-a-k,y0-k,a+k,y1+k)
            oxide += [outer,rect(32,-a,y0,a,y1)]
            gate.append(rect(79,-a-k,y0-k,a+k,y1+k))
        snap('HfO₂ · TiN 형성',finbase+sti+channels+gate+oxide)
        bounds=[-.57,.57,-.24,top+.12]
    elif kind=='planarization':
        h=p['height'];film=p['film'];target=p['target'];extent=1.2
        centers=[-.65,-.25,.15];half=.11
        base=[rect(10,-extent,-.18,extent,0)]
        blocks=[rect(5,c-half,0,c+half,h) for c in centers]
        xs=[-extent+i*2*extent/480 for i in range(481)]
        initial=[film+(h if any(abs(x-c)<half for c in centers) else 0) for x in xs]
        def region(heights):return poly(30,[(-extent,0),(extent,0)]+list(zip(xs,heights))[::-1])
        snap('단차 위 박막 증착',base+[region(initial)]+blocks)
        # Gaussian spatial averaging is a visual smoothing model, not CMP kinetics.
        smooth=[]
        for i,x in enumerate(xs):
            weights=[(j,math.exp(-((j-i)/14)**2/2)) for j in range(max(0,i-42),min(len(xs),i+43))]
            smooth.append(sum(initial[j]*w for j,w in weights)/sum(w for j,w in weights))
        snap('Smoothing',base+[region(smooth)]+blocks)
        local=[film+h*.55*(math.tanh((x+.85)/.09)-math.tanh((x-.35)/.09))/2 for x in xs]
        snap('Local planarization',base+[region(local)]+blocks)
        final=[min(y,target) for y in local]
        kept=[rect(5,c-half,0,c+half,min(h,target)) for c in centers]
        snap('Global CMP · 목표 높이',base+[region(final)]+kept)
        bounds=[-1.3,1.3,-.23,h+film+.12]
    elif kind=='stack':
        count=int(p['layers']);th=.25;base=-count*th-.3;extent=1.;a=p['width']/2
        def state(duration):
            remaining=duration;d=0
            for i in range(count):
                rate=.5*(p['ratio'] if i%2 else 1.)
                advance=min(th,remaining*rate);d+=advance;remaining-=advance/rate
                if remaining<=0:break
            if remaining>0:d+=min(.2,remaining*.5)
            layers=[rect(10,-extent,base,extent,-count*th)]
            layers += [rect(30 if i%2==0 else 16,-extent,-(i+1)*th,extent,-i*th) for i in range(count)]
            if d>0:
                side=[]
                for j in range(101):
                    u=j/100;y=-d*u
                    width=a*(1-.25*u*u)
                    if u>.88:width*=math.sqrt(max(0,1-((u-.88)/.12)**2))
                    side.append([width,y])
                cavity=[[-a,0]]+[[-x,y] for x,y in side[1:]]+side[-2::-1]
                for layer in layers[:]:
                    ys=[pt[1] for pt in layer['points']];cut=clip_y(cavity,min(ys),max(ys))
                    if len(cut)>2:layers.append(poly(layer['material'],cut))
            return layers+[rect(0,-extent,0,-a,.3),rect(0,a,0,extent,.3)]
        snap('산화막 / 질화막 적층',state(0))
        snap('적층 식각 · 중간',state(p['duration']*.5))
        snap('적층 식각 · 최종',state(p['duration']))
        bounds=[-1.12,1.12,base-.08,.42]
    else:raise ValueError('Unknown geometry recipe')
    for i,f in enumerate(frames):f['progress']=i/(len(frames)-1)
    return dict(example=kind,params=p,frames=frames,bounds=bounds,previewFrame=len(frames)-1,unit='µm',elapsed=round(time.perf_counter()-start,3),engine='Educational geometry',mode='geometry',model=spec['model'],note=spec['note'],source=spec['source'])

def compact_native(result):
    """Expose major operations only; keep native result geometry unchanged."""
    frames=result['frames'];kind=result['example'];n=len(frames)
    selections={
        'bosch':[(0,'마스크 · Si'),(1,'초기 식각'),(3,'보호막 증착 · 바닥 개방'),(4,'1회 식각'),(n-1,'반복 식각 · 최종')],
        'wet':[(0,'마스크 · Si'),(3,'습식 식각 · 중간'),(n-1,'습식 식각 · 최종')],
        'sf6':[(0,'마스크 · Si'),(3,'SF₆/O₂ 식각 · 중간'),(n-1,'SF₆/O₂ 식각 · 최종')],
        'locos':[(0,'Pad oxide · 질화막'),(3,'선택 열산화'),(4,'질화막 제거')],
        'mosfet':[(0,'Si 기판'),(1,'게이트 산화막'),(3,'게이트 증착 · 식각'),(5,'스페이서 형성'),(7,'절연막 충전 · CMP'),(n-1,'접촉부 형성')],
        'finfet':[(0,'Si 기판'),(3,'Fin 식각'),(6,'STI 충전 · Recess'),(7,'HfO₂ 증착'),(n-1,'게이트 형성')],
        'fin':[(0,'Si 기판'),(3,'Fin 식각'),(5,'산화막 충전 · CMP'),(n-1,'STI Recess')],
    }.get(kind,[(i,f['label']) for i,f in enumerate(frames)])
    result['frames']=[dict(frames[i],label=label,progress=j/(len(selections)-1)) for j,(i,label) in enumerate(selections)]
    result['previewFrame']=1 if kind=='locos' else len(selections)-1
    return result
