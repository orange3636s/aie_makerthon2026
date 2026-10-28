"""FiPy finite-volume dopant diffusion on the *actual surviving silicon cells*.

Units: length um, time s, concentration atoms/um^3. Non-Si interfaces and
domain edges have zero flux. Pre-deposition fixes concentration only on Si
faces touching air connected to the top of the domain. No reaction/segregation,
concentration-dependent diffusivity, electric field or defect model is implied.
"""
import os
from collections import deque

os.environ.setdefault('FIPY_SOLVERS', 'scipy')


def silicon_mesh(positions, materials, dx, silicon=10, air=2):
    import numpy as np
    from fipy.meshes.mesh2D import Mesh2D

    origin = np.min(np.asarray(positions)[:, :2], axis=0) - dx / 2
    keys = [tuple(np.rint((np.asarray(p[:2]) - origin) / dx - .5).astype(int)) for p in positions]
    material_at = {k: int(m) for k, m in zip(keys, materials)}
    top = max(y for x, y in keys)
    ambient = {k for k, m in material_at.items() if m == air and k[1] == top}
    queue = deque(ambient)
    while queue:
        x, y = queue.popleft()
        for k in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
            if k not in ambient and material_at.get(k) == air:
                ambient.add(k); queue.append(k)
    indices = [i for i, m in enumerate(materials) if int(m) == silicon]
    if not indices:
        raise ValueError('확산 가능한 Si 영역이 없습니다.')
    vertices, vertex_ids, edges, edge_ids, cells, exposed = [], {}, [], {}, [], set()

    def vertex(k):
        if k not in vertex_ids:
            vertex_ids[k] = len(vertices)
            vertices.append(origin + np.asarray(k) * dx)
        return vertex_ids[k]

    for i in indices:
        x, y = keys[i]
        sides = [((x, y), (x+1, y), (x, y-1)),
                 ((x+1, y), (x+1, y+1), (x+1, y)),
                 ((x+1, y+1), (x, y+1), (x, y+1)),
                 ((x, y+1), (x, y), (x-1, y))]
        faces = []
        for a, b, neighbor in sides:
            pair = tuple(sorted((vertex(a), vertex(b))))
            if pair not in edge_ids:
                edge_ids[pair] = len(edges); edges.append(pair)
            face = edge_ids[pair]; faces.append(face)
            if neighbor in ambient:
                exposed.add(face)
        cells.append(faces)
    mesh = Mesh2D(vertexCoords=np.asarray(vertices).T,
                  faceVertexIDs=np.asarray(edges).T,
                  cellFaceIDs=np.asarray(cells).T)
    expected = np.asarray(positions)[indices, :2].T
    if not np.allclose(mesh.cellCenters, expected, atol=dx*1e-6):
        raise ValueError('확산 격자의 좌표가 일치하지 않습니다.')
    source = np.zeros(len(edges), dtype=bool)
    source[list(exposed)] = True
    if np.any(source & ~np.asarray(mesh.exteriorFaces)):
        raise ValueError('표면 공급 경계가 올바르지 않습니다.')
    return mesh, np.asarray(indices), source


def evolve(positions, materials, fields, dx, coefficients, duration,
           source_species=None, surface_concentration=None, time_steps=48):
    """coefficients: {B/P: {diffusivity: um²/s, solubility: atoms/um³}}.

    Dirichlet pre-deposition is capped at solid solubility. Drive-in is closed
    (Neumann zero flux) and must conserve each species independently. Both are
    isothermal thermal steps with the existing equilibrium activation model.
    """
    import numpy as np
    from fipy import CellVariable, TransientTerm, DiffusionTerm
    from fipy.solvers.scipy import LinearLUSolver

    if duration <= 0 or not np.isfinite(duration):
        raise ValueError('확산 시간은 양수여야 합니다.')
    mesh, indices, source_faces = silicon_mesh(positions, materials, dx)
    if source_species and not source_faces.any():
        raise ValueError('외부에 노출된 Si 표면이 없습니다. 산화막 개구와 PR 제거를 확인하세요.')
    if not source_species and not any(k.endswith('_total') and any(v) for k, v in fields.items()):
        raise ValueError('Drive-in 전에 이온 주입 또는 Pre-deposition을 추가하세요.')
    result = {k: list(v) for k, v in fields.items()}
    if source_species:
        result.setdefault(source_species+'_total', [0.] * len(positions))
    diagnostics = []
    for species, coeff in coefficients.items():
        label = species+'_total'
        if label not in result:
            continue
        initial = np.asarray(result[label])[indices]
        supplied = species == source_species
        cs = min(surface_concentration, coeff['solubility']) if supplied else 0.
        scale = max(float(initial.max()), cs, 1.)
        concentration = CellVariable(mesh=mesh, value=initial/scale, hasOld=True)
        if supplied:
            concentration.constrain(cs/scale, source_faces)
        equation = TransientTerm() == DiffusionTerm(coeff=coeff['diffusivity'])
        solver = LinearLUSolver(tolerance=1e-10, iterations=1000)
        for _ in range(time_steps):
            concentration.updateOld()
            equation.solve(var=concentration, dt=duration/time_steps, solver=solver)
        values = np.asarray(concentration.value) * scale
        if not np.isfinite(values).all() or values.min() < -scale*1e-10:
            raise ValueError('확산 농도 계산이 수렴하지 않았습니다.')
        values = np.maximum(values, 0.)
        before = float(initial.sum()*dx*dx); after = float(values.sum()*dx*dx)
        relative = abs(after-before)/max(before, 1.)
        if not supplied and relative > 1e-6:
            raise ValueError('Drive-in 총 도펀트량 보존 오차가 큽니다.')
        full = np.zeros(len(positions)); full[indices] = values
        active = np.zeros(len(positions)); active[indices] = np.minimum(values, coeff['solubility'])
        result[label] = full.tolist(); result[species+'_active'] = active.tolist()
        diagnostics.append(dict(species=species, diffusivityUm2PerS=coeff['diffusivity'],
                                inventoryBeforePerUm=before, inventoryAfterPerUm=after,
                                massRelativeError=None if supplied else relative,
                                sourceFaces=int(source_faces.sum()) if supplied else 0,
                                effectiveSurfaceCm3=cs*1e12 if supplied else None))
    return result, diagnostics
