import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerEvidenceVaultRoutes } from "./evidence-vault-routes.js";

const identityId="11111111-1111-4111-8111-111111111111";
const organizationId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
class RawPool {
  rawCalls:Array<{sql:string;values?:unknown[]}>=[];
  connectCalls=0;
  async query(sql:string,values?:unknown[]){
    this.rawCalls.push({sql,...(values===undefined?{}:{values})});
    if(sql.includes("auth_private.resolve_session"))return {rows:[{identity_id:identityId,organization_id:organizationId,role_id:"role-evidence-reader",membership_status:"VERIFIED"}],rowCount:1};
    return {rows:[],rowCount:0};
  }
  async connect(){this.connectCalls++;throw new Error("signed tenant transaction must not open without configuration");}
}
async function withSecurityDefiner<T>(work:()=>Promise<T>):Promise<T>{
  const previous=process.env.RUPAYKG_AUTH_RESOLVER_MODE;
  process.env.RUPAYKG_AUTH_RESOLVER_MODE="security_definer";
  try{return await work();}
  finally{if(previous===undefined)delete process.env.RUPAYKG_AUTH_RESOLVER_MODE;else process.env.RUPAYKG_AUTH_RESOLVER_MODE=previous;}
}
test("evidence list and artifact download fail closed when signed tenant context is missing",async()=>{
 await withSecurityDefiner(async()=>{
  const pool=new RawPool(),app=Fastify();
  await registerEvidenceVaultRoutes(app,pool as unknown as Pool);
  try{
   const headers={authorization:"Bearer valid-evidence-session"};
   const list=await app.inject({method:"GET",url:"/api/v1/evidence-vault?activityId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",headers});
   assert.equal(list.statusCode,503);
   assert.equal(list.json().code,"RLS_CONTEXT_CONFIG_REQUIRED");
   const detail=await app.inject({method:"GET",url:"/api/v1/evidence-vault/cccccccc-cccc-4ccc-8ccc-cccccccccccc",headers});
   assert.equal(detail.statusCode,503);
   assert.equal(detail.json().code,"RLS_CONTEXT_CONFIG_REQUIRED");
   assert.equal(pool.connectCalls,0);
   assert.equal(pool.rawCalls.some(x=>/from evidence|from activities|evidence_artifact_versions/.test(x.sql)),false);
  }finally{await app.close();}
 });
});
