import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

const url=process.env.DATABASE_URL;
test("facility device links enforce organization scope, independent review, geography locks and append-only events",{skip:!url},async()=>{
 assert.ok(url);
 const pool=new Pool({connectionString:url,max:1,ssl:process.env.DATABASE_SSL==="false"?undefined:{rejectUnauthorized:false}});
 const c=await pool.connect(),suffix=randomUUID();
 try{
  await c.query("begin");
  const org=(await c.query<{id:string}>("insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",[`facility-device-org-${suffix}`])).rows[0]!.id;
  const otherOrg=(await c.query<{id:string}>("insert into organizations(name,organization_type) values($1,'PROCESSOR') returning id",[`facility-device-other-${suffix}`])).rows[0]!.id;
  const actor=(await c.query<{id:string}>("insert into identities(external_subject,display_name) values($1,$2) returning id",[`facility-device-actor-${suffix}`,"Device-link requester"])).rows[0]!.id;
  const reviewer=(await c.query<{id:string}>("insert into identities(external_subject,display_name) values($1,$2) returning id",[`facility-device-reviewer-${suffix}`,"Independent device-link reviewer"])).rows[0]!.id;
  const role=(await c.query<{id:string}>("insert into roles(organization_id,name,permissions) values($1,$2,'[\"facility:manage\"]'::jsonb) returning id",[org,`FACILITY-DEVICE-${suffix}`])).rows[0]!.id;
  await c.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$2,$3,'VERIFIED')",[actor,org,role,reviewer]);
  const state=(await c.query<{id:string}>("insert into geography(kind,code,name,source) values('STATE_UT',$1,$2,'test') returning id",[`FDLS-${suffix}`,`Facility Device State ${suffix}`])).rows[0]!.id;
  const geo=(await c.query<{id:string}>("insert into geography(parent_id,kind,code,name,source) values($1,'DISTRICT',$2,$3,'test') returning id",[state,`FDL-${suffix}`,`Facility Device District ${suffix}`])).rows[0]!.id;
  const otherState=(await c.query<{id:string}>("insert into geography(kind,code,name,source) values('STATE_UT',$1,$2,'test') returning id",[`FDLOS-${suffix}`,`Facility Device Other State ${suffix}`])).rows[0]!.id;
  const otherGeo=(await c.query<{id:string}>("insert into geography(parent_id,kind,code,name,source) values($1,'DISTRICT',$2,$3,'test') returning id",[otherState,`FDLO-${suffix}`,`Facility Device Other District ${suffix}`])).rows[0]!.id;
  await c.query("insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED'),($1,$3,'VERIFIED')",[org,geo,otherGeo]);
  const facility=(await c.query<{id:string}>("insert into facilities(organization_id,facility_code,name,facility_type,geography_id,created_by_identity_id,updated_by_identity_id) values($1,$2,'Device Link Test Facility','COLLECTION_CENTRE',$3,$4,$4) returning id",[org,`FDL-${suffix}`,geo,actor])).rows[0]!.id;
  await c.query("update facilities set operational_status='ACTIVE',updated_by_identity_id=$2 where id=$1",[facility,reviewer]);
  const device=(await c.query<{id:string}>("insert into field_devices(device_id,identity_id,organization_id,status) values($1,$2,$3,'VERIFIED') returning id",[`device-${suffix}`,actor,org])).rows[0]!.id;
  const otherOrgDevice=(await c.query<{id:string}>("insert into field_devices(device_id,identity_id,organization_id,status) values($1,$2,$3,'VERIFIED') returning id",[`other-device-${suffix}`,actor,otherOrg])).rows[0]!.id;
  const pendingDevice=(await c.query<{id:string}>("insert into field_devices(device_id,identity_id,organization_id,status) values($1,$2,$3,'PENDING') returning id",[`pending-device-${suffix}`,actor,org])).rows[0]!.id;
  const link=(await c.query<{id:string;status:string}>("insert into facility_device_links(organization_id,facility_id,device_id,note,created_by_identity_id) values($1,$2,$3,'Explicit site-device association',$4) returning id,status",[org,facility,device,actor])).rows[0]!;
  assert.equal(link.status,"PENDING");
  await rejectsInSavepoint(c,()=>c.query("insert into facility_device_links(organization_id,facility_id,device_id,note,created_by_identity_id) values($1,$2,$3,'Cross tenant device link',$4)",[org,facility,otherOrgDevice,actor]),/facility device link must stay within one organization/i);
  await rejectsInSavepoint(c,()=>c.query("insert into facility_device_links(organization_id,facility_id,device_id,note,created_by_identity_id) values($1,$2,$3,'Unverified device link',$4)",[org,facility,pendingDevice,actor]),/requires an independently verified enrolled device/i);
  await rejectsInSavepoint(c,()=>c.query("update facilities set geography_id=$2,updated_by_identity_id=$3 where id=$1",[facility,otherGeo,reviewer]),/cannot change facility geography while pending or verified device links exist/i);
  await rejectsInSavepoint(c,()=>c.query("update facility_device_links set status='VERIFIED',reviewed_by_identity_id=$2,reviewed_at=now(),review_note='Self review' where id=$1",[link.id,actor]),/cannot review their own link|check constraint/i);
  await c.query("update facility_device_links set status='VERIFIED',reviewed_by_identity_id=$2,reviewed_at=now(),review_note='Independent review' where id=$1",[link.id,reviewer]);
  await rejectsInSavepoint(c,()=>c.query("insert into facility_device_links(organization_id,facility_id,device_id,note,created_by_identity_id) values($1,$2,$3,'Duplicate open link',$4)",[org,facility,device,actor]),/unique constraint/i);
  const event=(await c.query<{id:string}>("insert into facility_device_link_events(link_id,actor_identity_id,event_type,new_status,note) values($1,$2,'LINK_REQUESTED','PENDING','Test event') returning id",[link.id,actor])).rows[0]!.id;
  await rejectsInSavepoint(c,()=>c.query("update facility_device_link_events set note='tampered' where id=$1",[event]),/append-only/i);
  assert.notEqual(org,otherOrg);
  await c.query("rollback");
 }catch(error){await c.query("rollback").catch(()=>undefined);throw error;}finally{c.release();await pool.end();}
});
async function rejectsInSavepoint(client:PoolClient,operation:()=>Promise<unknown>,pattern:RegExp):Promise<void>{
 await client.query("savepoint expected_failure");
 try{await operation();await client.query("rollback to savepoint expected_failure");assert.fail("Expected operation to fail");}
 catch(error){await client.query("rollback to savepoint expected_failure");assert.match(error instanceof Error?error.message:String(error),pattern);}
 finally{await client.query("release savepoint expected_failure");}
}
