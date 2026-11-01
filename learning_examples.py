"""Small observation recipes using the same native solvers as reverse design.

PVD/CVD are effective single-particle transport, not equipment-calibrated
chemistry. PN Junction illustrates masked implants, not electrical device I-V.
"""
from reverse_catalog import step, photo, etch, strip

IDS = {'pvd', 'cvd', 'ald', 'implant', 'anneal', 'pn-junction'}


def run(spec, p):
    from reverse_engine import run as simulate
    kind = spec['id']
    labels = None
    if kind in ('pvd', 'cvd', 'ald'):
        recipe = [photo(p['width'], 'Positive'), etch('Si', p['depth']), strip()]
        if kind == 'ald':
            # One native ALD process preserves cycle kinetics and pulse semantics.
            recipe.append(step('deposition', method='ALD', material='SiO2',
                               cycles=p['cycles'], gpc=.0001, pulse=p['pulse'],
                               ald_sticking=p['sticking']))
        else:
            # Three snapshots, without rebuilding the geometry between stages.
            for _ in range(3):
                recipe.append(step('deposition', method=kind.upper(), material='SiO2',
                                   rate=.08, time=round(p['time']/3, 12), sticking=p['sticking'],
                                   exponent=p['exponent']))
        labels = ['Si substrate', 'PR pattern', 'Trench etch', 'PR strip']
        labels += [f'{kind.upper()} · {i+1}/{len(recipe)-3}' for i in range(len(recipe)-3)]
    elif kind == 'implant':
        recipe = [photo(p['width'], 'Positive'),
                  step('diffusion', species=p['species'], energy=p['energy'], dose=p['dose']), strip()]
    elif kind == 'anneal':
        recipe = [photo(.5, 'Positive'), step('diffusion', species=p['species'], energy=30, dose=p['dose']), strip()]
        for fraction in (.25, .25, .5):
            recipe.append(step('diffusion', method='Anneal', temperature=p['temperature'], time=p['time']*fraction))
        labels = ['Si substrate', 'PR pattern', f'Implant · {p["species"]}', 'PR strip']
        labels += [f'Anneal · {p["time"]*fraction:g} s' for fraction in (.25, .5, 1.)]
    elif kind == 'pn-junction':
        left = photo(.8, 'Positive'); left['params']['offset'] = -.4
        right = photo(.8, 'Positive'); right['params']['offset'] = .4
        recipe = [left, step('diffusion', species='P', energy=30, dose=p['p_dose']), strip(),
                  right, step('diffusion', species='B', energy=10, dose=p['b_dose']), strip(),
                  step('diffusion', method='Anneal', temperature=p['temperature'], time=p['time'])]
    else:
        raise ValueError('지원하지 않는 학습 예제입니다.')
    result = simulate(dict(target='sti', steps=recipe))
    if labels:
        for frame, label in zip(result['frames'], labels):
            frame['label'] = label
    result.update(example=kind, params=p, mode=spec['mode'], model=spec['model'],
                  note=spec['note'], source=spec['source'], previewFrame=len(result['frames'])-1)
    # Crop the thick backing substrate so the active processing region is legible.
    depth = max(.5, p.get('depth', 0)+.15) if kind in ('pvd', 'cvd', 'ald') else .85
    result['bounds'] = [-.8, .8, -depth, max(.18, max(f['highest'] for f in result['frames'])+.08)]
    return result
