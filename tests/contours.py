"""Reflective-boundary clipping regression; interior gaps must remain errors."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from engine import contour_mesh
class Mesh:
 def __init__(self,nodes,lines):self.nodes=nodes;self.lines=lines
 def getNodes(self):return self.nodes
 def getLines(self):return self.lines
 def getCellData(self):return None
# Missing cap on the left boundary (native MBCFET 80 nm gap failure).
m=Mesh([[-.6,0],[.6,0],[.6,.1],[-.5999,.1]],[(0,1),(1,2),(2,3)])
p=contour_mesh(m,13,True,x_bounds=(-.6,.6),boundary_tolerance=.001)
assert len(p)==1 and p[0]['closed']
# A gap inside the physical domain must never be patched to look successful.
m=Mesh([[-.2,0],[.2,0],[.2,.1],[-.2,.1]],[(0,1),(1,2),(2,3)])
p=contour_mesh(m,13,True,x_bounds=(-.6,.6),boundary_tolerance=.001)
assert p and not p[0]['closed']
print('Boundary caps close; interior cracks remain detectable')
