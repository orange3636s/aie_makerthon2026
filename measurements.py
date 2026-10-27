"""Measurements on solved contours; no geometry is generated here."""
import statistics

def intersections(polys,y):
    xs=[]
    for p in polys:
        pts=p['points']
        for a,b in zip(pts,pts[1:]+pts[:1]):
            if (a[1]>y)!=(b[1]>y):xs.append(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))
    return sorted(xs)

def side_coverage(before,after,material,top_growth,width):
    if top_growth<.008:return None
    groups={}
    for p in before:groups.setdefault(p['material'],[]).append(p)
    film=[p for p in after if p['material']==material]
    def occupied(x,y):return any(sum(v>x for v in intersections(p,y))%2 for p in groups.values())
    samples=[]
    for poly in before:
        pts=poly['points']
        for a,b in zip(pts,pts[1:]+pts[:1]):
            dx=b[0]-a[0];dy=b[1]-a[1]
            if abs(dy)<.008 or abs(dx)>.15*abs(dy):continue
            x=(a[0]+b[0])/2;y=(a[1]+b[1])/2
            if abs(x)>width/2-.025:continue
            left=occupied(x-.008,y);right=occupied(x+.008,y)
            if left==right:continue
            direction=1 if left else -1
            xs=intersections(film,y)
            if not sum(v>x+direction*.003 for v in xs)%2:continue
            distance=[(v-x)*direction for v in xs if (v-x)*direction>.003]
            if distance:
                distance=min(distance)
                other=[(v-x)*direction for g in groups.values() for v in intersections(g,y) if (v-x)*direction>.02]
                # A completely filled gap has no free film surface, hence no
                # unambiguous local step-coverage measurement.
                if other and distance>=min(other)-.012:continue
                if distance<top_growth*4:samples.append(distance)
    if len(samples)<3:return None
    side=statistics.median(samples)
    return {'sideGrowthUm':round(side,5),'stepCoverage':round(side/top_growth,3),'sideSamples':len(samples)}
