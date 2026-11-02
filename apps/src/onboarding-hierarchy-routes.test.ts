import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import Fastify from "fastify";
import test from "node:test";
import type { Pool } from "pg";
import { registerOnboardingHierarchyRoutes } from "./onboarding-hierarchy-routes.js";

type Call={sql:string;values:unknown[]|undefined};
class FakePool {
  calls:Call[]=[];
  handler:(sql:string,values?:unknown[])=>{rows:unknown[]}=()=>({rows:[]});
  async query(sql:string,values?:unknown[]){this.calls.push({sql,values});return this.handler(sql,values);}
}
const identityId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const applicationId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const organizationId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
async function setup(appPool:FakePool,authPool:FakePool){
  const app=Fastify();
  await registerOnboardingHierarchyRoutes(app,appPool as unknown as Pool,authPool as unknown as Pool);
  await app.ready();return app;
}
function authResolver(pool:FakePool){
  pool.handler=(sql)=>sql.includes("resolve_session")
    ?{rows:[{identity_id:identityId,organization_id:null,role_id:null,membership_status:null}]}
    :{rows:[]};
}

test("review queue is read only through the identity-bound database function",async()=>{
  const appPool=new FakePool(),authPool=new FakePool();authResolver(appPool);
  const queue={source:"postgresql",syntheticData:false,applications:[{id:applicationId,canReview:true}]};
  authPool.handler=(sql)=>sql.includes("get_onboarding_review_queue")?{rows:[{queue_result:queue}]}:{rows:[]};
  const previous=process.env.RUPAYKG_AUTH_RESOLVER_MODE;process.env.RUPAYKG_AUTH_RESOLVER_MODE="security_definer";
  const app=await setup(appPool,authPool);
  try{
    const token="hierarchy-review-queue-token";
    const response=await app.inject({method:"GET",url:"/api/v1/onboarding/review-queue",headers:{authorization:`Bearer ${token}`}});
    assert.equal(response.statusCode,200);assert.deepEqual(response.json(),queue);
    assert.equal(appPool.calls.length,1);assert.match(appPool.calls[0]!.sql,/auth_private\.resolve_session/);
    assert.equal(authPool.calls.length,1);assert.match(authPool.calls[0]!.sql,/auth_private\.get_onboarding_review_queue/);
    assert.deepEqual(authPool.calls[0]!.values,[createHash("sha256").update(token).digest("hex")]);
    assert.ok([...appPool.calls,...authPool.calls].every(c=>!/\b(insert|update|delete)\b/i.test(c.sql)));
  }finally{await app.close();if(previous===undefined)delete process.env.RUPAYKG_AUTH_RESOLVER_MODE;else process.env.RUPAYKG_AUTH_RESOLVER_MODE=previous;}
});

test("legal verification delegates the atomic write to the identity-bound database function",async()=>{
  const appPool=new FakePool(),authPool=new FakePool();authResolver(appPool);
  authPool.handler=(sql)=>sql.includes("verify_stakeholder_legal")
    ?{rows:[{verification_result:{status:"VERIFIED",organizationId}}]}:{rows:[]};
  const previous=process.env.RUPAYKG_AUTH_RESOLVER_MODE;process.env.RUPAYKG_AUTH_RESOLVER_MODE="security_definer";
  const app=await setup(appPool,authPool);
  try{
    const token="legal-review-token";
    const response=await app.inject({method:"POST",url:`/api/v1/onboarding/applications/${applicationId}/verify-legal`,headers:{authorization:`Bearer ${token}`},payload:{verificationStatus:"VERIFIED",verificationNote:"Evidence checked"}});
    assert.equal(response.statusCode,200);assert.equal(response.json().organizationId,organizationId);
    assert.match(authPool.calls[0]!.sql,/auth_private\.verify_stakeholder_legal/);
    assert.deepEqual(authPool.calls[0]!.values,[createHash("sha256").update(token).digest("hex"),applicationId,"VERIFIED","Evidence checked"]);
    assert.ok([...appPool.calls,...authPool.calls].every(c=>!/\b(insert|update|delete)\b/i.test(c.sql)));
  }finally{await app.close();if(previous===undefined)delete process.env.RUPAYKG_AUTH_RESOLVER_MODE;else process.env.RUPAYKG_AUTH_RESOLVER_MODE=previous;}
});

test("hierarchical approval delegates decisions to the identity-bound database function",async()=>{
  const appPool=new FakePool(),authPool=new FakePool();authResolver(appPool);
  authPool.handler=(sql)=>sql.includes("review_stakeholder_application")
    ?{rows:[{decision_result:{status:"PENDING",approvalLevel:"DISTRICT"}}]}:{rows:[]};
  const previous=process.env.RUPAYKG_AUTH_RESOLVER_MODE;process.env.RUPAYKG_AUTH_RESOLVER_MODE="security_definer";
  const app=await setup(appPool,authPool);
  try{
    const token="hierarchy-approval-token";
    const response=await app.inject({method:"POST",url:`/api/v1/onboarding/applications/${applicationId}/approve`,headers:{authorization:`Bearer ${token}`},payload:{reviewNote:"Scope verified"}});
    assert.equal(response.statusCode,200);assert.equal(response.json().approvalLevel,"DISTRICT");
    assert.match(authPool.calls[0]!.sql,/auth_private\.review_stakeholder_application/);
    assert.deepEqual(authPool.calls[0]!.values,[createHash("sha256").update(token).digest("hex"),applicationId,"approve","Scope verified"]);
    assert.ok([...appPool.calls,...authPool.calls].every(c=>!/\b(insert|update|delete)\b/i.test(c.sql)));
  }finally{await app.close();if(previous===undefined)delete process.env.RUPAYKG_AUTH_RESOLVER_MODE;else process.env.RUPAYKG_AUTH_RESOLVER_MODE=previous;}
});

test("database authority denial is returned as forbidden and never falls back to application SQL",async()=>{
  const appPool=new FakePool(),authPool=new FakePool();authResolver(appPool);
  authPool.handler=(sql)=>{if(sql.includes("review_stakeholder_application"))throw new Error("ONBOARDING_AUTHORITY_FORBIDDEN");return{rows:[]};};
  const previous=process.env.RUPAYKG_AUTH_RESOLVER_MODE;process.env.RUPAYKG_AUTH_RESOLVER_MODE="security_definer";
  const app=await setup(appPool,authPool);
  try{
    const response=await app.inject({method:"POST",url:`/api/v1/onboarding/applications/${applicationId}/approve`,headers:{authorization:"Bearer unauthorized-token"},payload:{}});
    assert.equal(response.statusCode,403);assert.equal(response.json().code,"ONBOARDING_AUTHORITY_FORBIDDEN");
    assert.equal(authPool.calls.length,1);assert.equal(appPool.calls.length,1);
  }finally{await app.close();if(previous===undefined)delete process.env.RUPAYKG_AUTH_RESOLVER_MODE;else process.env.RUPAYKG_AUTH_RESOLVER_MODE=previous;}
});
