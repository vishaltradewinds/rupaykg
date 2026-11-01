import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, issueOpaqueToken, type AuthContext } from "./auth.js";
import { getPermissionsForRole } from "./rbac-policy.js";

type Body = Record<string, unknown>;
const text = (body: Body, key: string) => typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null;
export const STAKEHOLDER_OPTIONS = [["citizen","Citizen / household / waste generator","individual"],["farmer","Farmer / rural producer","rural_enterprise"],["safai_mitra","Waste collection worker / Safai Mitra","collection_operator"],["fpo","FPO / rural enterprise / Panchayat partner","rural_institution"],["municipal_admin","ULB / municipal authority","ulb"],["municipal_generator","Municipal / bulk facility generator","bulk_generator"],["aggregator","Aggregator / transporter","logistics"],["processor","MRF / recycler / processor / treatment facility","processing_facility"],["industry_generator","Industrial generator","industrial_generator"],["commercial_generator","Commercial / bulk waste generator","commercial_generator"],["institution_generator","Institutional generator","institutional_generator"],["PROJECT_OWNER","Carbon project owner","carbon_project"],["ACVA_USER","Accredited Carbon Verification Agency user","acva"],["ccc_buyer","Carbon / ESG buyer","buyer"],["epr_partner","Producer / brand owner / importer / EPR partner","epr"],["csr_partner","CSR / ESG partner","csr"],["regulator","Regulator / public authority","regulator"]] as const;
type StakeholderRoleKey=typeof STAKEHOLDER_OPTIONS[number][0];
const roleKeys=new Set<StakeholderRoleKey>(STAKEHOLDER_OPTIONS.map(([key])=>key));
const hash=(token:string)=>createHash("sha256").update(token).digest("hex");
const bodyOf=(request:{body:unknown}):Body=>request.body&&typeof request.body==="object"?request.body as Body:{};
const emailOf=(body:Body)=>text(body,"email")?.toLowerCase()??null;
const organizationRequiresLegalVerification=(organizationType:string)=>organizationType!=="individual";
const validPassword=(password:string)=>password.length>=10&&password.length<=200;
function passwordHash(password:string,salt=randomBytes(16).toString("base64url")){return {salt,hash:scryptSync(password,salt,64).toString("base64url")};}
function passwordMatches(password:string,salt:string,stored:string){try{const derived=scryptSync(password,salt,64);const a=Buffer.from(stored,"base64url");return a.length===derived.length&&timingSafeEqual(a,derived);}catch{return false;}}
async function requireAuth(request:any,reply:any,pool:Pool|null):Promise<AuthContext|null>{if(!pool){reply.code(503).send({error:"Database unavailable",code:"DATABASE_UNAVAILABLE"});return null;}try{const auth=await authenticate(request,pool);if(!auth){reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});return null;}return auth;}catch(error){request.log.error(error);reply.code(503).send({error:"Authentication service unavailable",code:"AUTH_UNAVAILABLE"});return null;}}
type LoginCandidate={identity_id:string;display_name:string;email:string|null;identity_status:string;suspended_at:Date|null;password_hash:string;password_salt:string;password_algorithm:string;failed_attempts:number;locked_until:Date|null};
type SelfAccountContext={identity:{id:string;display_name:string;email:string|null;status:string}|null;memberships:unknown[];applications:unknown[]};
async function readSelfContext(authPool:Pool,tokenHash:string,expectedIdentityId?:string):Promise<SelfAccountContext|null>{
 const result=await authPool.query<{context:SelfAccountContext|null}>(`select auth_private.get_self_account_context($1) as context`,[tokenHash]);
 const context=result.rows[0]?.context??null;
 if(!context?.identity||!Array.isArray(context.memberships)||!Array.isArray(context.applications))return null;
 if(expectedIdentityId&&context.identity.id!==expectedIdentityId)return null;
 return context;
}

