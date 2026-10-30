"""Deterministic teaching topography; Rq in um, not measured atomic roughness."""
import math

def profile(width, rq):
    count=max(40,round(width/.005))
    cycles=max(1,round(width/.4))
    values=[math.cos(2*math.pi*cycles*i/count)+.35*math.cos(4*math.pi*cycles*i/count) for i in range(count)]
    mean=sum(values)/count
    rms=math.sqrt(sum((v-mean)**2 for v in values)/count)
    heights=[rq*(v-mean)/rms for v in values]
    return [(-width/2+width*i/count,heights[i%count]) for i in range(count+1)]

def levelset(ls, grid, width, bottom, rq):
    top=profile(width,rq)
    points=[(-width/2,bottom),(width/2,bottom),*reversed(top)]
    points.reverse()
    mesh=ls.Mesh()
    for x,z in points:mesh.insertNextNode([x,z,0.])
    for i in range(len(points)):mesh.insertNextLine([i,(i+1)%len(points)])
    level=ls.Domain(grid)
    ls.FromSurfaceMesh(level,mesh).apply()
    return level
