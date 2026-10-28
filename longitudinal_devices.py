"""Supported channel-length teaching sections, using the native flow operators.

These are scaled 2D process modules, not foundry recipes. In particular Si fill
stands in for selective source/drain epitaxy; no strain or crystal growth solve.
"""
IDS = ('finfet', 'gaafet', 'mbcfet', 'cfet')


def recipe(kind, p=None):
    from reverse_catalog import dep, ald, photo, etch, strip, remove, step
    from contact_modules import contacts, CONTACT_METALS
    p = p or {}
    def L(label, row): return dict(row, label=label)
    length = p.get('length', .32)
    dose = p.get('sd_dose', 1e13)
    thermal_time = p.get('sd_anneal', 5)

    def implants(species, prefix, energy=8):
        energies=energy if isinstance(energy,tuple) else (energy,)
        return [L(prefix+' · S/D implant mask', photo(length+.12))]+[
                L(prefix+(f' · S/D {species} {e} keV' if len(energies)>1 else ' · S/D implant '+species), step('diffusion', method='Ion implantation', species=species, dose=dose/len(energies), energy=e)) for e in energies]+[
                L(prefix+' · implant PR strip', strip()),
                L(prefix+' · activation anneal', step('diffusion', method='Anneal', temperature=950, time=thermal_time))]

    def gate_stack(prefix, material='TiN', thickness=.05):
        return [L(prefix+' · HfO₂ conformal dielectric', dep('HfO2', p.get('oxide', .02),'Conformal')),
                L(prefix+' · '+material+' wrap gate', dep(material, thickness,'PVD' if kind=='finfet' else 'Conformal')),
                L(prefix+' · gate length pattern', photo(length)),
                L(prefix+' · gate electrode etch', etch(material, thickness+.03,.25 if kind=='finfet' else 0)),
                L(prefix+' · gate PR strip', strip()),
                L(prefix+' · exposed HfO₂ clear', etch('HfO2', p.get('oxide', .02)+.015))]

    if kind == 'finfet':
        # Longitudinal cut through the fin: the side faces lie out of this plane.
        # The body remains connected to S/D and the substrate throughout.
        return [L('Fin active-area mask', photo(1.0)),
                L('Fin isolation recess', etch('Si', p.get('depth', .2))),
                L('Fin PR strip', strip()),
                L('STI oxide fill', dep('SiO2', .35)),
                L('STI planarization', step('cmp')),
                L('Fin reveal', etch('SiO2', .10))] + gate_stack('Fin', thickness=p.get('gate', .08)) + [
            L('S/D extension implant · P', step('diffusion', method='Ion implantation', species='P', energy=8, dose=dose*.1)),
            L('Si₃N₄ spacer deposition', ald('Si3N4', .035)),
            L('Spacer etchback', etch('Si3N4', .045)),
            L('Deep S/D implant · P', step('diffusion', method='Ion implantation', species='P', energy=10, dose=dose)),
            L('S/D activation anneal', step('diffusion', method='Anneal', temperature=950, time=thermal_time))] + contacts(metal='Co',pitch=.40)

    def bridge(prefix, species, gate_material='TiN'):
        gap=p.get('gap', .08);channel=p.get('channel', .06)
        fill=dep('SiGe', gap+.10);fill['params'].update(sticking=.02, exponent=10.)
        # A local sacrificial pocket, bounded by surviving Si shoulders. Releasing
        # it leaves a continuous Si bridge attached to those shoulders, not a
        # floating isolated island as in the old transverse cut.
        return [L(prefix+' · sacrificial pocket mask', photo(length+.16, 'Positive')),
                L(prefix+' · Si pocket etch', etch('Si', gap)),
                L(prefix+' · pocket PR strip', strip()),
                L(prefix+' · SiGe pocket fill', fill),
                L(prefix+' · SiGe planarization', step('cmp')),
                L(prefix+' · supported Si channel', dep('Si', channel, 'PVD'))] + implants(species, prefix) + [
                L(prefix+' · SiGe channel release', remove('SiGe'))] + gate_stack(prefix, gate_material)

    if kind == 'gaafet':
        return bridge('GAA', 'P') + contacts(metal=CONTACT_METALS[kind])
    if kind == 'mbcfet':
        sheets=int(p.get('sheets', 3));gap=p.get('gap', .06);thickness=p.get('thickness', .04)
        r=[]
        for i in range(sheets):
            r += [L(f'Stack {i+1} · SiGe', dep('SiGe', gap, 'PVD')),
                  L(f'Stack {i+1} · Si nanosheet', dep('Si', thickness, 'PVD'))]
        r += [L('Nanosheet stack mask', photo(length+.16))]
        for material in ('Si','SiGe'):
            r += [L('S/D recess · '+material, step('etch',material=material,method='Pattern transfer',rate=.1,time=(sheets*(gap+thickness)+.015)/.1))]
        fill=dep('Si', min(.60, sheets*(gap+thickness)+.15));fill['params'].update(sticking=.02, exponent=10.)
        r += [L('Stack PR strip', strip()), L('Si source/drain support fill', fill),
              L('S/D support planarization', step('cmp'))]
        r += implants('P', 'Nanosheet', (30,100,200))
        r += [L('SiGe release · Si S/D anchors retained', remove('SiGe'))]
        return r + gate_stack('Nanosheet') + contacts(metal='Mo')
    if kind == 'cfet':
        r=bridge('Lower nFET', 'P')+contacts(metal='Mo')
        # Completed lower contacts are embedded and insulated before the upper
        # prepared Si layer is introduced. This is sequential integration, not
        # a claim to reproduce a manufacturer's monolithic CFET process.
        r += [L('Inter-tier isolation · SiO₂', dep('SiO2', p.get('isolation', .10), 'PVD')),
              L('Upper-tier prepared Si body', dep('Si', .16, 'PVD'))]
        r += bridge('Upper pFET', 'B', 'W')+contacts(metal='Mo')
        return r
    raise ValueError('Unsupported longitudinal device')


def configure(target):
    kind=target['id']
    target.update(width=1.6,bounds=[-.8,.8,-.45,1.1 if kind=='cfet' else .75],
                  roi=[-.72,.72,-.25,1.05 if kind=='cfet' else .7],
                  section='S/D–채널 길이 방향 단면',recipe=recipe(kind),projectedMask=True)
    target.pop('sections',None)
    target['assumptions']='S/D 지지부·채널·게이트·컨택이 함께 보이는 2D 길이 방향 학습 단면입니다. Si 채움은 S/D 에피택시의 형상 근사입니다. 채널 내부의 Conformal 성장은 native 등방 offset으로 단면 밖 공급을 가정하며 입자 수송 ALD와 다릅니다. 방향성 식각은 PR 수직 투영을 보존합니다. 결정 성장·strain·3D 게이트·전기 특성을 계산하지 않습니다.'
    if kind=='cfet':target['assumptions']+=' 하부 n형/상부 p형의 순차 적층 예시이며 상부 Si는 준비된 결정층의 형상 근사입니다.'
