import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, type AuthContext } from "./auth.js";
import { withDatabaseTenantContext } from "./db-context.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLATFORM=["platform_admin","super_admin"] as const;
const STATE=["state_admin","regulator"] as const;
function bodyOf(r:{body:unknown}){return r.body&&typeof r.body==="object"?r.body as Record<string,unknown>:{};}
function text(b:Record<string,unknown>,k:string){return typeof b[k]==="string"&&b[k].trim()?b[k].trim():null;}
async function authn(request:any,reply:any,pool:Pool|null):Promise<AuthContext|null>{if(!pool){reply.code(503).send({error:"Database unavailable",code:"DATABASE_UNAVAILABLE"});return null;}const a=await authenticate(request,pool);if(!a){reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});return null;}return a;}
async function hasAuthority(db:Pool|PoolClient,a:AuthContext,roles:readonly string[],geo:string|null){const r=await db.query<{ok:boolean}>(`select exists(select 1 from organization_memberships om join roles r on r.id=om.role_id where om.identity_id=$1 and om.status='VERIFIED' and r.name=any($2::text[]) and ($3::uuid is null or organization_has_geography_scope(om.organization_id,$3))) ok`,[a.identityId,roles,geo]);return r.rows[0]?.ok===true;}
function levels(kind:string|null){if(["ULB","WARD","LOCALITY","GRAM_PANCHAYAT","VILLAGE","CLUSTER"].includes(kind??""))return ["LOCAL","DISTRICT","STATE","PLATFORM"];if(["SUB_DISTRICT","DISTRICT"].includes(kind??""))return ["DISTRICT","STATE","PLATFORM"];if(kind==="STATE_UT")return ["STATE","PLATFORM"];return ["PLATFORM"];}
function localRoles(kind:string|null){return ["ULB","WARD","LOCALITY"].includes(kind??"")?["municipal_admin"]:["regulator"];}
async function eligible(db:Pool|PoolClient,a:AuthContext,level:string,kind:string|null,geo:string|null){if(level==="PLATFORM")return hasAuthority(db,a,PLATFORM,null);if(level==="STATE")return hasAuthority(db,a,STATE,geo);if(level==="DISTRICT")return hasAuthority(db,a,["regulator","state_admin"],geo);return hasAuthority(db,a,localRoles(kind),geo);}

