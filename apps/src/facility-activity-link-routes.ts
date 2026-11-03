import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, hasOrganizationPermission, type AuthContext } from "./auth.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Reply={code:(status:number)=>{send:(body:unknown)=>unknown}};
type Request={body:unknown;params:Record<string,string>;query:unknown;log:{error:(error:unknown)=>void}};
function bodyOf(r:Request):Record<string,unknown>{return r.body&&typeof r.body==="object"&&!Array.isArray(r.body)?r.body as Record<string,unknown>:{};}
function str(b:Record<string,unknown>,key:string,max=2000):string|null{const v=b[key];return typeof v==="string"&&v.trim().length>0&&v.trim().length<=max?v.trim():null;}
async function authFor(request:Request,reply:Reply,pool:Pool|null):Promise<AuthContext|null>{if(!pool){reply.code(503).send({error:"Database unavailable",code:"DATABASE_UNAVAILABLE"});return null;}try{const auth=await authenticate(request as never,pool);if(!auth){reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});return null;}return auth;}catch(error){request.log.error(error);reply.code(503).send({error:"Authentication service unavailable",code:"AUTH_UNAVAILABLE"});return null;}}
async function canManage(pool:Pool|PoolClient,auth:AuthContext,org:string):Promise<boolean>{return hasOrganizationPermission(pool,auth,org,["facility:manage"]);}

