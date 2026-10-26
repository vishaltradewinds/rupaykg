import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, hasOrganizationPermission, type AuthContext } from "./auth.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FACILITY_TYPES = ["BULK_WASTE_GENERATOR","COLLECTION_CENTRE","AGGREGATION_CENTRE","TRANSFER_STATION","MATERIAL_RECOVERY_FACILITY","RECYCLING_PROCESSING","TREATMENT_FACILITY","DISPOSAL_FACILITY","COMPOSTING_BIOGAS","WASTE_TO_ENERGY","WAREHOUSE","OTHER"] as const;
const FACILITY_STATUSES = ["ACTIVE","INACTIVE","SUSPENDED","CLOSED"] as const;
const MEMBERSHIP_ROLES = ["MANAGER","OPERATOR","VIEWER","FACILITY_REVIEWER"] as const;
type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string,string>; query: unknown; headers: Record<string,unknown>; log: { error: (error: unknown) => void } };
type FacilityRow = { id:string; organization_id:string; facility_code:string; name:string; facility_type:string; operational_status:string; geography_id:string; address:unknown; process_profile:unknown; metadata:unknown; version:number; created_by_identity_id:string; updated_by_identity_id:string; created_at:string; updated_at:string };
function bodyOf(r:Request):Record<string,unknown>{return r.body&&typeof r.body==="object"&&!Array.isArray(r.body)?r.body as Record<string,unknown>:{};}
function stringValue(b:Record<string,unknown>,k:string,max=300):string|null{const v=b[k];return typeof v==="string"&&v.trim()&&v.trim().length<=max?v.trim():null;}
function objectValue(b:Record<string,unknown>,k:string):Record<string,unknown>|null{const v=b[k];return v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null;}
function versionValue(v:unknown):number|null{return Number.isSafeInteger(v)&&Number(v)>0?Number(v):null;}
async function authFor(request:Request,reply:Reply,pool:Pool|null):Promise<AuthContext|null>{if(!pool){reply.code(503).send({error:"Database unavailable",code:"DATABASE_UNAVAILABLE"});return null;}try{const auth=await authenticate(request as never,pool);if(!auth){reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});return null;}return auth;}catch(error){request.log.error(error);reply.code(503).send({error:"Authentication service unavailable",code:"AUTH_UNAVAILABLE"});return null;}}
async function canManage(pool:Pool,auth:AuthContext,organizationId:string):Promise<boolean>{return hasOrganizationPermission(pool,auth,organizationId,["facility:manage"]);}
async function isFacilityMember(pool:Pool,auth:AuthContext,facilityId:string):Promise<boolean>{const q=await pool.query("select exists(select 1 from facility_memberships fm join facilities f on f.id=fm.facility_id join organization_memberships om on om.organization_id=f.organization_id and om.identity_id=fm.identity_id and om.status='VERIFIED' where fm.facility_id=$1 and fm.identity_id=$2 and fm.status='VERIFIED' and om.organization_id=$3) ok",[facilityId,auth.identityId,auth.activeOrganizationId]);return q.rows[0]?.ok===true;}
async function facilityFor(pool:Pool,facilityId:string):Promise<FacilityRow|null>{const q=await pool.query<FacilityRow>("select * from facilities where id=$1",[facilityId]);return q.rows[0]??null;}
function facilityResponse(f:FacilityRow){return {source:"postgresql",syntheticData:false,facility:f};}
function validUuid(v:string|null):v is string{return !!v&&UUID.test(v);}
async function addEvent(client:PoolClient,facilityId:string,actorId:string,eventType:string,previousVersion:number|null,newVersion:number|null,previousStatus:string|null,newStatus:string|null,note:string,payload:Record<string,unknown>={}){await client.query("insert into facility_review_events(facility_id,actor_identity_id,event_type,previous_version,new_version,previous_status,new_status,note,payload) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",[facilityId,actorId,eventType,previousVersion,newVersion,previousStatus,newStatus,note,payload]);}

