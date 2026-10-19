import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, canActForOrganization, canVerifyEvidence, hasOrganizationPermission, type AuthContext } from "./auth.js";

const MAX_BYTES = 5 * 1024 * 1024;
const MEDIA = new Set(["application/pdf", "image/jpeg", "image/png", "text/csv", "text/plain", "application/json"]);
type B = Record<string, unknown>;
type Req = { body: unknown; params: Record<string,string>; query?: unknown; log: { error: (e:unknown)=>void } };
type Rep = { code:(n:number)=>{send:(v:unknown)=>unknown}; header:(k:string,v:string)=>unknown; type:(v:string)=>unknown; send:(v:unknown)=>unknown };
const bodyOf=(r:Req):B=>r.body&&typeof r.body==="object"?r.body as B:{};
const str=(b:B,k:string):string|null=>typeof b[k]==="string"&&b[k].trim()?b[k].trim():null;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sanitizeEvidenceFileName(value:string):string|null {
 const name=value.normalize("NFKC").replace(/[\\/\u0000-\u001f\u007f]/g,"_").replace(/^\.+/,"").trim();
 return !name||name.length>180||name==="."||name===".."?null:name;
}
export function decodeEvidenceBase64(value:string):Buffer|null {
 // Bound the encoded input before scanning it; a regex over multi-megabyte
 // strings can throw RangeError on some Node/V8 builds instead of rejecting it.
 const maxEncodedLength=Math.ceil(MAX_BYTES/3)*4;
 if(!value||value.length>maxEncodedLength||value.length%4!==0)return null;
 for(let i=0;i<value.length;i++){
  const c=value.charCodeAt(i);
  const valid=(c>=65&&c<=90)||(c>=97&&c<=122)||(c>=48&&c<=57)||c===43||c===47||c===61;
  if(!valid)return null;
 }
 const bytes=Buffer.from(value,"base64");
 return !bytes.length||bytes.length>MAX_BYTES||bytes.toString("base64")!==value?null:bytes;
}
export function evidencePayloadMatchesMediaType(bytes:Buffer,mediaType:string):boolean {
 if(mediaType==="application/pdf")return bytes.subarray(0,5).toString("ascii")==="%PDF-";
 if(mediaType==="image/jpeg")return bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 if(mediaType==="image/png")return bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(bytes.includes(0))return false;
 const text=bytes.toString("utf8");
 if(mediaType==="application/json"){try{JSON.parse(text);return true;}catch{return false;}}
 return !text.includes("\ufffd");
}
async function authFor(req:Req,reply:Rep,pool:Pool|null):Promise<AuthContext|null>{
 if(!pool){reply.code(503).send({error:"Database unavailable",code:"DATABASE_UNAVAILABLE"});return null;}
 try{const auth=await authenticate(req as never,pool);if(!auth){reply.code(401).send(bearerChallenge());return null;}return auth;}
 catch(e){req.log.error(e);reply.code(503).send({error:"Authentication service unavailable",code:"AUTH_UNAVAILABLE"});return null;}
}
async function activityContext(pool:Pool,auth:AuthContext,id:string):Promise<{organization_id:string;geography_id:string}|null>{
 if(!UUID.test(id))return null;
 const r=await pool.query<{organization_id:string;geography_id:string|null}>("select organization_id,geography_id from activities where id=$1",[id]);
 const a=r.rows[0];if(!a||!a.geography_id||!canActForOrganization(auth,a.organization_id))return null;
 const scope=await pool.query<{ok:boolean}>("select organization_has_geography_scope($1::uuid,$2::uuid) ok",[a.organization_id,a.geography_id]);
 return scope.rows[0]?.ok?{organization_id:a.organization_id,geography_id:a.geography_id}:null;
}
export async function registerEvidenceVaultRoutes(app:FastifyInstance,pool:Pool|null):Promise<void>{
 app.post("/api/v1/evidence-vault/upload",{bodyLimit:7*1024*1024},async(request,reply)=>{
  const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;
  const b=bodyOf(request as never),activityId=str(b,"activityId"),evidenceType=str(b,"evidenceType"),fileNameRaw=str(b,"fileName"),mediaType=str(b,"mediaType")?.toLowerCase(),encoded=str(b,"contentBase64"),seriesId=str(b,"seriesId"),sourceReference=str(b,"sourceReference"),periodStart=str(b,"measurementPeriodStart"),periodEnd=str(b,"measurementPeriodEnd");
  if(!activityId||!evidenceType||evidenceType.length>100||!fileNameRaw||!mediaType||!encoded)return reply.code(400).send({error:"activityId, evidenceType, fileName, mediaType and contentBase64 are required",code:"EVIDENCE_FIELDS_REQUIRED"});
  const fileName=sanitizeEvidenceFileName(fileNameRaw),bytes=decodeEvidenceBase64(encoded);
  if(!fileName)return reply.code(400).send({error:"Invalid file name",code:"EVIDENCE_FILE_NAME_INVALID"});
  if(!MEDIA.has(mediaType))return reply.code(415).send({error:"Unsupported evidence media type",code:"EVIDENCE_MEDIA_TYPE_UNSUPPORTED"});
  if(!bytes)return reply.code(413).send({error:"File must be valid base64 and between 1 byte and 5 MiB",code:"EVIDENCE_FILE_SIZE_INVALID"});
  if(!evidencePayloadMatchesMediaType(bytes,mediaType))return reply.code(415).send({error:"File signature/content does not match the declared media type",code:"EVIDENCE_MEDIA_MISMATCH"});
  if(seriesId&&!UUID.test(seriesId))return reply.code(400).send({error:"Invalid seriesId",code:"EVIDENCE_SERIES_INVALID"});
  if((periodStart&&!/^\d{4}-\d{2}-\d{2}$/.test(periodStart))||(periodEnd&&!/^\d{4}-\d{2}-\d{2}$/.test(periodEnd))||(periodStart&&periodEnd&&periodEnd<periodStart))return reply.code(400).send({error:"Measurement period must use ISO dates with end on/after start",code:"EVIDENCE_PERIOD_INVALID"});
  const ctx=await activityContext(pool,auth,activityId);if(!ctx)return reply.code(403).send({error:"Activity outside active organization/geography scope",code:"EVIDENCE_SCOPE_FORBIDDEN"});
  if(!await hasOrganizationPermission(pool,auth,ctx.organization_id,["evidence:upload"]))return reply.code(403).send({error:"Evidence upload permission required",code:"EVIDENCE_UPLOAD_FORBIDDEN"});
  const sha=createHash("sha256").update(bytes).digest("hex"),client=await pool.connect();
  try{
   await client.query("begin");
   let series:{id:string;evidence_type:string}|undefined;
   if(seriesId){
    await client.query("select pg_advisory_xact_lock(hashtext($1))",[seriesId]);
    const s=await client.query<{id:string;evidence_type:string}>("select id,evidence_type from evidence_artifact_series where id=$1 and organization_id=$2 and activity_id=$3 for update",[seriesId,ctx.organization_id,activityId]);series=s.rows[0];
    if(!series||series.evidence_type!==evidenceType){await client.query("rollback");return reply.code(409).send({error:"Series must match organization, activity and evidence type",code:"EVIDENCE_SERIES_SCOPE_MISMATCH"});}
   }else{const s=await client.query<{id:string;evidence_type:string}>("insert into evidence_artifact_series(organization_id,activity_id,evidence_type,created_by_identity_id) values($1,$2,$3,$4) returning id,evidence_type",[ctx.organization_id,activityId,evidenceType,auth.identityId]);series=s.rows[0];}
   if(!series)throw new Error("Evidence series creation failed");
   const vr=await client.query<{n:number}>("select coalesce(max(version_number),0)+1 n from evidence_artifact_versions where series_id=$1",[series.id]),version=Number(vr.rows[0]?.n??1);
   const ev=await client.query<{id:string}>("insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,$2,'CAPTURED',now(),'db://evidence-vault/pending',$3,$4::jsonb) returning id",[activityId,evidenceType,sha,JSON.stringify({fileName,mediaType,byteLength:bytes.length,seriesId:series.id,versionNumber:version,sourceReference})]);
   const evidenceId=ev.rows[0]?.id;if(!evidenceId)throw new Error("Evidence row creation failed");
   const ar=await client.query<{id:string}>("insert into evidence_artifact_versions(series_id,evidence_id,version_number,file_name,media_type,size_bytes,sha256,content,uploaded_by_identity_id,source_reference,measurement_period_start,measurement_period_end) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id",[series.id,evidenceId,version,fileName,mediaType,bytes.length,sha,bytes,auth.identityId,sourceReference,periodStart,periodEnd]);
    const artifactVersionId=ar.rows[0]?.id;if(!artifactVersionId)throw new Error("Evidence artifact version creation failed");
    await client.query("update evidence set content_uri=$2 where id=$1",[evidenceId,"db://evidence-vault/"+artifactVersionId]);await client.query("commit");
    return reply.code(201).send({source:"postgresql",syntheticData:false,data:{seriesId:series.id,evidenceId,artifactVersionId,versionNumber:version,fileName,mediaType,sizeBytes:bytes.length,sha256:sha,status:"CAPTURED",reviewStatus:"PENDING",sourceReference,measurementPeriodStart:periodStart,measurementPeriodEnd:periodEnd}});
  }catch(e){await client.query("rollback").catch(()=>undefined);request.log.error(e);return reply.code(503).send({error:"Evidence upload failed",code:"EVIDENCE_VAULT_UNAVAILABLE",syntheticData:false});}finally{client.release();}
 });
 app.get("/api/v1/evidence-vault",async(request,reply)=>{
  const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;
  const query=(request as unknown as {query?:Record<string,unknown>}).query??{},activityId=typeof query.activityId==="string"?query.activityId:"";
  if(!activityId||!UUID.test(activityId))return reply.code(400).send({error:"Valid activityId is required",code:"EVIDENCE_ACTIVITY_REQUIRED"});
  const ctx=await activityContext(pool,auth,activityId);if(!ctx)return reply.code(403).send({error:"Activity outside active organization/geography scope",code:"EVIDENCE_SCOPE_FORBIDDEN"});
  if(!await hasOrganizationPermission(pool,auth,ctx.organization_id,["evidence:read","evidence:upload","evidence:review"]))return reply.code(403).send({error:"Evidence read permission required",code:"EVIDENCE_READ_FORBIDDEN"});
  const rows=await pool.query<{evidence_id:string;series_id:string;artifact_version_id:string;version_number:number;file_name:string;media_type:string;size_bytes:number;sha256:string;status:string;evidence_type:string;source_reference:string|null;measurement_period_start:string|null;measurement_period_end:string|null;uploaded_by_identity_id:string;created_at:Date}>(
   "select e.id evidence_id,v.series_id,v.id artifact_version_id,v.version_number,v.file_name,v.media_type,v.size_bytes,v.sha256,e.status::text status,e.evidence_type,v.source_reference,v.measurement_period_start::text,v.measurement_period_end::text,v.uploaded_by_identity_id,v.created_at from evidence e join activities a on a.id=e.activity_id join evidence_artifact_versions v on v.evidence_id=e.id where a.id=$1 and a.organization_id=$2 order by v.created_at desc limit 200",
   [activityId,ctx.organization_id]);
  return {source:"postgresql",syntheticData:false,data:{artifacts:rows.rows}};
 });
 app.get("/api/v1/evidence-vault/:evidenceId",async(request,reply)=>{
  const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;const id=(request.params as {evidenceId:string}).evidenceId;if(!UUID.test(id))return reply.code(400).send({error:"Invalid evidenceId",code:"EVIDENCE_ID_INVALID"});
  const q=await pool.query<{organization_id:string;geography_id:string|null;artifact_id:string;version_number:number;file_name:string;media_type:string;size_bytes:number;sha256:string;content:Buffer;status:string;source_reference:string|null;measurement_period_start:string|null;measurement_period_end:string|null}>("select a.organization_id,a.geography_id,v.id artifact_id,v.version_number,v.file_name,v.media_type,v.size_bytes,v.sha256,v.content,e.status::text status,v.source_reference,v.measurement_period_start::text,v.measurement_period_end::text from evidence e join activities a on a.id=e.activity_id join evidence_artifact_versions v on v.evidence_id=e.id where e.id=$1",[id]);
  const row=q.rows[0];if(!row||!row.geography_id||!canActForOrganization(auth,row.organization_id))return reply.code(404).send({error:"Evidence not found",code:"EVIDENCE_NOT_FOUND"});
  const g=await pool.query<{ok:boolean}>("select organization_has_geography_scope($1::uuid,$2::uuid) ok",[row.organization_id,row.geography_id]);
  if(!g.rows[0]?.ok||!await hasOrganizationPermission(pool,auth,row.organization_id,["evidence:read","evidence:upload","evidence:review"]))return reply.code(403).send({error:"Evidence read permission required",code:"EVIDENCE_READ_FORBIDDEN"});
  if(row.content.length!==row.size_bytes||createHash("sha256").update(row.content).digest("hex")!==row.sha256)return reply.code(503).send({error:"Stored evidence integrity check failed",code:"EVIDENCE_INTEGRITY_FAILED"});
  reply.header("Content-Disposition",'attachment; filename="'+row.file_name.replace(/["\\\r\n]/g,"_")+'"');reply.header("X-Content-Type-Options","nosniff");reply.header("X-Evidence-SHA256",row.sha256);reply.header("X-Evidence-Version",String(row.version_number));return reply.type(row.media_type).send(row.content);
 });
 app.post("/api/v1/evidence-vault/:evidenceId/review",async(request,reply)=>{
  const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;const id=(request.params as {evidenceId:string}).evidenceId,b=bodyOf(request as never),decision=str(b,"decision"),rationale=str(b,"rationale");
  if(!UUID.test(id))return reply.code(400).send({error:"Invalid evidenceId",code:"EVIDENCE_ID_INVALID"});
  if((decision!=="APPROVED"&&decision!=="REJECTED")||!rationale||rationale.length<5||rationale.length>2000)return reply.code(400).send({error:"Decision and 5–2000 character rationale required",code:"EVIDENCE_REVIEW_FIELDS_INVALID"});
  const client=await pool.connect();try{await client.query("begin");
   const q=await client.query<{organization_id:string;activity_id:string;geography_id:string|null;status:string;artifact_id:string;uploaded_by_identity_id:string}>("select a.organization_id,a.id activity_id,a.geography_id,e.status::text status,v.id artifact_id,v.uploaded_by_identity_id from evidence e join activities a on a.id=e.activity_id join evidence_artifact_versions v on v.evidence_id=e.id where e.id=$1 for update of e",[id]),row=q.rows[0];
   if(!row||!row.geography_id||!canActForOrganization(auth,row.organization_id)){await client.query("rollback");return reply.code(404).send({error:"Evidence not found",code:"EVIDENCE_NOT_FOUND"});}
   const g=await client.query<{ok:boolean}>("select organization_has_geography_scope($1::uuid,$2::uuid) ok",[row.organization_id,row.geography_id]);
   if(!g.rows[0]?.ok||!await hasOrganizationPermission(client,auth,row.organization_id,["evidence:review"])||!await canVerifyEvidence(client,auth.identityId,id)){await client.query("rollback");return reply.code(403).send({error:"Evidence review permission and geography scope required",code:"EVIDENCE_REVIEW_FORBIDDEN"});}
   if(row.status==="VERIFIED"||row.status==="REJECTED"){await client.query("rollback");return reply.code(409).send({error:"Reviewed evidence is immutable; upload a new version",code:"EVIDENCE_ALREADY_REVIEWED"});}
   if(row.uploaded_by_identity_id===auth.identityId){await client.query("rollback");return reply.code(403).send({error:"Evidence uploader cannot review their own artifact",code:"EVIDENCE_SELF_REVIEW_FORBIDDEN"});}
   const status=decision==="APPROVED"?"VERIFIED":"REJECTED";
   await client.query("insert into evidence_artifact_reviews(evidence_id,artifact_version_id,reviewer_identity_id,decision,rationale) values($1,$2,$3,$4,$5)",[id,row.artifact_id,auth.identityId,decision,rationale]);
   await client.query("insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,$4,'EVIDENCE_VAULT',$5)",[id,row.activity_id,auth.identityId,decision,rationale]);
   await client.query("update evidence set status=$2 where id=$1",[id,status]);await client.query("commit");
   return {source:"postgresql",syntheticData:false,data:{evidenceId:id,artifactVersionId:row.artifact_id,status,reviewDecision:decision,reviewerIdentityId:auth.identityId}};
  }catch(e){await client.query("rollback").catch(()=>undefined);request.log.error(e);return reply.code(503).send({error:"Evidence review failed",code:"EVIDENCE_REVIEW_UNAVAILABLE"});}finally{client.release();}
 });
}
