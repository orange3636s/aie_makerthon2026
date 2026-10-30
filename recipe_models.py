"""Bounded teaching response models, not equipment-calibrated predictions.

Lengths um, time s, temperature C, pressure mTorr/psi as specified by schema.
Reference coefficients below are illustrative; provenance and limitations are in
docs/LOCAL_PROCESS_MODELS.md. Geometry remains a native level-set calculation.
"""
import math

KB=8.617333262145e-5
def clamp(x,a,b):return max(a,min(b,x))
def arrhenius(temp,reference,energy):
    return math.exp(clamp(-energy/KB*(1/(temp+273.15)-1/(reference+273.15)),-20,20))

def resolve(op,params,state):
    p=dict(params);m={};events=[];action=p.get('action');equipment=p.get('input_mode')=='Equipment'
    if op=='photo':
        if action=='HMDS':
            coverage=1-math.exp(-p['treatment_time']/30*arrhenius(p['bake_temperature'],110,.25))
            state['adhesion']=coverage;m.update(contactAngleDeg=25+50*coverage,adhesionIndex=coverage)
        elif action=='Coat':
            if p['coat_mode']=='Spin':p['thickness']=.06*math.sqrt(3000/p['spin_speed'])*(1+.2*math.exp(-p['spin_time']/15))
            state.update(solvent=1.,hardness=1.,photo_physics=False)
            m['prThicknessNm']=p['thickness']*1000
            if state.get('adhesion',1)<.4:events.append('PR_LIFTING_RISK')
        elif action in ('Soft bake','Hard bake','PEB'):
            t=p['bake_time'];T=p['bake_temperature']
            if action=='Soft bake':
                state['solvent']=math.exp(-t/40*arrhenius(T,95,.45));m['residualSolvent']=state['solvent']
                if state['solvent']>.5:events.append('RESIDUAL_SOLVENT')
                if T>180 and t>90:events.append('PR_THERMAL_DAMAGE_RISK')
            elif action=='PEB':
                D=.5*arrhenius(T,105,.6);state['acid_length']=math.sqrt(2*D*t);m['acidDiffusionNm']=state['acid_length']
                if state['acid_length']>35:events.append('PEB_CD_BLUR_RISK')
            else:
                state['hardness']=1+.8*(1-math.exp(-t/50*arrhenius(T,120,.4)));m['hardnessIndex']=state['hardness']
        elif action=='Exposure':
            resolution=.6*p['wavelength']/p['na'];dof=.5*p['wavelength']/p['na']**2
            focus_nm=p['focus']*1000;contrast=1/(1+(focus_nm/max(dof,1))**2)
            conversion=(1-math.exp(-p['exposure_dose']/35))*contrast*(1-.25*state.get('solvent',0))
            state.update(photo_physics=True,conversion=conversion,focus_nm=abs(focus_nm),resolution=resolution)
            m.update(resolutionNm=resolution,depthOfFocusNm=dof,conversion=conversion)
            if p['width']*1000<resolution:events.append('RESOLUTION_LIMIT')
            if contrast<.5:events.append('DEFOCUS')
        elif action=='Develop':
            # Legacy patterning retains its original 1 nm/s reference rate.
            rate=(.003*max(.02,state.get('conversion',0)) if state.get('photo_physics') else .001)*(p['developer_concentration']/2.38)
            p['develop_time']=rate/.001*p['develop_time'];m['dissolutionRateNmS']=rate*1000
            m['darkLossUm']=.00002*params['develop_time']*(params['developer_concentration']/2.38) if state.get('photo_physics') else 0.
            m['edgeBlurUm']=(state.get('focus_nm',0)*.06+state.get('acid_length',0)*.1)/1000
        elif action=='Ashing':
            m['prRemovalUm']=.002*(p['oxygen_flow']/100)**.5*p['ash_time']
    if equipment and op=='etch' and p['method']!='ALE':
        material=p['material']
        if p['method']=='Isotropic':
            table={'HF':{'SiO2':.003},'H3PO4':{'Si3N4':.002},'HNA':{'Si':.004,'PolySi':.004,'SiGe':.005}}
            base=table[p['etchant']].get(material)
            if base is None:raise ValueError('이 Etchant의 '+material+' 속도 모델은 없습니다. 유효 속도 모드를 사용하세요.')
            p['rate']=min(.05,base*arrhenius(p['etch_temperature'],25,.25));p['isotropic']=1.
        else:
            table={'CF4':{'SiO2':.003,'Si3N4':.002,'Si':.001},'Cl2':{'Si':.004,'PolySi':.004,'TiN':.002,'Al':.003},'HBr':{'Si':.002,'PolySi':.002}}
            base=table[p['gas']].get(material)
            if base is None:raise ValueError('이 가스의 '+material+' 속도 모델은 없습니다. 유효 속도 모드를 사용하세요.')
            p['rate']=min(.05,base*(p['rf_power']/300)**.5*(p['gas_flow']/50)**.3)
            p['isotropic']=clamp(.12*(p['pressure']/30)**.5*(300/p['rf_power'])**.3,.02,.85)
        m.update(etchRateNmS=p['rate']*1000,anisotropy=1-p['isotropic'],selectivity=p['selectivity'])
        m['prLossUm']=p['rate']*p['time']/p['selectivity']/state.get('hardness',1)
    if equipment and op=='deposition':
        mat=p['material']
        if p['method']=='PVD':
            rates={'Al':.004,'Cu':.003,'Ti':.002,'W':.0015,'Co':.002,'Mo':.0018,'TiN':.002,'Si':.003,'PolySi':.003,'SiO2':.002,'Si3N4':.0018}
            if mat not in rates:raise ValueError('이 재료의 PVD 기준 모델은 없습니다. 유효 속도 모드를 사용하세요.')
            p.update(rate=min(.05,rates[mat]*p['power']/500),sticking=.95,exponent=20.)
        elif p['method']=='CVD':
            allowed={'SiH4/O2':['SiO2'],'SiH4/NH3':['Si3N4'],'SiH4':['Si','PolySi'],'WF6/H2':['W']}
            if mat not in allowed[p['source_gas']]:raise ValueError('Source 가스와 증착 재료가 맞지 않습니다.')
            temperature=p['depo_temperature'];thermal=arrhenius(temperature,400,.3)
            plasma=(p['power']/300)**.3 if p['cvd_type']=='PECVD' else 1.
            p.update(rate=clamp(.002*thermal*(p['source_flow']/100)**.4*plasma,.00001,.03),sticking=clamp(.15*thermal,.03,.8),exponent=1.)
        elif p['method']=='ALD':
            recipes={'TMA/H2O':('Al2O3',.00011),'TDMAH/H2O':('HfO2',.00010),'BDEAS/O2':('SiO2',.00008),'TiCl4/NH3':('TiN',.00005)}
            material,gpc=recipes[p['precursor']]
            if mat!=material:raise ValueError('전구체와 증착 재료가 맞지 않습니다.')
            saturation=1-math.exp(-p['pulse']/.08);purge=1-math.exp(-p['purge_time']/.5)
            p['gpc']=gpc*saturation;m.update(saturation=saturation,purgeCompletion=purge)
            if purge<.9:events.append('ALD_INCOMPLETE_PURGE')
        m['nominalThicknessNm']=(p['gpc']*p['cycles'] if p['method']=='ALD' else p['rate']*p['time'])*1000
        if p['method']!='ALD':m['depositionRateNmS']=p['rate']*1000
    if op=='cmp':
        if action=='Cleaning':
            rates={'SPM':(.025,'organic',0.),'SC-1':(.02,'particles',.000015),'SC-2':(.025,'metal',0.),'DHF':(.01,'oxide',.0001)}
            k,kind,loss=rates[p['chemical']];removed=1-math.exp(-k*p['clean_time'])
            state[kind]=state.get(kind,1)*(1-removed);m.update(removalFraction=removed,filmLossUm=loss*p['clean_time'],contaminant=kind)
        elif equipment:
            factors={'Ceria oxide':1.2,'Silica oxide':1.,'Silica tungsten':.6,'Silica silicon':.8,'Silica polysilicon':.8,'Silica nitride':.35,'Silica SiGe':.7,'Cobalt formulated':.7,'Silica molybdenum':.6,'Silica TiN':.4,'Silica hafnia':.25}
            if p['slurry'] not in factors:raise ValueError('선택한 Slurry의 Preston 계수가 없습니다. 유효 속도 모드를 사용하세요.')
            velocity=2*math.pi*.15*p['platen_speed']/60
            p['rate']=.0001*factors[p['slurry']]*p['down_force']*velocity
            m.update(removalRateNmS=p['rate']*1000,velocityMS=velocity,removalBudgetNm=p['rate']*p['time']*1000)
    m['model']='educational-response-v1' if equipment or op=='photo' else 'effective-input'
    return p,m,events
