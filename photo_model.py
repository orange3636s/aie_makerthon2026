"""Display-independent photomask geometry and bounded development model (um, s).

Development is a vertical dissolution approximation at 1 nm/s, not calibrated
photoresist chemistry or optical exposure. Legacy combined patterns stay valid.
"""
DEVELOP_RATE = .001

def openings(p, width):
    offset, pitch, cd = p['offset'], p['pitch'], p['width']
    centers = [offset] if p['pattern']=='Central' else [offset-pitch/2,offset+pitch/2] if p['pattern']=='Double' else [offset-pitch,offset,offset+pitch] if p['pattern']=='Triple' else [offset+j*pitch for j in range(-32,33)]
    spans=sorted((max(-width/2,c-cd/2),min(width/2,c+cd/2)) for c in centers)
    merged=[]
    for a,b in spans:
        if b<=a:continue
        if merged and a<=merged[-1][1]:merged[-1]=(merged[-1][0],max(b,merged[-1][1]))
        else:merged.append((a,b))
    return merged

def complement(spans,width):
    kept=[];end=-width/2
    for a,b in spans:
        if a>end:kept.append((end,a))
        end=max(end,b)
    if end<width/2:kept.append((end,width/2))
    return kept
