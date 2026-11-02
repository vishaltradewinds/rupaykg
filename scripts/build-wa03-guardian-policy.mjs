import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve('guardian-policies/WA03.001');
fs.mkdirSync(path.join(root,'schemas'), {recursive:true});

const ids = {
  applicability:'8b2d9c31-5c1b-4a7f-9b5a-000000000001',
  baseline:'8b2d9c31-5c1b-4a7f-9b5a-000000000002',
  monitoring:'8b2d9c31-5c1b-4a7f-9b5a-000000000003',
  calculation:'8b2d9c31-5c1b-4a7f-9b5a-000000000004',
  verification:'8b2d9c31-5c1b-4a7f-9b5a-000000000005'
};

function schema(id,name,description,properties,required){
  return {
    createDate:new Date().toISOString(), updateDate:new Date().toISOString(),
    uuid:id, hash:'', name, description, entity:'NONE', documentFileId:null, contextFileId:null,
    version:'1.0.0', sourceVersion:'BEE BM WA03.001 v1.0', creator:'', owner:'',
    topicId:null, messageId:null, documentURL:null, contextURL:`schema:${id}`,
    iri:`#${id}`, system:false, active:false, category:'POLICY', codeVersion:'1.5.1', defs:[], errors:[],
    document:{
      $id:`#${id}`,
      $comment:JSON.stringify({ '@id':`schema:${id}#${id}`, term:id }),
      title:name, description, type:'object',
      properties:{
        '@context':{oneOf:[{type:'string'},{type:'array',items:{type:'string'}}],readOnly:true},
        type:{oneOf:[{type:'string'},{type:'array',items:{type:'string'}}],readOnly:true},
        id:{type:'string',readOnly:true},
        ...properties
      },
      required:['@context','type',...required],
      additionalProperties:false
    },
    context:{'@context':Object.fromEntries(Object.keys(properties).map(k=>[k,{'@type':'https://www.schema.org/text'}]))}
  };
}

const number=(title,description)=>({title,description,readOnly:false,type:'number'});
const text=(title,description)=>({title,description,readOnly:false,type:'string'});
const evidence=(title,description)=>({title,description,readOnly:false,type:'string'});