export async function registerFacilityRoutes(app:FastifyInstance,pool:Pool|null):Promise<void>{
  app.get("/api/v1/facilities",async(request,reply)=>{
    const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;
    const orgId=auth.activeOrganizationId;
    if(!orgId)return reply.code(403).send({error:"Select an active organization",code:"ORG_CONTEXT_REQUIRED"});
    try{
      const manage=await canManage(pool,auth,orgId);
      const q=await pool.query<FacilityRow>(`select f.* from facilities f where f.organization_id=$1 and ($2::boolean or exists(select 1 from facility_memberships fm where fm.facility_id=f.id and fm.identity_id=$3 and fm.status='VERIFIED')) order by f.name,f.facility_code`,[orgId,manage,auth.identityId]);
      return {source:"postgresql",syntheticData:false,facilities:q.rows};
    }catch(error){request.log.error(error);return reply.code(503).send({error:"Facility listing unavailable",code:"FACILITY_LIST_UNAVAILABLE"});}
  });

  app.post("/api/v1/facilities",async(request,reply)=>{
    const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;
    const b=bodyOf(request as never),orgId=stringValue(b,"organizationId",80),code=stringValue(b,"facilityCode",100),name=stringValue(b,"name"),type=stringValue(b,"facilityType",80),geo=stringValue(b,"geographyId",80),note=stringValue(b,"note",2000);
    if(!validUuid(orgId)||!code||!/^[A-Za-z0-9][A-Za-z0-9._/-]{1,99}$/.test(code)||!name||!type||!(FACILITY_TYPES as readonly string[]).includes(type)||!validUuid(geo)||!note)return reply.code(400).send({error:"organizationId, facilityCode, name, supported facilityType, geographyId and note are required",code:"FACILITY_INPUT_INVALID"});
    if(auth.activeOrganizationId!==orgId)return reply.code(403).send({error:"Facility must be created in the active organization",code:"ORG_FORBIDDEN"});
    if(!await canManage(pool,auth,orgId))return reply.code(403).send({error:"facility:manage permission required",code:"FACILITY_PERMISSION_REQUIRED"});
    const address=objectValue(b,"address")??{},profile=objectValue(b,"processProfile")??{},metadata=objectValue(b,"metadata")??{};
    const c=await pool.connect();
    try{
      await c.query("begin");
      const ins=await c.query<FacilityRow>(`insert into facilities(organization_id,facility_code,name,facility_type,geography_id,address,process_profile,metadata,created_by_identity_id,updated_by_identity_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) returning *`,[orgId,code,name,type,geo,address,profile,metadata,auth.identityId]);
      const f=ins.rows[0]!;
      await addEvent(c,f.id,auth.identityId,"PROFILE_CREATED",null,f.version,null,f.operational_status,note,{facilityCode:f.facility_code,facilityType:f.facility_type,geographyId:f.geography_id});
      await c.query("commit");
      return reply.code(201).send(facilityResponse(f));
    }catch(error){await c.query("rollback");const message=error instanceof Error?error.message:"";if(message.includes("facilities_organization_id_facility_code_key"))return reply.code(409).send({error:"Facility code already exists in this organization",code:"FACILITY_CODE_CONFLICT"});if(message.includes("facility geography is outside organization authorization scope"))return reply.code(403).send({error:"Facility geography is outside organization scope",code:"GEOGRAPHY_FORBIDDEN"});request.log.error(error);return reply.code(503).send({error:"Facility creation unavailable",code:"FACILITY_CREATE_UNAVAILABLE"});}finally{c.release();}
  });

  app.get("/api/v1/facilities/:facilityId",async(request,reply)=>{
    const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;
    const id=(request.params as {facilityId:string}).facilityId;if(!UUID.test(id))return reply.code(400).send({error:"Invalid facility ID",code:"FACILITY_ID_INVALID"});
    try{const f=await facilityFor(pool,id);if(!f||f.organization_id!==auth.activeOrganizationId)return reply.code(404).send({error:"Facility not found",code:"FACILITY_NOT_FOUND"});if(!await canManage(pool,auth,f.organization_id)&&!await isFacilityMember(pool,auth,id))return reply.code(403).send({error:"Facility membership required",code:"FACILITY_FORBIDDEN"});return facilityResponse(f);}catch(error){request.log.error(error);return reply.code(503).send({error:"Facility lookup unavailable",code:"FACILITY_LOOKUP_UNAVAILABLE"});}
  });

  app.patch("/api/v1/facilities/:facilityId",async(request,reply)=>{
    const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;
    const id=(request.params as {facilityId:string}).facilityId;if(!UUID.test(id))return reply.code(400).send({error:"Invalid facility ID",code:"FACILITY_ID_INVALID"});
    const b=bodyOf(request as never),expected=versionValue(b.expectedVersion),note=stringValue(b,"note",2000);
    if(!expected||!note)return reply.code(400).send({error:"expectedVersion and note are required",code:"FACILITY_UPDATE_INVALID"});
    const f=await facilityFor(pool,id);if(!f||f.organization_id!==auth.activeOrganizationId)return reply.code(404).send({error:"Facility not found",code:"FACILITY_NOT_FOUND"});
    if(!await canManage(pool,auth,f.organization_id))return reply.code(403).send({error:"facility:manage permission required",code:"FACILITY_PERMISSION_REQUIRED"});
    const name=b.name===undefined?f.name:stringValue(b,"name");
    const type=b.facilityType===undefined?f.facility_type:stringValue(b,"facilityType",80);
    const geo=b.geographyId===undefined?f.geography_id:stringValue(b,"geographyId",80);
    if(!name||!type||!(FACILITY_TYPES as readonly string[]).includes(type)||!validUuid(geo))return reply.code(400).send({error:"Invalid facility profile fields",code:"FACILITY_UPDATE_INVALID"});
    const address=b.address===undefined?f.address:objectValue(b,"address"),profile=b.processProfile===undefined?f.process_profile:objectValue(b,"processProfile"),metadata=b.metadata===undefined?f.metadata:objectValue(b,"metadata");
    if(address===null||profile===null||metadata===null)return reply.code(400).send({error:"address, processProfile and metadata must be JSON objects",code:"FACILITY_UPDATE_INVALID"});
    const c=await pool.connect();
    try{await c.query("begin");const current=await c.query<FacilityRow>("select * from facilities where id=$1 for update",[id]);const old=current.rows[0];if(!old||old.version!==expected){await c.query("rollback");return reply.code(409).send({error:"Facility profile version changed; reload before editing",code:"FACILITY_VERSION_CONFLICT"});}
      const updated=await c.query<FacilityRow>("update facilities set name=$2,facility_type=$3,geography_id=$4,address=$5,process_profile=$6,metadata=$7,updated_by_identity_id=$8 where id=$1 returning *",[id,name,type,geo,address,profile,metadata,auth.identityId]);
      await addEvent(c,id,auth.identityId,"PROFILE_UPDATED",old.version,updated.rows[0]!.version,old.operational_status,updated.rows[0]!.operational_status,note,{changedFields:["name","facilityType","geographyId","address","processProfile","metadata"].filter(k=>b[k]!==undefined)});
      await c.query("commit");return facilityResponse(updated.rows[0]!);
    }catch(error){await c.query("rollback");const message=error instanceof Error?error.message:"";if(message.includes("facility geography is outside organization authorization scope"))return reply.code(403).send({error:"Facility geography is outside organization scope",code:"GEOGRAPHY_FORBIDDEN"});request.log.error(error);return reply.code(503).send({error:"Facility update unavailable",code:"FACILITY_UPDATE_UNAVAILABLE"});}finally{c.release();}
  });

  app.post("/api/v1/facilities/:facilityId/review",async(request,reply)=>{
    const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;
    const id=(request.params as {facilityId:string}).facilityId;if(!UUID.test(id))return reply.code(400).send({error:"Invalid facility ID",code:"FACILITY_ID_INVALID"});
    const b=bodyOf(request as never),status=stringValue(b,"operationalStatus",40),note=stringValue(b,"note",2000),expected=versionValue(b.expectedVersion);
    if(!(FACILITY_STATUSES as readonly string[]).includes(status??"")||!note||!expected)return reply.code(400).send({error:"Supported operationalStatus, expectedVersion and review note are required",code:"FACILITY_REVIEW_INVALID"});
    const f=await facilityFor(pool,id);if(!f||f.organization_id!==auth.activeOrganizationId)return reply.code(404).send({error:"Facility not found",code:"FACILITY_NOT_FOUND"});
    if(!await canManage(pool,auth,f.organization_id))return reply.code(403).send({error:"facility:manage permission required",code:"FACILITY_PERMISSION_REQUIRED"});
    if(status==="ACTIVE"&&f.created_by_identity_id===auth.identityId)return reply.code(403).send({error:"Facility creator cannot independently activate their own facility profile",code:"FACILITY_SELF_REVIEW_FORBIDDEN"});
    const c=await pool.connect();try{await c.query("begin");const current=await c.query<FacilityRow>("select * from facilities where id=$1 for update",[id]);const old=current.rows[0];if(!old){await c.query("rollback");return reply.code(404).send({error:"Facility not found",code:"FACILITY_NOT_FOUND"});}
      if(old.version!==expected){await c.query("rollback");return reply.code(409).send({error:"Facility profile version changed; reload before review",code:"FACILITY_VERSION_CONFLICT"});}
      if(status==="ACTIVE"&&old.created_by_identity_id===auth.identityId){await c.query("rollback");return reply.code(403).send({error:"Facility creator cannot independently activate their own facility profile",code:"FACILITY_SELF_REVIEW_FORBIDDEN"});}
      const updated=await c.query<FacilityRow>("update facilities set operational_status=$2,updated_by_identity_id=$3 where id=$1 returning *",[id,status,auth.identityId]);
      await addEvent(c,id,auth.identityId,"STATUS_REVIEWED",old.version,updated.rows[0]!.version,old.operational_status,status,note,{});
      await c.query("commit");return facilityResponse(updated.rows[0]!);
    }catch(error){await c.query("rollback");request.log.error(error);return reply.code(503).send({error:"Facility review unavailable",code:"FACILITY_REVIEW_UNAVAILABLE"});}finally{c.release();}
  });

  app.post("/api/v1/facilities/:facilityId/memberships",async(request,reply)=>{
    const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;
    const id=(request.params as {facilityId:string}).facilityId;if(!UUID.test(id))return reply.code(400).send({error:"Invalid facility ID",code:"FACILITY_ID_INVALID"});
    const b=bodyOf(request as never),identityId=stringValue(b,"identityId",80),role=stringValue(b,"membershipRole",50),note=stringValue(b,"note",2000);
    if(!validUuid(identityId)||!(MEMBERSHIP_ROLES as readonly string[]).includes(role??"")||!note)return reply.code(400).send({error:"identityId, supported membershipRole and note are required",code:"FACILITY_MEMBERSHIP_INVALID"});
    const f=await facilityFor(pool,id);if(!f||f.organization_id!==auth.activeOrganizationId)return reply.code(404).send({error:"Facility not found",code:"FACILITY_NOT_FOUND"});
    if(!await canManage(pool,auth,f.organization_id))return reply.code(403).send({error:"facility:manage permission required",code:"FACILITY_PERMISSION_REQUIRED"});
    const c=await pool.connect();try{await c.query("begin");const q=await c.query<{id:string;status:string}>("insert into facility_memberships(facility_id,identity_id,membership_role,assigned_by_identity_id) values($1,$2,$3,$4) returning id,status",[id,identityId,role,auth.identityId]);await addEvent(c,id,auth.identityId,"MEMBERSHIP_GRANTED",f.version,f.version,f.operational_status,f.operational_status,note,{membershipId:q.rows[0]!.id,identityId,role,status:q.rows[0]!.status});await c.query("commit");return reply.code(201).send({source:"postgresql",syntheticData:false,membership:q.rows[0]});}
    catch(error){await c.query("rollback");const message=error instanceof Error?error.message:"";if(message.includes("facility membership identity must have verified membership"))return reply.code(409).send({error:"Identity must have verified membership in the facility organization",code:"FACILITY_ORG_MEMBERSHIP_REQUIRED"});if(message.includes("facility_memberships_facility_id_identity_id_membership_role_key"))return reply.code(409).send({error:"Facility membership already exists",code:"FACILITY_MEMBERSHIP_CONFLICT"});request.log.error(error);return reply.code(503).send({error:"Facility membership grant unavailable",code:"FACILITY_MEMBERSHIP_UNAVAILABLE"});}finally{c.release();}
  });

  app.post("/api/v1/facilities/:facilityId/memberships/:membershipId/review",async(request,reply)=>{
    const auth=await authFor(request as never,reply,pool);if(!auth||!pool)return;
    const params=request.params as {facilityId:string;membershipId:string};if(!UUID.test(params.facilityId)||!UUID.test(params.membershipId))return reply.code(400).send({error:"Invalid facility or membership ID",code:"FACILITY_ID_INVALID"});
    const b=bodyOf(request as never),status=stringValue(b,"status",30),note=stringValue(b,"note",2000);
    if(!["VERIFIED","REJECTED","UNAVAILABLE"].includes(status??"")||!note)return reply.code(400).send({error:"Supported membership status and review note are required",code:"FACILITY_MEMBERSHIP_REVIEW_INVALID"});
    const f=await facilityFor(pool,params.facilityId);if(!f||f.organization_id!==auth.activeOrganizationId)return reply.code(404).send({error:"Facility not found",code:"FACILITY_NOT_FOUND"});
    if(!await canManage(pool,auth,f.organization_id))return reply.code(403).send({error:"facility:manage permission required",code:"FACILITY_PERMISSION_REQUIRED"});
    const c=await pool.connect();try{await c.query("begin");const q=await c.query<{id:string;status:string;assigned_by_identity_id:string}>("select id,status,assigned_by_identity_id from facility_memberships where id=$1 and facility_id=$2 for update",[params.membershipId,params.facilityId]);const m=q.rows[0];if(!m){await c.query("rollback");return reply.code(404).send({error:"Facility membership not found",code:"FACILITY_MEMBERSHIP_NOT_FOUND"});}if(m.assigned_by_identity_id===auth.identityId){await c.query("rollback");return reply.code(403).send({error:"Membership grantor cannot review their own grant",code:"FACILITY_SELF_REVIEW_FORBIDDEN"});}
      await c.query("update facility_memberships set status=$2,reviewed_by_identity_id=$3,review_note=$4,reviewed_at=now() where id=$1",[m.id,status,auth.identityId,note]);
      await addEvent(c,f.id,auth.identityId,"MEMBERSHIP_REVIEWED",f.version,f.version,f.operational_status,f.operational_status,note,{membershipId:m.id,previousStatus:m.status,newStatus:status});
      await c.query("commit");return {source:"postgresql",syntheticData:false,membership:{id:m.id,status,reviewedByIdentityId:auth.identityId,reviewedAt:new Date().toISOString()}};
    }catch(error){await c.query("rollback");request.log.error(error);return reply.code(503).send({error:"Facility membership review unavailable",code:"FACILITY_MEMBERSHIP_REVIEW_UNAVAILABLE"});}finally{c.release();}
  });
}