export async function registerOnboardingHierarchyRoutes(app:FastifyInstance,pool:Pool|null):Promise<void>{
  app.get("/api/v1/onboarding/review-queue",async(request,reply)=>{
    const a=await authn(request,reply,pool); if(!a||!pool)return;
    const activeOrganizationId=a.activeOrganizationId;
    if(!activeOrganizationId)return reply.code(403).send({error:"Active organization is required",code:"ACTIVE_ORGANIZATION_REQUIRED"});
    try{
      const applications=await withDatabaseTenantContext(pool,{identityId:a.identityId,organizationId:activeOrganizationId,bilateralOrganizationScope:false,serviceMode:false},async(db)=>{
        const rows=await db.query(`select sa.id,sa.organization_id,sa.identity_id as applicant_identity_id,sa.requested_role_key,sa.requested_organization_type,sa.geography_id,sa.status,sa.applicant_note,sa.created_at,sa.reviewed_at,sa.review_note,o.name organization_name,o.legal_name,o.legal_form,o.registration_identifier,o.registration_authority,o.verification_status,o.verification_note,(select count(*) from organization_verification_evidence e where e.organization_id=o.id) evidence_count,g.name geography_name,g.kind geography_kind,i.display_name applicant_name,i.email applicant_email from stakeholder_applications sa join organizations o on o.id=sa.organization_id left join geography g on g.id=sa.geography_id left join identities i on i.id=sa.identity_id where sa.status='PENDING' order by sa.created_at`);
        const result=[];
        for(const r of rows.rows){
          const approvals=await db.query(`select step_order,approval_level,geography_id,status,approved_by_identity_id,reviewed_at,review_note from stakeholder_application_approvals where application_id=$1 order by step_order`,[r.id]);
          const next=approvals.rows.find((x:any)=>x.status==="PENDING")??null;
          const canReview=next?await eligible(db,a,next.approval_level,r.geography_kind??null,r.geography_id??null):false;
          const canVerifyLegal=r.requested_organization_type!=="individual"&&r.verification_status!=="VERIFIED"&&await hasAuthority(db,a,PLATFORM,null);
          if(canReview||canVerifyLegal)result.push({...r,approvals:approvals.rows,nextApproval:next,canReview,canVerifyLegal});
        }
        return result;
      });
      return{source:"postgresql",syntheticData:false,applications};
    }catch(e){request.log.error(e);return reply.code(503).send({error:"Stakeholder review queue unavailable",code:"ONBOARDING_QUEUE_UNAVAILABLE"});}
  });

  app.post("/api/v1/onboarding/applications/:applicationId/verify-legal",async(request,reply)=>{
    const a=await authn(request,reply,pool); if(!a||!pool)return;
    const activeOrganizationId=a.activeOrganizationId;
    if(!activeOrganizationId)return reply.code(403).send({error:"Active organization is required",code:"ACTIVE_ORGANIZATION_REQUIRED"});
    const id=(request.params as any).applicationId;
    if(!UUID.test(id))return reply.code(400).send({error:"Invalid application id",code:"INVALID_APPLICATION_ID"});
    const b=bodyOf(request),status=text(b,"verificationStatus"),note=text(b,"verificationNote");
    if(!note||!["VERIFIED","REJECTED"].includes(status??""))return reply.code(400).send({error:"verificationStatus and verificationNote are required",code:"LEGAL_REVIEW_INVALID"});
    try{
      const result=await withDatabaseTenantContext(pool,{identityId:a.identityId,organizationId:activeOrganizationId,bilateralOrganizationScope:false,serviceMode:false},async(db)=>{
        if(!await hasAuthority(db,a,PLATFORM,null))throw Object.assign(new Error("Platform authority required for legal verification"),{code:"ONBOARDING_AUTHORITY_FORBIDDEN"});
        const q=await db.query<{organization_id:string}>("select organization_id from stakeholder_applications where id=$1 and status='PENDING' for update",[id]);
        if(!q.rows[0])throw Object.assign(new Error("Pending stakeholder application not found"),{code:"APPLICATION_NOT_FOUND"});
        const oid=q.rows[0].organization_id;
        if(status==="VERIFIED"){
          const evidence=await db.query<{count:string}>(`select count(*)::text as count from organization_verification_evidence where organization_id=$1 and document_reference is not null and btrim(document_reference)<>'' and content_hash is not null and btrim(content_hash)<>''`,[oid]);
          if(Number(evidence.rows[0]?.count??0)<1)throw Object.assign(new Error("At least one persisted legal evidence reference with a content hash is required before legal verification."),{code:"LEGAL_EVIDENCE_MISSING"});
        }
        await db.query("update organization_verification_evidence set status=$1,verification_note=$2,verified_by_identity_id=$3,verified_at=now() where organization_id=$4 and status in ('PENDING','REJECTED')",[status,note,a.identityId,oid]);
        await db.query("update organizations set verification_status=$1,verification_note=$2,verified_by_identity_id=case when $1='VERIFIED' then $3 else null end,verified_at=case when $1='VERIFIED' then now() else null end where id=$4",[status,note,a.identityId,oid]);
        return{status,organizationId:oid};
      });
      return{source:"postgresql",syntheticData:false,status:result.status,organizationId:result.organizationId};
    }catch(e){
      request.log.error(e); const code=(e as {code?:string}).code;
      if(code==="ONBOARDING_AUTHORITY_FORBIDDEN")return reply.code(403).send({error:"Platform authority required for legal verification",code});
      if(code==="APPLICATION_NOT_FOUND")return reply.code(404).send({error:"Pending stakeholder application not found",code});
      if(code==="LEGAL_EVIDENCE_MISSING")return reply.code(409).send({error:"At least one persisted legal evidence reference with a content hash is required before legal verification.",code});
      return reply.code(503).send({error:"Legal verification unavailable",code:"LEGAL_REVIEW_UNAVAILABLE"});
    }
  });

  app.post("/api/v1/onboarding/applications/:applicationId/:action",async(request,reply)=>{
    const a=await authn(request,reply,pool); if(!a||!pool)return;
    const activeOrganizationId=a.activeOrganizationId;
    if(!activeOrganizationId)return reply.code(403).send({error:"Active organization is required",code:"ACTIVE_ORGANIZATION_REQUIRED"});
    const p=request.params as any,id=p.applicationId,action=p.action;
    if(!UUID.test(id)||!["approve","reject"].includes(action))return reply.code(400).send({error:"Invalid onboarding decision",code:"INVALID_DECISION"});
    const b=bodyOf(request),note=text(b,"reviewNote");
    if(action==="reject"&&!note)return reply.code(400).send({error:"A review rationale is required when rejecting an application.",code:"REVIEW_NOTE_REQUIRED"});
    try{
      const result=await withDatabaseTenantContext(pool,{identityId:a.identityId,organizationId:activeOrganizationId,bilateralOrganizationScope:false,serviceMode:false},async(db)=>{
        const q=await db.query<any>(`select sa.*,g.kind geography_kind,o.verification_status from stakeholder_applications sa left join geography g on g.id=sa.geography_id join organizations o on o.id=sa.organization_id where sa.id=$1 and sa.status='PENDING' for update`,[id]);
        const appn=q.rows[0];
        if(!appn)throw Object.assign(new Error("Pending stakeholder application not found"),{code:"APPLICATION_NOT_FOUND"});
        const chain=await db.query<any>("select * from stakeholder_application_approvals where application_id=$1 order by step_order for update",[id]);
        const next=chain.rows.find((x:any)=>x.status==="PENDING");
        if(!next)throw Object.assign(new Error("No pending approval step remains"),{code:"APPROVAL_CHAIN_COMPLETE"});
        if(!await eligible(db,a,next.approval_level,appn.geography_kind??null,appn.geography_id??null))throw Object.assign(new Error(`Authorized ${next.approval_level.toLowerCase()} authority required`),{code:"ONBOARDING_AUTHORITY_FORBIDDEN",requiredLevel:next.approval_level});
        if(next.approval_level==="PLATFORM"&&action==="approve"&&appn.requested_organization_type!=="individual"&&appn.verification_status!=="VERIFIED")throw Object.assign(new Error("Legal organization verification must be VERIFIED before final platform approval"),{code:"LEGAL_VERIFICATION_REQUIRED"});
        if(action==="reject"){
          await db.query("update stakeholder_application_approvals set status='REJECTED',approved_by_identity_id=$2,reviewed_at=now(),review_note=$3 where id=$1",[next.id,a.identityId,note]);
          await db.query("update stakeholder_applications set status='REJECTED',reviewed_by_identity_id=$2,reviewed_at=now(),review_note=$3 where id=$1",[id,a.identityId,note]);
          await db.query("update organization_memberships set status='REJECTED' where organization_id=$1 and identity_id=$2 and status='PENDING'",[appn.organization_id,appn.identity_id]);
          await db.query("update organization_geography_scopes set status='REJECTED' where organization_id=$1 and status='PENDING'",[appn.organization_id]);
          await db.query("update organizations set status='REJECTED',verification_status=case when verification_status='VERIFIED' then verification_status else 'REJECTED' end,verification_note=coalesce(verification_note,$2) where id=$1",[appn.organization_id,note]);
          return{status:"REJECTED",approvalLevel:next.approval_level};
        }
        await db.query("update stakeholder_application_approvals set status='APPROVED',approved_by_identity_id=$2,reviewed_at=now(),review_note=$3 where id=$1",[next.id,a.identityId,note]);
        const rem=await db.query<{count:string}>("select count(*)::text count from stakeholder_application_approvals where application_id=$1 and status<>'APPROVED'",[id]);
        const remaining=Number(rem.rows[0]?.count??0);
        if(remaining===0){
          await db.query("update stakeholder_applications set status='APPROVED',reviewed_by_identity_id=$2,reviewed_at=now(),review_note=$3 where id=$1",[id,a.identityId,note]);
          await db.query("update organizations set status='VERIFIED',verification_status='VERIFIED',verified_by_identity_id=$2,verified_at=now() where id=$1",[appn.organization_id,a.identityId]);
          await db.query("update organization_memberships set status='VERIFIED' where organization_id=$1 and identity_id=$2 and status='PENDING'",[appn.organization_id,appn.identity_id]);
          await db.query("update organization_geography_scopes set status='VERIFIED' where organization_id=$1 and status='PENDING'",[appn.organization_id]);
        }
        return{status:remaining===0?"APPROVED":"PENDING",approvalLevel:next.approval_level};
      });
      return{source:"postgresql",syntheticData:false,status:result.status,approvalLevel:result.approvalLevel};
    }catch(e){
      request.log.error(e); const code=(e as {code?:string}).code;
      if(code==="ONBOARDING_AUTHORITY_FORBIDDEN")return reply.code(403).send({error:"Authorized authority required",code,requiredLevel:(e as {requiredLevel?:string}).requiredLevel});
      if(code==="LEGAL_VERIFICATION_REQUIRED")return reply.code(409).send({error:"Legal organization verification must be VERIFIED before final platform approval",code});
      if(code==="APPLICATION_NOT_FOUND")return reply.code(404).send({error:"Pending stakeholder application not found",code});
      if(code==="APPROVAL_CHAIN_COMPLETE")return reply.code(409).send({error:"No pending approval step remains",code});
      return reply.code(503).send({error:"Stakeholder approval could not be recorded",code:"ONBOARDING_DECISION_UNAVAILABLE"});
    }
  });
}