const schemas=[
  schema(ids.applicability,'WA03.001 Project Applicability','BEE BM WA03.001 applicability, boundary and eligibility evidence.',{
    projectId:text('Project ID','RupayKg project/activity identifier'),
    landfillSite:text('Landfill Site','Landfill facility and physical boundary'),
    projectBoundary:text('Project Boundary','Sources/sinks included in the project boundary'),
    methaneRecoveryPathway:text('Methane Recovery Pathway','Recovery and destruction/use pathway'),
    projectStartDate:text('Project Start Date','Project activity start date'),
    eligibilityBasis:text('Eligibility Basis','Regulatory eligibility and ownership/control basis'),
    evidenceRef:evidence('Evidence Reference','Evidence package reference')
  },['projectId','landfillSite','projectBoundary','methaneRecoveryPathway','projectStartDate','eligibilityBasis','evidenceRef']),
  schema(ids.baseline,'WA03.001 Baseline Determination','Baseline methane determination with BM-T-011 dependency.',{
    activityId:text('Activity ID','RupayKg activity identifier'),
    baselineMethod:text('Baseline Method','BEE BM-T-011 method/version used'),
    fch4BL:number('FCH4,BL,y','Baseline methane quantity in tCH4 for the monitoring period'),
    bmT011Inputs:text('BM-T-011 Inputs','Reference to complete BM-T-011 input dataset'),
    bmT011Evidence:evidence('BM-T-011 Evidence','Evidence reference for BM-T-011 calculation'),
    baselineAssumptions:text('Baseline Assumptions','Explicit baseline assumptions')
  },['activityId','baselineMethod','fch4BL','bmT011Inputs','bmT011Evidence']),
  schema(ids.monitoring,'WA03.001 Project Monitoring','Measured methane recovery, oxidation, project emissions and leakage evidence.',{
    activityId:text('Activity ID','RupayKg activity identifier'),
    fch4PJ:number('FCH4,PJ,y','Project methane quantity in tCH4 for the monitoring period'),
    ox:number('OX','Oxidation factor supported by authoritative evidence'),
    pey:number('PEy','Project emissions in tCO2e'),
    ley:number('LEy','Leakage emissions in tCO2e'),
    measurementEvidence:evidence('Measurement Evidence','Raw measurement/evidence reference'),
    calibrationEvidence:evidence('Calibration Evidence','Instrument calibration evidence reference'),
    dataGapTreatment:text('Data Gap Treatment','Methodology-compliant treatment of missing data'),
    unitsConfirmed:text('Units Confirmed','Explicit confirmation that all measurement units are correct')
  },['activityId','fch4PJ','ox','pey','ley','measurementEvidence','calibrationEvidence','unitsConfirmed']),
  schema(ids.calculation,'WA03.001 Equation 4 Result','Deterministic WA03.001 Equation 4 calculation output.',{
    activityId:text('Activity ID','RupayKg activity identifier'),
    fch4PJ:number('FCH4,PJ,y','Project methane quantity in tCH4'),
    fch4BL:number('FCH4,BL,y','Baseline methane quantity in tCH4'),
    gwpCH4:number('GWPCH4','Methane GWP in tCO2e/tCH4; locked to 29.8 by WA03.001'),
    ox:number('OX','Oxidation factor'),
    pey:number('PEy','Project emissions in tCO2e'),
    ley:number('LEy','Leakage emissions in tCO2e'),
    ery:number('ERy,calculated','Calculated emission reductions in tCO2e')
  },['activityId','fch4PJ','fch4BL','gwpCH4','ox','pey','ley','ery']),
  schema(ids.verification,'WA03.001 Verification Decision','Independent verification freeze and decision.',{
    verificationId:text('Verification ID','RupayKg verification identifier'),
    methodologyCode:text('Methodology Code','Must be WA03.001'),
    methodologyVersion:text('Methodology Version','Must be 1.0'),
    evidenceComplete:text('Evidence Complete','Mandatory evidence completeness decision'),
    calculationFrozen:text('Calculation Frozen','Calculation inputs frozen before decision'),
    verifierDecision:text('Verifier Decision','VERIFIED or REJECTED'),
    verifierComments:text('Verifier Comments','Independent verification notes'),
    provenanceRef:evidence('Provenance Reference','Evidence/provenance package reference')
  },['verificationId','methodologyCode','methodologyVersion','evidenceComplete','calculationFrozen','verifierDecision','provenanceRef'])
];
for(const s of schemas) fs.writeFileSync(path.join(root,'schemas',`#${s.uuid}.json`),JSON.stringify(s,null,2));

const uuid=()=>crypto.randomUUID();
const block=(blockType,tag,permissions,extra={})=>({id:uuid(),blockType,defaultActive:true,permissions,onErrorAction:'no-action',uiMetaData:{},tag,children:[],events:[],artifacts:[],...extra});
const pp='Project Proponent', vv='Verification Body';

