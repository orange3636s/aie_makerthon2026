"""Native teaching modules for dopant activation and front-side contacts."""
CONTACT_METALS={'finfet':'Co','gaafet':'Mo','mbcfet':'Mo','cfet':'Mo'}

def contacts(gate=True,cap=False,metal='W',pitch=.50):
    from reverse_catalog import dep,photo,etch,strip,step
    def L(label,s):return dict(s,label=label)
    opening=photo(.16 if pitch<.50 else .20,'Positive','Triple' if pitch<.50 else 'Repeat' if gate else 'Double',pitch if gate else 1.0)
    flow=[L('ILD deposition',dep('SiO2',.32)),L('ILD planarization',step('cmp')),
          L('Contact dielectric cap',dep('SiO2',.10)),
          L('S/D + gate contact openings' if gate else 'P/N contact openings',opening),
          L('Contact-hole etch · ILD',etch('SiO2',.60))]
    if not gate:flow=flow[:1]+flow[3:]  # Flat PN wafer retains the original ILD.
    if cap:flow.extend([L('Buried-gate cap opening',etch('Si3N4',.30)),L('Contact bottom oxide clear',etch('SiO2',.10)),L('S/D hardmask clear',etch('Si3N4',.10))])
    # Effective particle transport: reduce entrance capture and extend the
    # overburden before CMP. This is not a material-specific chemistry model.
    fill=step('deposition',method='ALD',material=metal,cycles=100,gpc=.003,pulse=.1,ald_sticking=.00005) if metal=='Mo' else step('deposition',method='CVD',material=metal,rate=.08,time=6.875,sticking=.03,exponent=10.)
    return flow+[L('Contact PR strip',strip()),L(metal+' contact fill',fill),L('Contact metal CMP',step('cmp'))]

def sd_section(kind,species='P',p=None):
    """Independent local length section. Never presented as a 3D device solve.

    GAA/MBCFET use one supported Si body as a local S/D teaching module;
    their suspended channels and wrap gates remain in the gate section.
    """
    from reverse_catalog import ald,dep,photo,etch,strip,step
    p=p or {}
    def L(label,s):return dict(s,label=label)
    r=[L('Gate dielectric · HfO₂',ald('HfO2',.02)),L('Gate electrode · TiN',dep('TiN',.16,'PVD')),
       L('Gate length pattern',photo(.30)),L('Gate etch',etch('TiN',.19)),L('Gate PR strip',strip()),
       L('Exposed HfO₂ removal',etch('HfO2',.03)),
       L('S/D extension implant · '+species,step('diffusion',method='Ion implantation',species=species,energy=8,dose=p.get('sd_dose',1e13)*.1)),
       L('Spacer deposition',ald('Si3N4',.035)),L('Spacer etchback',etch('Si3N4',.045)),
       L('Deep S/D implant · '+species,step('diffusion',method='Ion implantation',species=species,energy=10,dose=p.get('sd_dose',1e13))),
       L('S/D activation anneal',step('diffusion',method='Anneal',temperature=1000,time=p.get('sd_anneal',20)))]+contacts(metal=CONTACT_METALS.get(kind,'W'))
    return dict(width=1.6,bounds=[-.8,.8,-.4,.55],roi=[-.72,.72,-.25,.45],recipe=r,
        section=('p형' if species=='B' else 'n형')+' S/D 국소 단면 · 게이트 단면과 독립 계산',
        assumptions='독립적인 길이 방향 S/D 학습 모듈입니다. 확장 주입·스페이서·고농도 주입·활성화·ILD·금속 콘택을 계산합니다. 게이트 횡단면과 연결된 3D 구조나 접촉저항을 계산하지 않습니다.',
        assessment=dict(version=2,species=[species],requireAnneal=True,weights=dict(geometry=.5,total=.2,active=.2,process=.1)))
