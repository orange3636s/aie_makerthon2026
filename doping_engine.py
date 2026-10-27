"""Native 4.7 implantation/anneal adapter. Geometry: um; internal density: um^-3."""
import csv, math
from pathlib import Path
import native_runtime
import viennaps as ps

ROOT=Path(__file__).resolve().parent
SPECIES={'B':'boron','P':'phosphorus'}
def table(name):
    with (ROOT/name).open(encoding='utf-8') as f:
        return list(csv.DictReader(line for line in f if line.strip() and not line.startswith('#')))

class Doping:
    def __init__(self,domain,background=0.):
        self.domain=domain; self.fields={}; self.positions=[]; self.background=background
        self.materials=[]; self.ready=False; self.last_info=None

    def sync(self):
        """Regrid on the same Cartesian mesh; retain fields only in surviving Si cells."""
        old={tuple(round(v,6) for v in pos[:2]):i for i,pos in enumerate(self.positions)}
        fields=self.fields
        self.domain.generateCellSet(1.0,ps.Material.Air,True,True)
        cs=self.domain.getCellSet();cs.buildNeighborhood()
        self.positions=[list(cs.getCellCenter(i)) for i in range(cs.getNumberOfCells())]
        self.materials=list(cs.getScalarData('Material'))
        self.fields={}
        for label,values in fields.items():
            out=[]
            for pos,mat in zip(self.positions,self.materials):
                j=old.get(tuple(round(v,6) for v in pos[:2]))
                out.append(values[j] if j is not None and int(mat)==int(ps.Material.Si) else 0.)
            cs.addScalarData(label,0.);cs.setScalarData(label,out);self.fields[label]=out
        if not self.ready and self.background:
            for label in ['B_total','B_active']:
                values=[self.background*1e-12 if int(m)==int(ps.Material.Si) else 0. for m in self.materials]
                cs.addScalarData(label,0.);cs.setScalarData(label,values);self.fields[label]=values
        self.ready=True

    def capture(self):
        cs=self.domain.getCellSet()
        self.fields={label:list(cs.getScalarData(label)) for label in cs.getScalarDataLabels() if label in ('B_total','P_total','B_active','P_active')}
        for values in self.fields.values():
            if any(not math.isfinite(v) or v < -1e-5 for v in values):raise ValueError('농도 계산이 수렴하지 않았습니다. 시간이나 주입량을 줄여 주세요.')

    def implant(self,p):
        if not hasattr(ps,'IonImplantation'):raise ValueError('최신 계산 엔진 설치가 필요합니다. setup.cmd를 실행하세요.')
        if not self.ready:self.sync()
        species=SPECIES[p['species']]
        row=next((r for r in table(species+'_in_silicon_crystalline.csv') if float(r['energyKeV'])==float(p['energy'])),None)
        if row is None:raise ValueError('지원하는 주입 에너지를 선택하세요.')
        moments=[]
        for prefix in ['head','tail']:
            moment=ps.PearsonIVParameters()
            moment.mu=float(row[prefix+'Mu'])*.001;moment.sigma=float(row[prefix+'Sigma'])*.001
            moment.beta=float(row[prefix+'Beta']);moment.gamma=float(row[prefix+'Gamma']);moments.append(moment)
        model=ps.ImplantDualPearsonIV(*moments,float(row['headFraction']),0.,float(row['headLateralSigma'])*.001,0.,float(row['tailLateralSigma'])*.001)
        implant=ps.IonImplantation();implant.setImplantModel(model);implant.setDose(p['dose'])
        implant.setLengthUnit(1e-4);implant.setTiltAngle(7.);implant.setDoseControl(ps.ImplantDoseControl.WaferDose)
        implant.setMaskMaterials([m for m in self.domain.getMaterialsInDomain() if m!=ps.Material.Si])
        implant.setConcentrationLabel(p['species']+'_total')
        before=sum(self.fields.get(p['species']+'_total',[]))
        ps.Process(self.domain,implant,0.).apply();self.capture()
        if sum(self.fields[p['species']+'_total'])<=before:raise ValueError('주입 가능한 Si 표면이 없습니다. 상부 막이나 마스크 개구를 확인하세요.')
        self.last_info={'operation':'implant','species':p['species'],'energyKeV':p['energy'],'doseCm2':p['dose'],'tiltDeg':7,'rotationReferenceDeg':22,'profile':'public dual-Pearson IV; Gaussian lateral spread; non-Si layers fully block'}

    def anneal(self,p):
        if not self.ready or not any(k.endswith('_total') for k in self.fields):raise ValueError('도핑을 먼저 추가하세요.')
        rows=table('annealing.csv');temperature=p['temperature']+273.15
        diagnostics=[]
        for symbol,species in SPECIES.items():
            label=symbol+'_total'
            if label not in self.fields:continue
            # Public CSV column names are material/category/species/parameter/prefactor/activationEnergy.
            data={}
            for row in rows:
                vals=list(row.values())
                if len(vals)>=6 and vals[0].strip().lower()=='silicon' and vals[1].strip().lower()=='dopant' and vals[2].strip().lower()==species:
                    data[vals[3].strip().lower()]=(float(vals[4]),float(vals[5]))
            if 'd' not in data:raise ValueError('해당 도펀트의 확산 계수가 없습니다.')
            model=ps.Anneal();model.setSpeciesLabel(label);model.setTemperature(temperature);model.setDuration(p['time'])
            d0,ea=data['d'];model.setArrheniusParameters(d0*1e-6,ea)
            model.setMode(ps.AnnealMode.GaussSeidel);model.setTimeStep(min(1.,p['time']/20))
            model.setImplicitSolverOptions(800,1e-7,1.)
            model.setDiffusionMaterials([ps.Material.Si]);model.setBlockingMaterials([ps.Material.Air]+[m for m in self.domain.getMaterialsInDomain() if m!=ps.Material.Si])
            if 'solubility' in data:
                c0,e=data['solubility'];model.enableSolidActivation(True);model.setActiveLabel(symbol+'_active');model.setSolidSolubilityArrhenius(c0*1e-12,e)
            mass_before=sum(self.fields[label]);ps.Process(self.domain,model,0.).apply();self.capture();mass_after=sum(self.fields[label])
            relative=abs(mass_after-mass_before)/max(mass_before,1.)
            if relative>.005:raise ValueError('열처리 농도 보존 오차가 큽니다. 시간·온도를 줄여 주세요.')
            diagnostics.append({'species':symbol,'massRelativeError':relative,'diffusivityUm2PerS':d0*1e-6*math.exp(-ea/(8.617333262145e-5*temperature))})
        self.last_info={'operation':'anneal','temperatureC':p['temperature'],'timeS':p['time'],'diagnostics':diagnostics,'model':'intrinsic diffusion + equilibrium solid-solubility activation; no TED/defect kinetics'}

    def snapshot(self):
        if not self.ready or not self.fields:return None
        dx=self.domain.getCellSet().getGridDelta();positions=self.positions
        xmin=min(p[0] for p in positions)-dx/2;ymin=min(p[1] for p in positions)-dx/2
        nx=round((max(p[0] for p in positions)-xmin)/dx+.5);ny=round((max(p[1] for p in positions)-ymin)/dx+.5)
        indices=[round((p[1]-ymin)/dx-.5)*nx+round((p[0]-xmin)/dx-.5) for p in positions]
        mask=[0]*(nx*ny)
        for idx,m in zip(indices,self.materials):mask[idx]=int(int(m)==int(ps.Material.Si))
        fields={}
        for label,values in self.fields.items():
            grid=[0.]*(nx*ny)
            for idx,value,m in zip(indices,values,self.materials):
                if int(m)==int(ps.Material.Si):grid[idx]=float(f'{max(value,0.)*1e12:.6g}')
            fields[label]=grid
        for kind in ['total','active']:
            b=fields.get('B_'+kind,[0.]*(nx*ny));p=fields.get('P_'+kind,[0.]*(nx*ny))
            if 'B_'+kind in fields or 'P_'+kind in fields:fields['net_'+kind]=[a-c for a,c in zip(p,b)]
        return {'nx':nx,'ny':ny,'dx':dx,'origin':[round(xmin,6),round(ymin,6)],'unit':'cm^-3','mask':mask,'fields':fields,'info':self.last_info}
