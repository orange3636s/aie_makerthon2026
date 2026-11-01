"""Planar Deal-Grove adapter for oxide thinner than the coupled solver grid.

Uses ViennaPS's own temperature/oxidant rate table, starting at the actual
oxide thickness (including zero). No seed film or uncharged growth is added.
The native level sets retain separate Si and oxide interfaces below grid pitch.
This is a planar teaching approximation, not thin-oxide/Massoud calibration.
"""

def interfaces(ps, ls, domain, width):
    mats=domain.getMaterialsInDomain()
    if ps.Material.Si not in mats or any(m not in (ps.Material.Si,ps.Material.SiO2) for m in mats):
        return None

    def flat_top(material):
        # Read cumulative interfaces, not the Boolean material shell: a shell
        # thinner than one grid cell distorts its interpolated outer boundary.
        levels=[v for i,v in enumerate(domain.getLevelSets()) if domain.getMaterialMap().getMaterialAtIdx(i)==material]
        if not levels:return None
        mesh=ls.Mesh();ls.ToSurfaceMesh(levels[-1],mesh).apply()
        columns={}
        for point in mesh.getNodes():
            x,y=point[:2]
            if abs(x)<width/2-.005:
                key=round(x,7);columns[key]=max(columns.get(key,float('-inf')),y)
        if len(columns)<3 or max(columns.values())-min(columns.values())>1e-7:return None
        return sum(columns.values())/len(columns)

    si_top=flat_top(ps.Material.Si)
    ox_top=flat_top(ps.Material.SiO2) if ps.Material.SiO2 in mats else si_top
    if si_top is None or ox_top is None or ox_top<si_top-1e-8:return None
    return si_top,ox_top

def apply(ps, ls, domain, width, params):
    pair=interfaces(ps,ls,domain,width)
    if pair is None:return None
    si_top,ox_top=pair
    initial=max(0.,ox_top-si_top)
    model=ps.Oxidation();model.setTemperature(params['temperature']);model.setPressure(1.)
    model.setTime(params['oxidation_time']);model.setOrientation(ps.SiliconOrientation.Si100)
    model.setOxidant(getattr(ps.OxidantType,'Wet' if params['method']=='Wet oxidation' else 'Dry'))
    thickness=model.estimatePlanarOxideThickness(initial)
    growth=max(0.,thickness-initial);consumed=.44*growth
    new_si=si_top-consumed;new_top=ox_top+.56*growth

    def plane(height):
        level=ls.Domain(domain.getGrid())
        geometry=ls.MakeGeometry(level,ls.Plane([0.,height],[0.,1.]))
        geometry.setIgnoreBoundaryConditions([True,True,False]);geometry.apply()
        return level
    silicon_levels=[v for i,v in enumerate(domain.getLevelSets()) if domain.getMaterialMap().getMaterialAtIdx(i)==ps.Material.Si]
    silicon=ls.Domain();silicon.deepCopy(silicon_levels[-1])
    ls.BooleanOperation(silicon,plane(new_si),ls.BooleanOperationEnum.INTERSECT).apply()
    rebuilt=ps.Domain(gridDelta=.01,xExtent=width,yExtent=2.,boundary=ps.BoundaryType.REFLECTIVE_BOUNDARY)
    for level in silicon_levels[:-1]:
        copy=ls.Domain();copy.deepCopy(level);rebuilt.insertNextLevelSetAsMaterial(copy,ps.Material.Si,False)
    rebuilt.insertNextLevelSetAsMaterial(silicon,ps.Material.Si,False)
    rebuilt.insertNextLevelSetAsMaterial(plane(new_top),ps.Material.SiO2,False)
    return rebuilt,dict(oxidationModel='planar-deal-grove',initialOxideNm=initial*1000,
        oxideThicknessNm=thickness*1000,oxideGrowthNm=growth*1000,
        siliconConsumedNm=consumed*1000,oxideSurfaceRiseNm=.56*growth*1000)
