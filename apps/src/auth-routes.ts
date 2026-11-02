import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, issueOpaqueToken, type AuthContext } from "./auth.js";

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
 app.post("/api/v1/onboarding/applications",async(request,reply)=>{
  const auth=await requireAuth(request,reply,pool);if(!auth)return;
  if(!authPool)return reply.code(503).send({error:"Authentication database unavailable",code:"AUTH_DATABASE_UNAVAILABLE"});
  const body=bodyOf(request),organizationName=text(body,"organizationName"),roleKeyText=text(body,"roleKey"),note=text(body,"applicantNote"),geographyId=text(body,"geographyId");
  const legalName=text(body,"legalName")??organizationName,legalForm=text(body,"legalForm"),registrationIdentifier=text(body,"registrationIdentifier"),registrationAuthority=text(body,"registrationAuthority"),evidenceType=text(body,"evidenceType"),documentReference=text(body,"documentReference"),contentHash=text(body,"contentHash"),issuerName=text(body,"issuerName"),issuedAt=text(body,"issuedAt"),expiresAt=text(body,"expiresAt");
  if(!organizationName||!roleKeyText||!roleKeys.has(roleKeyText as StakeholderRoleKey))return reply.code(400).send({error:"organizationName and a supported stakeholder role are required",code:"INVALID_ONBOARDING"});
  const roleKey=roleKeyText as StakeholderRoleKey,option=STAKEHOLDER_OPTIONS.find(([key])=>key===roleKey);
  if(!option)return reply.code(400).send({error:"Unsupported stakeholder role",code:"INVALID_ONBOARDING"});
  if(organizationRequiresLegalVerification(option[2])&&(!legalName||!legalForm||!registrationIdentifier||!registrationAuthority))return reply.code(400).send({error:"Legal name, legal form, registration identifier and registration authority are required for organization-backed stakeholder onboarding",code:"LEGAL_IDENTITY_REQUIRED"});
  if(organizationRequiresLegalVerification(option[2])&&(!evidenceType||!documentReference||!contentHash))return reply.code(400).send({error:"At least one legal verification evidence reference and content hash are required for organization-backed stakeholder onboarding",code:"LEGAL_EVIDENCE_REQUIRED"});
  const header=request.headers.authorization,token=typeof header==="string"&&header.startsWith("Bearer ")?header.slice(7).trim():"";
  if(!token)return reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});
  try{
   const result=await authPool.query<{application_result:any}>(`select auth_private.create_stakeholder_application($1,$2,$3,$4,$5,$6,$7,$8::uuid,$9,$10,$11,$12,$13,$14::timestamptz,$15::timestamptz) as application_result`,[
    hash(token),organizationName,roleKey,legalName,legalForm,registrationIdentifier,registrationAuthority,geographyId,note,evidenceType,documentReference,contentHash,issuerName,issuedAt?new Date(issuedAt).toISOString():null,expiresAt?new Date(expiresAt).toISOString():null,
   ]);
   const value=result.rows[0]?.application_result;
   if(!value?.application||!value?.organization_id)throw new Error("ONBOARDING_FUNCTION_RETURNED_INVALID_RESULT");
   return reply.code(201).send({source:"postgresql",syntheticData:false,application:value.application,legalVerification:{status:"UNDER_REVIEW",evidenceSubmitted:Boolean(evidenceType&&documentReference&&contentHash)},message:"Application submitted. Legal identity evidence must be reviewed by an authorized platform reviewer before operational access is granted."});
  }catch(error){
   const code=(error as {message?:string})?.message??"";
   if(code.includes("APPLICATION_EXISTS"))return reply.code(409).send({error:"A pending stakeholder application already exists for this identity",code:"APPLICATION_EXISTS"});
   if(code.includes("AUTH_REQUIRED"))return reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});
   if(code.includes("GEOGRAPHY_NOT_FOUND"))return reply.code(400).send({error:"Selected geography does not exist",code:"GEOGRAPHY_NOT_FOUND"});
   if(code.includes("UNSUPPORTED_STAKEHOLDER_ROLE")||code.includes("INVALID_ONBOARDING_INPUT"))return reply.code(400).send({error:"Invalid stakeholder application",code:"INVALID_ONBOARDING"});
   if(code.includes("LEGAL_IDENTITY_AND_EVIDENCE_REQUIRED"))return reply.code(400).send({error:"Legal identity and evidence are required",code:"LEGAL_EVIDENCE_REQUIRED"});
   request.log.error(error);return reply.code(503).send({error:"Stakeholder application could not be created",code:"ONBOARDING_UNAVAILABLE"});
  }
 });
 app.get("/api/v1/onboarding/applications",async(request,reply)=>{
  const auth=await requireAuth(request,reply,pool);if(!auth)return;
  if(!authPool)return reply.code(503).send({error:"Authentication database unavailable",code:"AUTH_DATABASE_UNAVAILABLE"});
  const header=request.headers.authorization;
  const token=typeof header==="string"&&header.startsWith("Bearer ")?header.slice(7).trim():"";
  if(!token)return reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});
  try{
   const context=await readSelfContext(authPool,hash(token),auth.identityId);
   if(!context)return reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});
   return {source:"postgresql",syntheticData:false,applications:context.applications};
  }catch(error){request.log.error(error);return reply.code(503).send({error:"Stakeholder applications unavailable",code:"ONBOARDING_UNAVAILABLE"});}
 });
 app.post("/api/v1/onboarding/applications/:applicationId/withdraw",async(request,reply)=>{
  const auth=await requireAuth(request,reply,pool);if(!auth)return;
  if(!authPool)return reply.code(503).send({error:"Authentication database unavailable",code:"AUTH_DATABASE_UNAVAILABLE"});
  const id=(request.params as {applicationId:string}).applicationId;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return reply.code(400).send({error:"Invalid application id",code:"INVALID_APPLICATION_ID"});
  const header=request.headers.authorization,token=typeof header==="string"&&header.startsWith("Bearer ")?header.slice(7).trim():"";
  if(!token)return reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});
  try{
   const result=await authPool.query<{withdrawal_result:{status:string;organization_id?:string}}>(
    "select auth_private.withdraw_stakeholder_application($1,$2::uuid) as withdrawal_result",[hash(token),id],
   );
   const value=result.rows[0]?.withdrawal_result;
   if(value?.status==="NOT_FOUND")return reply.code(404).send({error:"Pending stakeholder application not found",code:"APPLICATION_NOT_FOUND"});
   if(value?.status!=="WITHDRAWN"||!value.organization_id)throw new Error("WITHDRAWAL_FUNCTION_RETURNED_INVALID_RESULT");
   return {source:"postgresql",syntheticData:false,status:"WITHDRAWN",organizationId:value.organization_id};
  }catch(error){
   if((error as {message?:string})?.message?.includes("AUTH_REQUIRED"))return reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});
   request.log.error(error);return reply.code(503).send({error:"Stakeholder withdrawal could not be finalized",code:"WITHDRAWAL_UNAVAILABLE"});
  }
 });
}
