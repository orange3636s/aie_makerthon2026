"""Observation presets and reverse-design answers share one native recipe."""
import copy
from reverse_catalog import BY_TARGET,dep,ald,photo,etch,strip,remove,step

def run(spec,p):
    from reverse_engine import run as simulate
    if p.get('section','게이트 단면')!='게이트 단면':
        from contact_modules import sd_section
        section=sd_section(spec['id'],'B' if p['section']=='p형 S/D·콘택' else 'P',p)
        from reverse_engine import run as section_run
        result=section_run(dict(target=spec['id'],view='sd-p' if p['section']=='p형 S/D·콘택' else 'sd',steps=section['recipe']))
        result.update(params=p,mode='physics',note=section['assumptions'],source=spec['source'],previewFrame=len(result['frames'])-1)
        return result
    kind=spec['id'];recipe=copy.deepcopy(BY_TARGET[kind]['recipe'])
    if kind=='mosfet':
        recipe[0]=ald('SiO2',p['oxide']);recipe[2]=photo(p['length']);recipe[5]=etch('SiO2',p['oxide']+.01);recipe[8]=ald('Si3N4',p['spacer']);recipe[9]=etch('Si3N4',p['spacer']+.005)
    elif kind in ('fin','finfet'):
        recipe[0]=photo(p['width']);recipe[1]=etch('Si',p['depth']);recipe[3]=dep('SiO2',min(.6,p['depth']+.05));recipe[5]=etch('SiO2',p['depth']*(p['exposed'] if kind=='fin' else .22/.35))
        if kind=='finfet':recipe[6]=ald('HfO2',p['oxide']);recipe[7]=ald('TiN',p['gate'])
    elif kind=='sti':
        recipe[2]=photo(p['width'],'Positive');recipe[5]=etch('Si',p['depth'],.05);recipe[7]['params']['time']=p['fill_time']
    elif kind=='locos':
        recipe[1]=ald('Si3N4',p['mask']);recipe[5]['params'].update(temperature=p['temperature'],oxidation_time=p['duration'])
    elif kind=='mbcfet':
        n=int(p['sheets']);recipe=[]
        for _ in range(n):recipe.extend([dep('SiGe',p['gap'],'PVD'),dep('Si',p['thickness'],'PVD')])
        recipe.append(photo(p['width']))
        for _ in range(n):recipe.extend([etch('Si',p['thickness']+.005),etch('SiGe',p['gap']+.01)])
        recipe.extend([strip(),dep('SiO2',.25),step('cmp'),etch('SiO2',.27),remove('SiGe'),ald('HfO2',.015),ald('TiN',.04)])
    result=simulate(dict(target=kind,steps=recipe))
    result.update(params=p,mode='physics',note=spec['note'],source=spec['source'],previewFrame=len(result['frames'])-1)
    return result
