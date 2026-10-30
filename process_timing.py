"""Reference-rate timing for bundled examples, never for user-entered recipes.

These are educational rate anchors from particular tools, not calibrated models
of those tools. Preserve rate*time and the existing transport/profile parameters.
All rates below are nm/s; native recipes use micrometres.
"""
import copy

SOURCES = {
    'tnfc': 'https://www.ece.utoronto.ca/equipmentcapabilities/',
    'ubc': 'https://nanofab.ubc.ca/capabilities/processes/thin-film-deposition/how-to-deposit-high-quality-pecvd-films/',
}
PVD = {'Al': .11, 'Cu': .31, 'Ti': .08, 'W': .08,
       'SiO2': .07, 'Si3N4': .022, 'Al2O3': .016}

def anchor(row):
    p = row.get('params', {})
    if p.get('input_mode', 'Effective') != 'Effective':
        return None
    material = p.get('material', 'SiO2' if row['op']=='deposition' else 'Si')
    method = p.get('method', 'CVD' if row['op']=='deposition' else 'Directional')
    if row['op']=='deposition' and method=='PVD' and material in PVD:
        return PVD[material], 'tnfc'
    if material in ('SiO2', 'Si3N4') and (
        (row['op']=='deposition' and method=='CVD') or
        (row['op']=='etch' and method=='Directional')):
        return 1., 'ubc'
    return None

def retime(rows):
    rows = copy.deepcopy(rows)
    for row in rows:
        found = anchor(row)
        p = row.get('params', {})
        if not found or 'rate' not in p or 'time' not in p:
            continue
        rate = found[0]/1000
        if abs(p['rate']-rate)<1e-14:
            continue
        duration = p['rate']*p['time']/rate
        # Never silently clamp a dose/removal budget.
        if .05 <= duration <= 86400:
            p.update(rate=rate, time=duration)
    return rows
