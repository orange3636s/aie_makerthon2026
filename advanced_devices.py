"""Manufacturer-informed teaching cross-sections, computed by native processes.

Recipes are scaled process modules, not foundry recipes or electrical TCAD.
All dimensions are micrometres. Sources describe architecture, not these values.
"""
SOURCES = {
 'rcat': ('Samsung · recessed channel', 'https://patents.google.com/patent/US7361537B2/en', 'recess channel / gate cross-sections; Fig. 13 array'),
 'bcat': ('Samsung · buried gate', 'https://patents.google.com/patent/US20150221742A1/en', 'Fig. 1 · buried gate / capping cross-section'),
 'fdsoi': ('STMicroelectronics · FD-SOI', 'https://www.st.com/content/st_com/en/about/innovation-and-technology/fd-soi.html', 'FD-SOI transistor illustration'),
 'pdsoi': ('IBM · partially depleted SOI', 'https://patents.google.com/patent/US7460422B2/en', 'Fig. 1'),
 'gaafet': ('Samsung · GAA DTCO', 'https://semiconductor.samsung.com/news-events/tech-blog/gaa-dtco-for-ppa/', 'Fig. 4 · nanowire / nanosheet'),
 'cfet': ('Intel · stacked complementary transistors', 'https://download.intel.com/newsroom/archive/2025/en-us-2023-12-09-intel-demonstrates-breakthroughs-in-nextgeneration-transistor-scaling-for-future-nodes.pdf', 'p. 3 · stacked CMOS'),
 'charge-trap': ('Samsung · SONOS cell', 'https://patents.google.com/patent/US20060043469A1/en', 'Fig. 1 · conventional planar SONOS reference'),
 'pn-junction': ('Toshiba · PN junction', 'https://toshiba-semicon-storage.com/content/dam/toshiba-ss-v3/master/en/semiconductor/knowledge/e-learning/discrete/discrete-basic-chap1_en.pdf', 'PN junction fundamentals'),
}

def labelled(label, row):
    return dict(row, label=label)

def recipe(kind, p=None):
    from reverse_catalog import dep, ald, photo, etch, strip, remove, step
    p = p or {}; L=labelled
    def implant(species='P', dose=1e13, energy=10):
        return step('diffusion',method='Ion implantation',species=species,energy=energy,dose=dose)
    def anneal():return step('diffusion',method='Anneal',temperature=1000,time=p.get('anneal',20))
    if kind in ('rcat','bcat'):
        w=p.get('width',.34); depth=p.get('depth',.28); ox=p.get('oxide',.02)
        r=[L('Hardmask · Si₃N₄',ald('Si3N4',.06)),L('Recess opening',photo(w,'Positive')),
           L('Hardmask etch',etch('Si3N4',.08)),L('Channel recess',etch('Si',depth,.05)),
           L('PR strip',strip()),L('Gate dielectric',ald('SiO2',ox))]
        fill=dep('PolySi' if kind=='rcat' else 'Metal',.42)
        fill['params'].update(sticking=.01,exponent=10.)
        if kind=='rcat':
            r += [L('Recess gate fill',fill),L('Gate thickness etchback',etch('PolySi',.25)),L('Gate pattern',photo(w+.16)),
                  L('Gate etch',etch('PolySi',.5)),L('PR strip',strip()),
                  L('Exposed oxide removal',etch('SiO2',ox+.015)),L('Hardmask removal',remove('Si3N4')),
                  L('Spacer deposition',ald('Si3N4',.03)),L('Spacer etchback',etch('Si3N4',.04))]
        else:
            r += [L('Buried gate fill',fill),L('Gate CMP',step('cmp')),
                  L('Gate recess etch',etch('Metal',p.get('burial',.16))),
                  L('Nitride gate cap',dep('Si3N4',.3)),L('Cap CMP',step('cmp')),
                  L('Exposed oxide removal',etch('SiO2',ox+.015)),L('Cap / pad etchback',etch('Si3N4',.075))]
        return r+[L('Source / drain implant',implant()),L('Dopant activation',anneal())]
    if kind in ('fdsoi','pdsoi'):
        length=p.get('length',.32);ox=p.get('oxide',.02)
        return [L('Gate dielectric',ald('SiO2',ox)),L('Gate deposition',dep('PolySi',.14,'PVD')),
                L('Gate pattern',photo(length)),L('Gate etch',etch('PolySi',.17)),L('PR strip',strip()),
                L('Exposed oxide removal',etch('SiO2',ox+.01)),L('Spacer deposition',ald('Si3N4',.025)),
                L('Spacer etchback',etch('Si3N4',.035)),L('Source / drain implant',implant(energy=8)),
                L('Activation anneal',anneal())]
    if kind in ('gaafet','cfet'):
        w=p.get('width',.07 if kind=='gaafet' else .18);h=p.get('channel',.06)
        def channel_module(gate, prefix, gap=.08):
            return [L(prefix+' · sacrificial layer',dep('SiGe',gap,'PVD')),
                    L(prefix+' · Si channel layer',dep('Si',h,'PVD')),
                    L(prefix+' · channel pattern',photo(w)),L(prefix+' · Si etch',etch('Si',h+.01)),
                    L(prefix+' · SiGe etch',etch('SiGe',gap+.02)),L(prefix+' · PR strip',strip()),
                    L(prefix+' · channel release',remove('SiGe')),L(prefix+' · gate dielectric',ald('HfO2',.015)),
                    L(prefix+' · wrap gate',ald(gate,.035))]
        r=channel_module('TiN','Lower FET' if kind=='cfet' else 'Nanowire')
        if kind=='cfet':
            r += [L('Inter-tier dielectric fill',dep('SiO2',.28)),L('Inter-tier CMP',step('cmp')),
                  L('Inter-tier isolation cap',ald('SiO2',p.get('isolation',.06)))]
            r += channel_module('Metal','Upper FET')
        return r
    if kind=='charge-trap':
        tunnel=p.get('tunnel',.02); trap=p.get('trap',.035);block=p.get('block',.03)
        return [L('Tunnel oxide',ald('SiO2',tunnel)),L('Charge-trap nitride',ald('Si3N4',trap)),
                L('Blocking oxide',ald('SiO2',block)),L('Control gate',dep('PolySi',.15,'PVD')),
                L('Cell gate pattern',photo(p.get('length',.4))),L('Control-gate etch',etch('PolySi',.18)),
                L('Blocking-oxide etch',etch('SiO2',block+.01)),L('Trap-layer etch',etch('Si3N4',trap+.01)),
                L('Tunnel-oxide etch',etch('SiO2',tunnel+.01)),L('PR strip',strip()),
                L('Source / drain implant',implant()),L('Activation anneal',anneal())]
    if kind=='pn-junction':
        left=photo(.8,'Positive');left['params']['offset']=-.4
        right=photo(.8,'Positive');right['params']['offset']=.4
        return [L('N-region opening',left),L('Phosphorus implant',implant('P',p.get('donor_dose',1e13),30)),
                L('PR strip',strip()),L('P-region opening',right),L('Boron implant',implant('B',p.get('acceptor_dose',1e13),10)),
                L('PR strip',strip()),L('Junction anneal',step('diffusion',method='Anneal',temperature=p.get('temperature',1000),time=p.get('time',30)))]
    raise ValueError('Unknown device: '+kind)