export async function registerFacilityActivityLinkRoutes(app:FastifyInstance,pool:Pool|null):Promise<void>{
 app.get("/api/v1/facilities/:facilityId/activity-links",async(request,reply)=>{
  const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;
  const id=(request.params as {facilityId:string}).facilityId;if(!UUID.test(id))return reply.code(400).send({error:"Invalid facility ID",code:"FACILITY_ID_INVALID"});
  try{
   const f=await pool.query<{organization_id:string}>("select organization_id from facilities where id=$1 and organization_has_geography_scope(organization_id,geography_id)",[id]);
   if(!f.rows[0]||f.rows[0].organization_id!==auth.activeOrganizationId)return reply.code(404).send({error:"Facility not found",code:"FACILITY_NOT_FOUND"});
   if(!await canManage(pool,auth,f.rows[0].organization_id))return reply.code(403).send({error:"facility:manage permission required",code:"FACILITY_PERMISSION_REQUIRED"});
   const q=await pool.query("select l.*,a.activity_type,a.geography_id activity_geography_id from facility_activity_links l join activities a on a.id=l.activity_id where l.facility_id=$1 and l.organization_id=$2 and organization_has_geography_scope(l.organization_id,a.geography_id) order by l.created_at desc",[id,f.rows[0].organization_id]);
   return {source:"postgresql",syntheticData:false,links:q.rows};
  }catch(error){request.log.error(error);return reply.code(503).send({error:"Facility activity links unavailable",code:"FACILITY_ACTIVITY_LINKS_UNAVAILABLE"});}
 });
 app.post("/api/v1/facilities/:facilityId/activity-links",async(request,reply)=>{
  const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;
  const id=(request.params as {facilityId:string}).facilityId,b=bodyOf(request as never),activityId=str(b,"activityId",80),note=str(b,"note");
  if(!UUID.test(id)||!activityId||!UUID.test(activityId)||!note||note.length<5)return reply.code(400).send({error:"Valid facilityId, activityId and 5–2000 character note required",code:"FACILITY_ACTIVITY_LINK_INVALID"});
  try{
   const c=await pool.connect();
   try{
    await c.query("begin");
    const f=await c.query<{organization_id:string;geography_id:string;operational_status:string}>("select organization_id,geography_id,operational_status from facilities where id=$1 and organization_has_geography_scope(organization_id,geography_id) for update",[id]);
    const facility=f.rows[0];
    if(!facility||facility.organization_id!==auth.activeOrganizationId){await c.query("rollback");return reply.code(404).send({error:"Facility not found",code:"FACILITY_NOT_FOUND"});}
    if(!await canManage(c,auth,facility.organization_id)){await c.query("rollback");return reply.code(403).send({error:"facility:manage permission required",code:"FACILITY_PERMISSION_REQUIRED"});}
    if(facility.operational_status!=="ACTIVE"){await c.query("rollback");return reply.code(409).send({error:"Facility profile must be independently activated before linking activities",code:"FACILITY_NOT_ACTIVE"});}
    const a=await c.query<{organization_id:string;geography_id:string}>("select organization_id,geography_id from activities where id=$1 and geography_id is not null and organization_has_geography_scope(organization_id,geography_id) for update",[activityId]);
    if(!a.rows[0]||a.rows[0].organization_id!==facility.organization_id){await c.query("rollback");return reply.code(404).send({error:"Activity not found in this organization and geography scope",code:"ACTIVITY_NOT_FOUND"});}
    if(a.rows[0].geography_id!==facility.geography_id){await c.query("rollback");return reply.code(409).send({error:"Activity and facility geography must match exactly; cross-geography association requires a separately governed design",code:"FACILITY_ACTIVITY_GEOGRAPHY_MISMATCH"});}
    const ins=await c.query<{id:string;status:string}>("insert into facility_activity_links(organization_id,facility_id,activity_id,note,created_by_identity_id) values($1,$2,$3,$4,$5) returning id,status",[facility.organization_id,id,activityId,note,auth.identityId]);
    const link=ins.rows[0]!;
    await c.query("insert into facility_activity_link_events(link_id,actor_identity_id,event_type,new_status,note) values($1,$2,'LINK_REQUESTED','PENDING',$3)",[link.id,auth.identityId,note]);
    await c.query("commit");
    return reply.code(201).send({source:"postgresql",syntheticData:false,link});
   }catch(error){await c.query("rollback").catch(()=>undefined);const message=error instanceof Error?error.message:"";if(message.includes("facility_activity_one_open_link_per_activity"))return reply.code(409).send({error:"Activity already has a pending or verified facility link",code:"ACTIVITY_FACILITY_LINK_CONFLICT"});if(message.includes("facility activity link"))return reply.code(403).send({error:"Facility/activity organization or geography constraint failed",code:"FACILITY_ACTIVITY_SCOPE_FORBIDDEN"});request.log.error(error);return reply.code(503).send({error:"Facility activity link request failed",code:"FACILITY_ACTIVITY_LINK_CREATE_UNAVAILABLE"});}finally{c.release();}
  }catch(error){request.log.error(error);return reply.code(503).send({error:"Facility activity link request failed",code:"FACILITY_ACTIVITY_LINK_CREATE_UNAVAILABLE"});}
 });
 app.post("/api/v1/facility-activity-links/:linkId/review",async(request,reply)=>{
  const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;
  const id=(request.params as {linkId:string}).linkId,b=bodyOf(request as never),status=str(b,"decision",20),note=str(b,"note");
  if(!UUID.test(id)||!(status==="VERIFIED"||status==="REJECTED")||!note||note.length<5)return reply.code(400).send({error:"Valid link ID, VERIFIED/REJECTED decision and 5–2000 character review note required",code:"FACILITY_ACTIVITY_REVIEW_INVALID"});
  const c=await pool.connect();
  try{
   await c.query("begin");
   const q=await c.query<{organization_id:string;created_by_identity_id:string;status:string}>("select organization_id,created_by_identity_id,status from facility_activity_links where id=$1 and organization_has_geography_scope(organization_id,(select geography_id from facilities where id=facility_id)) for update",[id]);
   const link=q.rows[0];
   if(!link||link.organization_id!==auth.activeOrganizationId){await c.query("rollback");return reply.code(404).send({error:"Facility activity link not found",code:"FACILITY_ACTIVITY_LINK_NOT_FOUND"});}
   if(!await canManage(c,auth,link.organization_id)){await c.query("rollback");return reply.code(403).send({error:"facility:manage permission required",code:"FACILITY_PERMISSION_REQUIRED"});}
   if(link.status!=="PENDING"){await c.query("rollback");return reply.code(409).send({error:"Only pending links can be reviewed",code:"FACILITY_ACTIVITY_LINK_NOT_PENDING"});}
   if(link.created_by_identity_id===auth.identityId){await c.query("rollback");return reply.code(403).send({error:"Link requester cannot review their own request",code:"FACILITY_ACTIVITY_SELF_REVIEW_FORBIDDEN"});}
   const updated=await c.query("update facility_activity_links set status=$2,reviewed_by_identity_id=$3,review_note=$4,reviewed_at=now() where id=$1 returning *",[id,status,auth.identityId,note]);
   await c.query("insert into facility_activity_link_events(link_id,actor_identity_id,event_type,previous_status,new_status,note) values($1,$2,'LINK_REVIEWED','PENDING',$3,$4)",[id,auth.identityId,status,note]);
   await c.query("commit");
   return {source:"postgresql",syntheticData:false,link:updated.rows[0]};
  }catch(error){await c.query("rollback").catch(()=>undefined);request.log.error(error);return reply.code(503).send({error:"Facility activity link review failed",code:"FACILITY_ACTIVITY_REVIEW_UNAVAILABLE"});}finally{c.release();}
 });
}
