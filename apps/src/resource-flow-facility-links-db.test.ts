import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
const url=process.env.DATABASE_URL;

test("resource flows bind optional facility endpoints to organization and exact geography",{skip:!url},async()=>{
 assert.ok(url);
 const pool=new Pool({connectionString:url,max:1,ssl:process.env.DATABASE_SSL==="false"?undefined:{rejectUnauthorized:false}});
 const c=await pool.connect(),suffix=randomUUID();
 try{
  await c.query("begin");
  const org=(await c.query<{id:string}>("insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",[`resource-flow-facility-org-${suffix}`])).rows[0]!.id;
  const otherOrg=(await c.query<{id:string}>("insert into organizations(name,organization_type) values($1,'PROCESSOR') returning id",[`resource-flow-facility-other-${suffix}`])).rows[0]!.id;
  const actor=(await c.query<{id:string}>("insert into identities(external_subject,display_name) values($1,'Flow actor') returning id",[`resource-flow-facility-actor-${suffix}`])).rows[0]!.id;
  const reviewer=(await c.query<{id:string}>("insert into identities(external_subject,display_name) values($1,'Flow reviewer') returning id",[`resource-flow-facility-reviewer-${suffix}`])).rows[0]!.id;
  const geo=(await c.query<{id:string}>("insert into geography(kind,code,name,source) values('DISTRICT',$1,$2,'test') returning id",[`RFF-${suffix}`,`Resource Flow District ${suffix}`])).rows[0]!.id;
  const otherGeo=(await c.query<{id:string}>("insert into geography(kind,code,name,source) values('DISTRICT',$1,$2,'test') returning id",[`RFFO-${suffix}`,`Resource Flow Other District ${suffix}`])).rows[0]!.id;
  await c.query("insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED'),($1,$3,'VERIFIED')",[org,geo,otherGeo]);
  const facility=(await c.query<{id:string}>("insert into facilities(organization_id,facility_code,name,facility_type,geography_id,created_by_identity_id,updated_by_identity_id) values($1,$2,'Flow Facility','COLLECTION_CENTRE',$3,$4,$4) returning id",[org,`RFF-${suffix}`,geo,actor])).rows[0]!.id;
  await c.query("update facilities set operational_status='ACTIVE',updated_by_identity_id=$2 where id=$1",[facility,reviewer]);
  const otherFacility=(await c.query<{id:string}>("insert into facilities(organization_id,facility_code,name,facility_type,geography_id,created_by_identity_id,updated_by_identity_id) values($1,$2,'Other Flow Facility','RECYCLING_PROCESSING',$3,$4,$4) returning id",[org,`RFFO-${suffix}`,otherGeo,actor])).rows[0]!.id;
  await c.query("update facilities set operational_status='ACTIVE',updated_by_identity_id=$2 where id=$1",[otherFacility,reviewer]);
  const flow=(await c.query<{id:string;source_facility_id:string}>("insert into resource_flows(organization_id,origin_type,resource_form,material_code,declared_quantity,unit,source_geography_id,source_facility_id) values($1,'COLLECTION','SOLID','MIXED_MSW',10,'kg',$2,$3) returning id,source_facility_id",[org,geo,facility])).rows[0]!;
  assert.equal(flow.source_facility_id,facility);
  await rejectsInSavepoint(c,()=>c.query("insert into resource_flows(organization_id,origin_type,resource_form,material_code,declared_quantity,unit,source_geography_id,source_facility_id) values($1,'COLLECTION','SOLID','MIXED_MSW',10,'kg',$2,$3)",[org,geo,otherFacility]),/exactly match source geography/i);
  await rejectsInSavepoint(c,()=>c.query("insert into resource_flows(organization_id,origin_type,resource_form,material_code,declared_quantity,unit,source_geography_id,source_facility_id) values($1,'COLLECTION','SOLID','MIXED_MSW',10,'kg',$2,$3)",[otherOrg,geo,facility]),/belong to the flow organization/i);
  await c.query("rollback");
 }catch(error){await c.query("rollback").catch(()=>undefined);throw error;}finally{c.release();await pool.end();}
});
async function rejectsInSavepoint(client:PoolClient,operation:()=>Promise<unknown>,pattern:RegExp):Promise<void>{
 await client.query("savepoint expected_failure");
 try{await operation();await client.query("rollback to savepoint expected_failure");assert.fail("Expected operation to fail");}
 catch(error){await client.query("rollback to savepoint expected_failure");assert.match(error instanceof Error?error.message:String(error),pattern);}
 finally{await client.query("release savepoint expected_failure");}
}
