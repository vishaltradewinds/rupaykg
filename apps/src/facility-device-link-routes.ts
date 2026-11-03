import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, hasOrganizationPermission, type AuthContext } from "./auth.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Reply={code:(status:number)=>{send:(body:unknown)=>unknown}};
type Request={body:unknown;params:Record<string,string>;log:{error:(error:unknown)=>void}};
function bodyOf(r:Request):Record<string,unknown>{return r.body&&typeof r.body==="object"&&!Array.isArray(r.body)?r.body as Record<string,unknown>:{};}
function str(b:Record<string,unknown>,key:string,max=2000):string|null{const v=b[key];return typeof v==="string"&&v.trim().length>0&&v.trim().length<=max?v.trim():null;}
async function authFor(request:Request,reply:Reply,pool:Pool|null):Promise<AuthContext|null>{if(!pool){reply.code(503).send({error:"Database unavailable",code:"DATABASE_UNAVAILABLE"});return null;}try{const auth=await authenticate(request as never,pool);if(!auth){reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});return null;}return auth;}catch(error){request.log.error(error);reply.code(503).send({error:"Authentication service unavailable",code:"AUTH_UNAVAILABLE"});return null;}}
async function canManage(pool:Pool|PoolClient,auth:AuthContext,org:string):Promise<boolean>{return hasOrganizationPermission(pool,auth,org,["facility:manage"]);}

