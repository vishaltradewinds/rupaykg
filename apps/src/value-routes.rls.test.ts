import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerValueRoutes } from "./value-routes.js";

const identityId="11111111-1111-4111-8111-111111111111";
const organizationId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
class RawPool {
  rawCalls:Array<{sql:string;values?:unknown[]}>=[];
  connectCalls=0;
  async query(sql:string,values?:unknown[]){
    this.rawCalls.push({sql,...(values===undefined?{}:{values})});
    if(sql.includes("auth_private.resolve_session"))return {rows:[{identity_id:identityId,organization_id:organizationId,role_id:"role-bwg-operator",membership_status:"VERIFIED"}],rowCount:1};
    return {rows:[],rowCount:0};
  }
  async connect(){this.connectCalls++;throw new Error("tenant transaction must not start without signing config");}
}
async function makeApp(raw:RawPool){
  const app=Fastify();
  await registerValueRoutes(app,raw as unknown as Pool);
  return app;
}
const auth={authorization:"Bearer valid-value-session"};
test("BWG workspace and all mutation handlers fail closed without signed tenant context",async()=>{
  const raw=new RawPool(),app=await makeApp(raw);
  const cases:Array<{method:"GET"|"POST";url:string;payload?:Record<string,unknown>}>=[
    {method:"GET",url:"/api/v1/workspaces/bwg"},
    {method:"POST",url:"/api/v1/bwg/profile",payload:{organizationId,jurisdictionId:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",floorAreaSqm:20000,waterConsumptionLpd:40000,wasteGenerationKgDay:100,establishmentType:"BWG"}},
    {method:"POST",url:"/api/v1/bwg/reporting-periods",payload:{organizationId,periodStart:"2026-01-01",periodEnd:"2026-12-31",reportingBasis:"CALENDAR_YEAR"}},
    {method:"POST",url:"/api/v1/bwg/reporting-periods/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/waste",payload:{wasteStream:"ORGANIC",unit:"kg",generatedQuantity:10}},
    {method:"POST",url:"/api/v1/bwg/reporting-periods/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/epr",payload:{schemeId:"ffffffff-ffff-4fff-8fff-ffffffffffff",categoryCode:"PLASTIC",obligatedQuantity:10,fulfilledQuantity:5}},
    {method:"POST",url:"/api/v1/bwg/reporting-periods/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/esg",payload:{metricCode:"ENERGY",scope:"2",unit:"kWh",value:10}}
  ];
  try{
    for(const item of cases){
      const response=await app.inject({method:item.method,url:item.url,headers:auth,payload:item.payload});
      assert.equal(response.statusCode,503,item.url);
      assert.equal(response.json().code,"RLS_CONTEXT_CONFIG_REQUIRED",item.url);
    }
    assert.equal(raw.connectCalls,0);
    assert.equal(raw.rawCalls.some(call=>/insert into bwg_|from bwg_reporting_periods|from bwg_profiles/.test(call.sql)),false);
  }finally{await app.close();}
});
test("BWG profile rejects a caller-selected organization that differs from the authenticated active organization",async()=>{
  const raw=new RawPool(),app=await makeApp(raw);
  try{
    const response=await app.inject({method:"POST",url:"/api/v1/bwg/profile",headers:auth,payload:{organizationId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",jurisdictionId:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",floorAreaSqm:20000,waterConsumptionLpd:40000,wasteGenerationKgDay:100,establishmentType:"BWG"}});
    assert.equal(response.statusCode,403);
    assert.equal(response.json().code,"RLS_ORGANIZATION_CONTEXT_REQUIRED");
    assert.equal(raw.connectCalls,0);
  }finally{await app.close();}
});
