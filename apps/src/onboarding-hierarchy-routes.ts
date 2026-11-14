import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, type AuthContext } from "./auth.js";
import { withTenantTransaction } from "./tenant-db.js";

function bodyOf(r:{body:unknown}){return r.body&&typeof r.body==="object"?r.body as Record<string,unknown>:{};}
function text(b:Record<string,unknown>,k:string){return typeof b[k]==="string"&&b[k].trim()?b[k].trim():null;}

async function authn(request:any,reply:any,pool:Pool|null):Promise<AuthContext|null>{
  if(!pool){reply.code(503).send({error:"Database unavailable",code:"DATABASE_UNAVAILABLE"});return null;}
  const a=await authenticate(request,pool);
  if(!a){reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});return null;}
  return a;
}

function boundaryError(e:unknown){
  const message=e instanceof Error?e.message:"";
  const known=[
    "ONBOARDING_REVIEW_IDENTITY_INVALID","ONBOARDING_AUTHORITY_FORBIDDEN",
    "APPLICATION_NOT_FOUND","APPROVAL_CHAIN_COMPLETE","LEGAL_EVIDENCE_MISSING",
    "LEGAL_VERIFICATION_REQUIRED","LEGAL_REVIEW_INVALID","INVALID_DECISION",
    "REVIEW_NOTE_REQUIRED"
  ];
  const code=known.find(k=>message.includes(k));
  if(code){
    const status=code==="ONBOARDING_AUTHORITY_FORBIDDEN"?403:
      code==="APPLICATION_NOT_FOUND"?404:
      code==="LEGAL_EVIDENCE_MISSING"||code==="LEGAL_VERIFICATION_REQUIRED"?409:
      code==="LEGAL_REVIEW_INVALID"||code==="INVALID_DECISION"||code==="REVIEW_NOTE_REQUIRED"?400:409;
    return {status,body:{error:code,code}};
  }
  return {status:503,body:{error:"Onboarding review boundary unavailable",code:"ONBOARDING_REVIEW_BOUNDARY_UNAVAILABLE"}};
}

export async function registerOnboardingHierarchyRoutes(app:FastifyInstance,pool:Pool|null):Promise<void>{
  app.get("/api/v1/onboarding/review-queue",async(request,reply)=>{
    const a=await authn(request,reply,pool);if(!a||!pool)return;
    try{
      const r=await withTenantTransaction(pool,a,client=>client.query<{queue:unknown}>(
        "select app.onboarding_review_queue($1) as queue",[a.identityId],
      ));
      return {source:"postgresql",syntheticData:false,applications:r.rows[0]?.queue??[]};
    }catch(e){
      const x=boundaryError(e);request.log.error(e);return reply.code(x.status).send(x.body);
    }
  });

  app.post("/api/v1/onboarding/applications/:applicationId/verify-legal",async(request,reply)=>{
    const a=await authn(request,reply,pool);if(!a||!pool)return;
    const id=(request.params as any).applicationId;
    const b=bodyOf(request),status=text(b,"verificationStatus"),note=text(b,"verificationNote");
    if(!note||!["VERIFIED","REJECTED"].includes(status??""))
      return reply.code(400).send({error:"verificationStatus and verificationNote are required",code:"LEGAL_REVIEW_INVALID"});
    try{
      const r=await withTenantTransaction(pool,a,client=>client.query<{result:unknown}>(
        "select app.onboarding_verify_legal($1,$2,$3,$4) as result",
        [a.identityId,id,status,note],
      ));
      return r.rows[0]?.result;
    }catch(e){
      const x=boundaryError(e);request.log.error(e);return reply.code(x.status).send(x.body);
    }
  });

  app.post("/api/v1/onboarding/applications/:applicationId/:action",async(request,reply)=>{
    const a=await authn(request,reply,pool);if(!a||!pool)return;
    const p=request.params as any,id=p.applicationId,action=p.action;
    const b=bodyOf(request),note=text(b,"reviewNote");
    if(!["approve","reject"].includes(action))
      return reply.code(400).send({error:"Invalid onboarding decision",code:"INVALID_DECISION"});
    if(action==="reject"&&!note)
      return reply.code(400).send({error:"A review rationale is required when rejecting an application.",code:"REVIEW_NOTE_REQUIRED"});
    try{
      const r=await withTenantTransaction(pool,a,client=>client.query<{result:unknown}>(
        "select app.onboarding_decide($1,$2,$3,$4) as result",
        [a.identityId,id,action,note],
      ));
      return r.rows[0]?.result;
    }catch(e){
      const x=boundaryError(e);request.log.error(e);return reply.code(x.status).send(x.body);
    }
  });
}