const choose=block('policyRolesBlock','Choose_Role',['NO_ROLE'],{roles:[pp,vv]});
const a=block('requestVcDocumentBlock','wa03_applicability_form',[pp],{uiMetaData:{type:'page',title:'WA03.001 Applicability'},presetFields:[],schema:`#${ids.applicability}`,idType:'UUID'});
const b=block('requestVcDocumentBlock','wa03_baseline_form',[pp],{uiMetaData:{type:'page',title:'WA03.001 Baseline / BM-T-011'},presetFields:[],schema:`#${ids.baseline}`,idType:'UUID'});
const m=block('requestVcDocumentBlock','wa03_monitoring_form',[pp],{uiMetaData:{type:'page',title:'WA03.001 Monitoring'},presetFields:[],schema:`#${ids.monitoring}`,idType:'UUID'});
const calc=block('calculateContainerBlock','wa03_equation4_calc',[pp],{
  inputSchema:`#${ids.monitoring}`,
  inputFields:[
    {name:'fch4PJ',title:'FCH4,PJ,y',value:'E_FCH4_PJ'},
    {name:'fch4BL',title:'FCH4,BL,y',value:'E_FCH4_BL'},
    {name:'ox',title:'OX',value:'E_OX'},
    {name:'pey',title:'PEy',value:'E_PE'},
    {name:'ley',title:'LEy',value:'E_LE'},
    {name:'activityId',title:'Activity ID',value:'E_ACTIVITY'}
  ],
  outputSchema:`#${ids.calculation}`,
  outputFields:[
    {name:'activityId',title:'Activity ID',value:'E_ACTIVITY'},
    {name:'fch4PJ',title:'FCH4,PJ,y',value:'E_FCH4_PJ'},
    {name:'fch4BL',title:'FCH4,BL,y',value:'E_FCH4_BL'},
    {name:'gwpCH4',title:'GWPCH4',value:'E_GWP'},
    {name:'ox',title:'OX',value:'E_OX'},
    {name:'pey',title:'PEy',value:'E_PE'},
    {name:'ley',title:'LEy',value:'E_LE'},
    {name:'ery',title:'ERy,calculated',value:'E_ER'}
  ],
  children:[{
    id:uuid(),blockType:'calculateMathAddonBlock',defaultActive:true,permissions:[pp],onErrorAction:'no-action',uiMetaData:{},tag:'wa03_equation4_math',children:[],events:[],artifacts:[],
    equations:[
      {variable:'E_GWP',formula:'29.8'},
      {variable:'E_ER',formula:'(E_FCH4_PJ-E_FCH4_BL)*E_GWP*(1-E_OX)-E_PE-E_LE'}
    ]
  }]
});
const v=block('requestVcDocumentBlock','wa03_verification_form',[vv],{uiMetaData:{type:'page',title:'WA03.001 Independent Verification'},presetFields:[],schema:`#${ids.verification}`,idType:'UUID'});
const rootBlock={id:uuid(),blockType:'interfaceContainerBlock',permissions:['ANY_ROLE'],onErrorAction:'no-action',uiMetaData:{type:'blank',fields:[]},options:[],dataSource:'auto',tag:'WA03_001_ROOT',children:[
  choose,
  {id:uuid(),blockType:'interfaceContainerBlock',defaultActive:true,permissions:[pp],onErrorAction:'no-action',uiMetaData:{type:'tabs'},tag:'Project_Proponent',children:[a,b,m,calc],events:[],artifacts:[]},
  {id:uuid(),blockType:'interfaceContainerBlock',defaultActive:true,permissions:[vv],onErrorAction:'no-action',uiMetaData:{type:'tabs'},tag:'Verification_Body',children:[v],events:[],artifacts:[]}
],events:[],artifacts:[]};

const policy={
  updateDate:new Date().toISOString(),uuid:'2b1dbf72-0d6c-4d90-9e16-5e8b8c000301',
  name:'RupayKg BM WA03.001 Landfill Methane Recovery',version:'1.0.0',
  description:'Guardian-native dMRV policy specification for BEE BM WA03.001 v1.0. BEE is the controlling regulatory authority. Guardian examples are not substituted.',
  topicDescription:'RupayKg WA03.001 policy',
  creator:'',owner:'',policyRoles:[pp,vv,'NO_ROLE','OWNER'],policyNavigation:[],
  policyGroups:[],policyTopics:[],policyTokens:[],instanceTopicId:null,synchronizationTopicId:null,
  policyTag:'rupaykg_wa03_001_v1',codeVersion:'1.5.1',hash:'',hashMapFileId:null,
  importantParameters:{atValidation:'WA03.001 applicability, baseline, monitoring and independent verification evidence',monitored:'FCH4,PJ,y; FCH4,BL,y; GWPCH4=29.8; OX; PEy; LEy'},
  typicalProjects:'Indian landfill methane recovery projects',applicabilityConditions:'BEE BM WA03.001 v1.0 applicability and regulatory eligibility',
  categories:['','', ''],categoriesExport:[],detailsUrl:'https://beeindia.gov.in/sites/default/files/BM%20WA03.001.pdf',
  tools:[],config:rootBlock
};
fs.writeFileSync(path.join(root,'policy.json'),JSON.stringify(policy,null,2));
fs.writeFileSync(path.join(root,'README.md'),`# RupayKg Guardian Policy — BM WA03.001\n\nThis bundle is an implementation build artifact, not yet published.\n\nControlling methodology: BEE BM WA03.001 v1.0.\nEquation 4: (FCH4,PJ,y − FCH4,BL,y) × 29.8 × (1 − OX) − PEy − LEy.\n\nThe bundle deliberately does not contain fabricated Guardian IDs, Hedera message IDs, signatures, or publication evidence. Guardian must validate/import it before it becomes a real policy instance.\n`);
console.log('WA03.001 policy bundle source generated');