def targets():
    notes={
      'rcat':'Recessed channel의 게이트 길이 방향 단면. 접촉·커패시터는 제외합니다.',
      'bcat':'Si 표면 아래의 게이트와 질화막 cap을 관찰합니다. DRAM 전체 셀·air gap은 제외합니다.',
      'fdsoi':'준비된 SOI 웨이퍼의 얇은 Si body. BOX 아래 handle은 수동 영역입니다. 실제 완전 공핍 여부는 바이어스·도핑에 의존하며 여기서는 계산하지 않습니다.',
      'pdsoi':'준비된 SOI 웨이퍼의 두꺼운 Si body. BOX 아래 handle은 수동 영역입니다. 부분 공핍·floating-body 전기 효과는 계산하지 않습니다.',
      'gaafet':'Nanowire GAA 게이트 횡단면. Si/SiGe 적층은 형상 성장 근사이며 결정 성장·strain은 제외합니다. S/D는 화면 밖에 있습니다.',
      'cfet':'상하 채널과 분리된 게이트를 갖는 순차 적층 학습 단면. 상부 결정층 형성은 준비된 층의 형상 근사입니다. N/P 전기 동작·접촉·backside power는 제외합니다.',
      'charge-trap':'평면 SONOS 단일 셀의 tunnel oxide / trap nitride / blocking oxide. 3D NAND 전체 적층과 전하 포획·program/erase는 계산하지 않습니다.',
      'pn-junction':'좌우 B/P 주입과 열처리로 만든 lateral PN 단면. 농도는 계산하며 공핍층·I–V는 계산하지 않습니다.'}
    titles={'rcat':'RCAT','bcat':'BCAT','fdsoi':'FD-SOI FET','pdsoi':'PD-SOI FET','gaafet':'GAAFET','cfet':'CFET','charge-trap':'Charge Trap Flash','pn-junction':'PN Junction'}
    out=[]
    for kind in SOURCES:
        source=SOURCES[kind]
        t=dict(id=kind,title=titles[kind],width=1.6,bounds=[-.8,.8,-.45,.65],roi=[-.55,.55,-.32,.55],section='게이트 길이 방향 단면',recipe=recipe(kind),sources=[dict(title=source[0],url=source[1],figure=source[2])],assumptions=notes[kind])
        if kind in ('gaafet','cfet'):
            t.update(width=1.2,bounds=[-.6,.6,-.18,.65],roi=[-.3,.3,-.04,.58],section='게이트 중심 횡단면 · S/D는 화면 밖')
        if kind in ('fdsoi','pdsoi'):
            t['wafer']=dict(body=.04 if kind=='fdsoi' else .16,box=.15)
            t['initialLabel']='SOI wafer · Si / BOX / Si'
            t['roi']=[-.55,.55,-.4,.3]
        if kind=='pn-junction':t.update(grading='doping',roi=[-.72,.72,-.35,.02],section='Lateral PN · 순 도펀트 농도',bounds=[-.8,.8,-.5,.15])
        if kind=='charge-trap':t['sources'].append(dict(title='SK hynix · 3D NAND와의 구조 비교',url='https://news.skhynix.com/en/research-inside-ep1/',figure='Fig. 1 · vertical NAND cell; 본 예제는 평면 단일 셀'))
        out.append(t)
    return out

def simulate(spec,p):
    from reverse_engine import run
    payload=dict(target=spec['id'],steps=recipe(spec['id'],p))
    if spec['id'] in ('fdsoi','pdsoi'):payload['wafer']=dict(body=p['body'],box=.15)
    result=run(payload)
    result.update(params=p,mode='physics',note=spec['note'],source=spec['source'],previewFrame=len(result['frames'])-1)
    return result