export async function registerAuthRoutes(app:FastifyInstance,pool:Pool|null,authPool:Pool|null):Promise<void>{
 app.post("/api/v1/auth/register",async(request,reply)=>{
  if(!authPool)return reply.code(503).send({error:"Authentication database unavailable",code:"AUTH_DATABASE_UNAVAILABLE"});
  const body=bodyOf(request),email=emailOf(body),name=text(body,"name"),password=text(body,"password");
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!password||!validPassword(password))return reply.code(400).send({error:"A valid email and a password of 10–200 characters are required",code:"INVALID_CREDENTIALS"});
  const credentials=passwordHash(password);
  try{
   const result=await authPool.query<{identity_id:string}>(`select auth_private.register_identity($1,$2,$3,$4) as identity_id`,[email,name?.trim()||email,credentials.hash,credentials.salt]);
   const identityId=result.rows[0]?.identity_id;
   if(!identityId)throw new Error("IDENTITY_REGISTRATION_RETURNED_NO_ID");
   return reply.code(201).send({source:"postgresql",syntheticData:false,identity:{id:identityId,display_name:name?.trim()||email,email,status:"VERIFIED"},message:"Account created. Sign in to begin stakeholder onboarding. Organization access remains subject to verified membership and hierarchy approval."});
  }catch(error){
   if((error as {code?:string})?.code==="23505")return reply.code(409).send({error:"An account with this email already exists",code:"ACCOUNT_EXISTS"});
   request.log.error(error);return reply.code(503).send({error:"Account could not be created",code:"REGISTRATION_UNAVAILABLE"});
  }
 });
 app.post("/api/v1/auth/login",async(request,reply)=>{
  if(!authPool)return reply.code(503).send({error:"Authentication database unavailable",code:"AUTH_DATABASE_UNAVAILABLE"});
  const body=bodyOf(request),email=emailOf(body),password=text(body,"password");
  if(!email||!password)return reply.code(400).send({error:"Email and password are required",code:"INVALID_CREDENTIALS"});
  try{
   const result=await authPool.query<LoginCandidate>(`select * from auth_private.find_login_candidate($1)`,[email]);
   const row=result.rows[0];
   if(!row||(row.locked_until&&row.locked_until.getTime()>Date.now()))return reply.code(401).send({error:"Invalid email or password",code:"INVALID_CREDENTIALS"});
   if(row.password_algorithm!=="scrypt"||!passwordMatches(password,row.password_salt,row.password_hash)){
    await authPool.query(`select auth_private.record_login_failure($1)`,[row.identity_id]);
    return reply.code(401).send({error:"Invalid email or password",code:"INVALID_CREDENTIALS"});
   }
   await authPool.query(`select auth_private.reset_login_failures($1)`,[row.identity_id]);
   if(row.identity_status!=="VERIFIED"||row.suspended_at)return reply.code(403).send({error:row.suspended_at?"RupayKG identity is suspended":"RupayKG identity is not active",code:row.suspended_at?"IDENTITY_SUSPENDED":"IDENTITY_INACTIVE"});
   const sessionToken=issueOpaqueToken(),tokenHash=hash(sessionToken);
   const issued=await authPool.query<{issued:boolean}>(`select auth_private.issue_session($1,$2,$3::jsonb) as issued`,[row.identity_id,tokenHash,JSON.stringify({provider:"rupaykg-native",auth_time:Math.floor(Date.now()/1000)})]);
   if(issued.rows[0]?.issued!==true)throw new Error("AUTH_SESSION_ISSUE_REJECTED");
   const context=await readSelfContext(authPool,tokenHash,row.identity_id);
   if(!context)throw new Error("AUTH_SELF_CONTEXT_UNAVAILABLE_AFTER_LOGIN");
   return {source:"postgresql",syntheticData:false,sessionToken,expiresInSeconds:28800,identity:{id:row.identity_id,displayName:row.display_name,email:row.email},memberships:context.memberships,applications:context.applications};
  }catch(error){request.log.error(error);return reply.code(503).send({error:"Authentication service unavailable",code:"AUTH_UNAVAILABLE"});}
 });
 app.get("/api/v1/auth/me",async(request,reply)=>{
  if(!authPool)return reply.code(503).send({error:"Authentication database unavailable",code:"AUTH_DATABASE_UNAVAILABLE"});
  const auth=await requireAuth(request,reply,pool);if(!auth)return;
  const header=request.headers.authorization;
  if(!header?.startsWith("Bearer "))return reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});
  try{
   const context=await readSelfContext(authPool,hash(header.slice(7).trim()),auth.identityId);
   if(!context)return reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});
   return {source:"postgresql",syntheticData:false,identity:context.identity,memberships:context.memberships,applications:context.applications};
  }catch(error){request.log.error(error);return reply.code(503).send({error:"Account context unavailable",code:"AUTH_CONTEXT_UNAVAILABLE"});}
 });
 app.post("/api/v1/auth/logout",async(request,reply)=>{
  if(!authPool)return reply.code(503).send({error:"Authentication database unavailable",code:"AUTH_DATABASE_UNAVAILABLE"});
  const header=request.headers.authorization;
  if(header?.startsWith("Bearer ")){
   try{await authPool.query(`select auth_private.revoke_session($1)`,[hash(header.slice(7).trim())]);}
   catch(error){request.log.error(error);return reply.code(503).send({error:"Session revocation unavailable",code:"SESSION_REVOCATION_UNAVAILABLE"});}
  }
  return reply.code(204).send();
 });
 app.get("/api/v1/onboarding/options",async()=>({source:"application",syntheticData:false,stakeholders:STAKEHOLDER_OPTIONS.map(([key,label,organizationType])=>({key,label,organizationType}))}));
 app.post("/api/v1/onboarding/applications",async(request,reply)=>{const auth=await requireAuth(request,reply,pool);if(!auth||!pool)return;const body=bodyOf(request),organizationName=text(body,"organizationName"),roleKeyText=text(body,"roleKey"),note=text(body,"applicantNote"),geographyId=text(body,"geographyId");const legalName=text(body,"legalName")??organizationName,legalForm=text(body,"legalForm"),registrationIdentifier=text(body,"registrationIdentifier"),registrationAuthority=text(body,"registrationAuthority"),evidenceType=text(body,"evidenceType"),documentReference=text(body,"documentReference"),contentHash=text(body,"contentHash"),issuerName=text(body,"issuerName"),issuedAt=text(body,"issuedAt"),expiresAt=text(body,"expiresAt");if(!organizationName||!roleKeyText||!roleKeys.has(roleKeyText as StakeholderRoleKey))return reply.code(400).send({error:"organizationName and a supported stakeholder role are required",code:"INVALID_ONBOARDING"});const roleKey=roleKeyText as StakeholderRoleKey;const option=STAKEHOLDER_OPTIONS.find(([key])=>key===roleKey);if(!option)return reply.code(400).send({error:"Unsupported stakeholder role",code:"INVALID_ONBOARDING"});if(organizationRequiresLegalVerification(option[2])&&(!legalName||!legalForm||!registrationIdentifier||!registrationAuthority))return reply.code(400).send({error:"Legal name, legal form, registration identifier and registration authority are required for organization-backed stakeholder onboarding",code:"LEGAL_IDENTITY_REQUIRED"});if(organizationRequiresLegalVerification(option[2])&&(!evidenceType||!documentReference||!contentHash))return reply.code(400).send({error:"At least one legal verification evidence reference and content hash are required for organization-backed stakeholder onboarding",code:"LEGAL_EVIDENCE_REQUIRED"});if(geographyId&&!(await pool.query("select id from geography where id=$1",[geographyId])).rows[0])return reply.code(400).send({error:"Selected geography does not exist",code:"GEOGRAPHY_NOT_FOUND"});if((await pool.query(`select id from stakeholder_applications where identity_id=$1 and status in('PENDING','APPROVED') limit 1`,[auth.identityId])).rows[0])return reply.code(409).send({error:"An active stakeholder application already exists for this identity",code:"APPLICATION_EXISTS"});const client=await pool.connect();try{await client.query("begin");const organization=await client.query<{id:string}>("insert into organizations(name,organization_type,legal_name,legal_form,registration_identifier,registration_authority,status,verification_status) values($1,$2,$3,$4,$5,$6,'PENDING','UNDER_REVIEW') returning id",[organizationName,option[2],legalName,legalForm,registrationIdentifier,registrationAuthority]);const organizationRow=organization.rows[0];if(!organizationRow)throw new Error("Organization insert returned no row");const role=await client.query<{id:string}>("insert into roles(organization_id,name,permissions,geography_scope) values($1,$2,$3,'[]') returning id",[organizationRow.id,roleKey,JSON.stringify(getPermissionsForRole(roleKey))]);const roleRow=role.rows[0];if(!roleRow)throw new Error("Role insert returned no row");await client.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'PENDING')",[auth.identityId,organizationRow.id,roleRow.id]);if(geographyId)await client.query("insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'PENDING')",[organizationRow.id,geographyId]);if(evidenceType&&documentReference&&contentHash)await client.query("insert into organization_verification_evidence(organization_id,evidence_type,document_reference,content_hash,issuer_name,issued_at,expires_at,status) values($1,$2,$3,$4,$5,$6,$7,'PENDING')",[organizationRow.id,evidenceType,documentReference,contentHash,issuerName,issuedAt?new Date(issuedAt):null,expiresAt?new Date(expiresAt):null]);const application=await client.query("insert into stakeholder_applications(identity_id,organization_id,role_id,requested_role_key,requested_organization_type,geography_id,status,applicant_note) values($1,$2,$3,$4,$5,$6,'PENDING',$7) returning *",[auth.identityId,organizationRow.id,roleRow.id,roleKey,option[2],geographyId,note]);await client.query("commit");return reply.code(201).send({source:"postgresql",syntheticData:false,application:application.rows[0],legalVerification:{status:"UNDER_REVIEW",evidenceSubmitted:Boolean(evidenceType&&documentReference&&contentHash)},message:"Application submitted. Legal identity evidence must be reviewed by an authorized platform reviewer before operational access is granted."});}catch(error){await client.query("rollback");request.log.error(error);return reply.code(503).send({error:"Stakeholder application could not be created",code:"ONBOARDING_UNAVAILABLE"});}finally{client.release();}});
 app.get("/api/v1/onboarding/applications",async(request,reply)=>{const auth=await requireAuth(request,reply,pool);if(!auth||!pool)return;const rows=await pool.query(`select sa.id,sa.organization_id,sa.requested_role_key,sa.requested_organization_type,sa.geography_id,sa.status,sa.applicant_note,sa.created_at,sa.reviewed_at,sa.review_note,o.verification_status,o.verification_note,(select count(*) from organization_verification_evidence ove where ove.organization_id=o.id) evidence_count from stakeholder_applications sa join organizations o on o.id=sa.organization_id where sa.identity_id=$1 order by sa.created_at desc`,[auth.identityId]);return {source:"postgresql",syntheticData:false,applications:rows.rows};});
 app.post("/api/v1/onboarding/applications/:applicationId/withdraw",async(request,reply)=>{const auth=await requireAuth(request,reply,pool);if(!auth||!pool)return;const id=(request.params as {applicationId:string}).applicationId;const client=await pool.connect();try{await client.query("begin");const result=await client.query<{organization_id:string}>(`update stakeholder_applications set status='WITHDRAWN',reviewed_at=now(),review_note=null where id=$1 and identity_id=$2 and status='PENDING' returning organization_id`,[id,auth.identityId]);const row=result.rows[0];if(!row){await client.query("rollback");return reply.code(404).send({error:"Pending stakeholder application not found",code:"APPLICATION_NOT_FOUND"});}await client.query("update organization_memberships set status='REJECTED' where organization_id=$1 and identity_id=$2 and status='PENDING'",[row.organization_id,auth.identityId]);await client.query("update organization_geography_scopes set status='REJECTED' where organization_id=$1 and status='PENDING'",[row.organization_id]);await client.query("update organizations set status='REJECTED',verification_status='REJECTED',verification_note='Application withdrawn by applicant' where id=$1 and status='PENDING'",[row.organization_id]);await client.query("commit");return {source:"postgresql",syntheticData:false,status:"WITHDRAWN",organizationId:row.organization_id};}catch(error){await client.query("rollback");request.log.error(error);return reply.code(503).send({error:"Stakeholder withdrawal could not be finalized",code:"WITHDRAWAL_UNAVAILABLE"});}finally{client.release();}});
}
