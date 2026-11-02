"""Additive schema migration: old serialized recipes retain effective inputs."""
def extend(ops,n,choice):
    by={o['id']:o for o in ops}
    photo=by['photo']['fields'];photo[0]['options']=['HMDS','Coat','Soft bake','Patterning','Exposure','PEB','Develop','Hard bake','Ashing','Strip','Pattern']
    for f in photo:
        if f['key'] in ('pattern','width','pitch','offset'):f['when']['action'].append('Exposure')
        if f['key']=='thickness':f['when']['coat_mode']=['Thickness']
    photo.extend([
      choice('coat_mode','도포 조건',['Thickness','Spin'],'Thickness',{'action':['Coat']}),
      n('spin_speed','Spin speed',3000,500,7000,'RPM',100,{'action':['Coat'],'coat_mode':['Spin']}),
      n('spin_time','Spin time',30,5,120,'s',1,{'action':['Coat'],'coat_mode':['Spin']}),
      n('treatment_time','HMDS 시간',60,1,180,'s',1,{'action':['HMDS']}),
      n('bake_temperature','온도',105,60,220,'°C',1,{'action':['HMDS','Soft bake','Hard bake','PEB']}),
      n('bake_time','Bake 시간',60,1,300,'s',1,{'action':['Soft bake','Hard bake','PEB']}),
      choice('wavelength','광원 파장 · nm',[248,193,13.5],193,{'action':['Exposure']}),
      n('na','Numerical aperture',.85,.1,1.35,'',.01,{'action':['Exposure']}),
      n('exposure_dose','Exposure dose',40,1,200,'mJ/cm²',1,{'action':['Exposure']}),
      n('focus','Focus offset',0,-.5,.5,'µm',.01,{'action':['Exposure']}),
      n('developer_concentration','현상액 농도',2.38,.5,5,'%',.01,{'action':['Develop']}),
      n('oxygen_flow','O₂ 유량',100,10,500,'sccm',10,{'action':['Ashing']}),
      n('ash_time','Ashing 시간',60,1,300,'s',1,{'action':['Ashing']})])
    for key in ('etch','deposition','cmp'):
        fields=by[key]['fields'];fields.insert(0,choice('input_mode','입력 모델',['Effective','Equipment'],'Effective'))
        for f in fields:
            if f['key'] in ('rate','isotropic','sticking','exponent','gpc','ald_sticking'):
                f.setdefault('when',{})['input_mode']=['Effective']
            if f['key']=='time':f['max']=86400 if key!='cmp' else 300
            if f['key']=='rate' and key!='cmp':f.update(min=.000001,step=.000001)
    by['etch']['fields'].extend([
      choice('etchant','Etchant',['HF','H3PO4','HNA'],'HF',{'input_mode':['Equipment'],'method':['Isotropic']}),
      n('etch_temperature','용액 온도',25,10,200,'°C',1,{'input_mode':['Equipment'],'method':['Isotropic']}),
      choice('gas','반응 가스',['CF4','Cl2','HBr'],'CF4',{'input_mode':['Equipment'],'method':['Directional']}),
      n('rf_power','RF power',300,50,1500,'W',10,{'input_mode':['Equipment'],'method':['Directional']}),
      n('gas_flow','가스 유량',50,5,300,'sccm',5,{'input_mode':['Equipment'],'method':['Directional']}),
      n('pressure','챔버 압력',30,5,200,'mTorr',1,{'input_mode':['Equipment'],'method':['Directional']}),
      n('selectivity','타겟 / PR 선택비',10,1,100,'',1,{'input_mode':['Equipment'],'method':['Isotropic','Directional']})])
    by['etch']['fields'][0]['when']={'method':['Directional','Isotropic']}
    by['deposition']['fields'].extend([
      choice('cvd_access','막 성장 경계 조건',['Top surface','Section sides'],'Top surface',{'method':['CVD'],'material':['Si','SiGe','HfO2','TiN','W']}),
      n('pvd_pressure','Ar pressure',5,1,30,'mTorr',1,{'input_mode':['Equipment'],'method':['PVD']}),
      n('argon_flow','Ar flow',50,5,200,'sccm',5,{'input_mode':['Equipment'],'method':['PVD']}),
      n('cvd_pressure','챔버 압력',1,.1,10,'Torr',.1,{'input_mode':['Equipment'],'method':['CVD']}),
      n('power','DC / RF power',500,50,2000,'W',10,{'input_mode':['Equipment'],'method':['PVD','CVD']}),
      choice('cvd_type','CVD 방식',['Thermal CVD','LPCVD','PECVD'],'PECVD',{'input_mode':['Equipment'],'method':['CVD']}),
      choice('source_gas','Source 가스',['SiH4/O2','SiH4/NH3','SiH4','WF6/H2'],'SiH4/O2',{'input_mode':['Equipment'],'method':['CVD']}),
      n('source_flow','Source 유량',100,10,500,'sccm',10,{'input_mode':['Equipment'],'method':['CVD']}),
      n('depo_temperature','챔버 온도',400,200,800,'°C',10,{'input_mode':['Equipment'],'method':['CVD']}),
      choice('precursor','전구체',['TMA/H2O','TDMAH/H2O','BDEAS/O2','TiCl4/NH3'],'BDEAS/O2',{'input_mode':['Equipment'],'method':['ALD']}),
      n('purge_time','Purge 시간',2,.1,20,'s',.1,{'method':['ALD']})])
    for f in by['deposition']['fields']:
        if f['key']=='cycles':f['max']=10000
    by['diffusion']['fields'].extend([
      n('tilt','Tilt',7,0,45,'°',1,{'method':['Ion implantation']}),
      n('twist','Twist',0,0,360,'°',1,{'method':['Ion implantation']})])
    cmp=by['cmp']['fields'];cmp.insert(0,choice('action','작업',['CMP','Cleaning'],'CMP'))
    for f in cmp:
        if f['key']!='action':f.setdefault('when',{})['action']=['CMP']
    cmp.extend([
      n('overpolish_nm','금속 CMP 추가 연마 깊이',30,0,50,'nm',1,{'action':['CMP'],'slurry':['Silica tungsten','Cobalt formulated','Silica molybdenum']}),
      n('down_force','Down pressure',3,.5,8,'psi',.1,{'action':['CMP'],'input_mode':['Equipment']}),
      n('platen_speed','Platen speed',60,10,150,'RPM',1,{'action':['CMP'],'input_mode':['Equipment']}),
      choice('chemical','Chemical',['SPM','SC-1','SC-2','DHF'],'SC-1',{'action':['Cleaning']}),
      n('clean_time','세정 시간',60,1,180,'s',1,{'action':['Cleaning']})])