export async function registerFacilityDeviceLinkRoutes(app:FastifyInstance,pool:Pool|null):Promise<void>{
 app.get("/api/v1/facilities/:facilityId/device-links",async(request,reply)=>{
  const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;
  const id=(request.params as {facilityId:string}).facilityId;if(!UUID.test(id))return reply.code(400).send({error:"Invalid facility ID",code:"FACILITY_ID_INVALID"});
  try{
   const f=await pool.query<{organization_id:string}>("select organization_id from facilities where id=$1 and organization_has_geography_scope(organization_id,geography_id)",[id]);
   if(!f.rows[0]||f.rows[0].organization_id!==auth.activeOrganizationId)return reply.code(404).send({error:"Facility not found",code:"FACILITY_NOT_FOUND"});
   if(!await canManage(pool,auth,f.rows[0].organization_id))return reply.code(403).send({error:"facility:manage permission required",code:"FACILITY_PERMISSION_REQUIRED"});
   const q=await pool.query("select l.*,fd.device_id as enrolled_device_code,fd.identity_id as device_identity_id,fd.status as device_status from facility_device_links l join field_devices fd on fd.id=l.device_id where l.facility_id=$1 and l.organization_id=$2 and organization_has_geography_scope(l.organization_id,(select geography_id from facilities where id=l.facility_id)) order by l.created_at desc",[id,f.rows[0].organization_id]);
   return {source:"postgresql",syntheticData:false,links:q.rows};
  }catch(error){request.log.error(error);return reply.code(503).send({error:"Facility device links unavailable",code:"FACILITY_DEVICE_LINKS_UNAVAILABLE"});}
 });
 app.post("/api/v1/facilities/:facilityId/device-links",async(request,reply)=>{
  const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;
  const id=(request.params as {facilityId:string}).facilityId,b=bodyOf(request as never),deviceId=str(b,"deviceId",80),note=str(b,"note");
  if(!UUID.test(id)||!deviceId||!UUID.test(deviceId)||!note||note.length<5)return reply.code(400).send({error:"Valid facilityId, deviceId and 5–2000 character note required",code:"FACILITY_DEVICE_LINK_INVALID"});
  const c=await pool.connect();
  try{
   await c.query("begin");
   const fq=await c.query<{organization_id:string;operational_status:string}>("select organization_id,operational_status from facilities where id=$1 and organization_has_geography_scope(organization_id,geography_id) for update",[id]);
   const f=fq.rows[0];if(!f||f.organization_id!==auth.activeOrganizationId){await c.query("rollback");return reply.code(404).send({error:"Facility not found",code:"FACILITY_NOT_FOUND"});}
   if(!await canManage(c,auth,f.organization_id)){await c.query("rollback");return reply.code(403).send({error:"facility:manage permission required",code:"FACILITY_PERMISSION_REQUIRED"});}
   if(f.operational_status!=="ACTIVE"){await c.query("rollback");return reply.code(409).send({error:"Facility profile must be independently activated before device association",code:"FACILITY_NOT_ACTIVE"});}
   const dq=await c.query<{organization_id:string;status:string;identity_id:string|null}>("select organization_id,status,identity_id from field_devices where id=$1 for update",[deviceId]);
   const d=dq.rows[0];if(!d||d.organization_id!==f.organization_id){await c.query("rollback");return reply.code(404).send({error:"Enrolled device not found in this organization",code:"FIELD_DEVICE_NOT_FOUND"});}
   if(d.status!=="VERIFIED"||!d.identity_id){await c.query("rollback");return reply.code(409).send({error:"Device must be independently enrolled and verified first",code:"FIELD_DEVICE_NOT_VERIFIED"});}
   const ins=await c.query<{id:string;status:string}>("insert into facility_device_links(organization_id,facility_id,device_id,note,created_by_identity_id) values($1,$2,$3,$4,$5) returning id,status",[f.organization_id,id,deviceId,note,auth.identityId]);
   const link=ins.rows[0]!;
   await c.query("commit");return reply.code(201).send({source:"postgresql",syntheticData:false,link});
  }catch(error){await c.query("rollback").catch(()=>undefined);const message=error instanceof Error?error.message:"";if(message.includes("facility_device_one_open_link_per_pair"))return reply.code(409).send({error:"This device already has a pending or verified association with the facility",code:"FACILITY_DEVICE_LINK_CONFLICT"});if(message.includes("facility device link"))return reply.code(403).send({error:"Device/facility organization or geography constraint failed",code:"FACILITY_DEVICE_SCOPE_FORBIDDEN"});request.log.error(error);return reply.code(503).send({error:"Facility device association failed",code:"FACILITY_DEVICE_LINK_CREATE_UNAVAILABLE"});}finally{c.release();}
 });
 app.post("/api/v1/facility-device-links/:linkId/review",async(request,reply)=>{
  const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;
  const id=(request.params as {linkId:string}).linkId,b=bodyOf(request as never),decision=str(b,"decision",20),note=str(b,"note");
  if(!UUID.test(id)||!(decision==="VERIFIED"||decision==="REJECTED")||!note||note.length<5)return reply.code(400).send({error:"Valid link ID, VERIFIED/REJECTED decision and 5–2000 character review note required",code:"FACILITY_DEVICE_REVIEW_INVALID"});
  const c=await pool.connect();
  try{
   await c.query("begin");
   const q=await c.query<{organization_id:string;created_by_identity_id:string;status:string}>("select organization_id,created_by_identity_id,status from facility_device_links where id=$1 and organization_has_geography_scope(organization_id,(select geography_id from facilities where id=facility_id)) for update",[id]);
   const link=q.rows[0];if(!link||link.organization_id!==auth.activeOrganizationId){await c.query("rollback");return reply.code(404).send({error:"Facility device link not found",code:"FACILITY_DEVICE_LINK_NOT_FOUND"});}
   if(!await canManage(c,auth,link.organization_id)){await c.query("rollback");return reply.code(403).send({error:"facility:manage permission required",code:"FACILITY_PERMISSION_REQUIRED"});}
   if(link.status!=="PENDING"){await c.query("rollback");return reply.code(409).send({error:"Only pending device associations can be reviewed",code:"FACILITY_DEVICE_LINK_NOT_PENDING"});}
   if(link.created_by_identity_id===auth.identityId){await c.query("rollback");return reply.code(403).send({error:"Association requester cannot review their own request",code:"FACILITY_DEVICE_SELF_REVIEW_FORBIDDEN"});}
   const updated=await c.query("update facility_device_links set status=$2,reviewed_by_identity_id=$3,review_note=$4,reviewed_at=now() where id=$1 returning *",[id,decision,auth.identityId,note]);
   await c.query("commit");return {source:"postgresql",syntheticData:false,link:updated.rows[0]};
  }catch(error){await c.query("rollback").catch(()=>undefined);request.log.error(error);return reply.code(503).send({error:"Facility device association review failed",code:"FACILITY_DEVICE_REVIEW_UNAVAILABLE"});}finally{c.release();}
 });
}
