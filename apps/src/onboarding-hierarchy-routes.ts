import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate } from "./auth.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function bodyOf(r:{body:unknown}){return r.body&&typeof r.body==="object"?r.body as Record<string,unknown>:{};}
function text(b:Record<string,unknown>,k:string){return typeof b[k]==="string"&&b[k].trim()?b[k].trim():null;}
function tokenHash(request:any):string|null{
  const header=request.headers.authorization;
  if(typeof header!=="string"||!header.startsWith("Bearer "))return null;
  const token=header.slice(7).trim();
  return token?createHash("sha256").update(token).digest("hex"):null;
}
async function authn(request:any,reply:any,appPool:Pool|null,authPool:Pool|null):Promise<string|null>{
  if(!appPool||!authPool){reply.code(503).send({error:"Authentication database unavailable",code:"AUTH_DATABASE_UNAVAILABLE"});return null;}
  try{
    const auth=await authenticate(request,appPool);
    if(!auth){reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});return null;}
    const hash=tokenHash(request);
    if(!hash){reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});return null;}
    return hash;
  }catch(error){request.log.error(error);reply.code(503).send({error:"Authentication service unavailable",code:"AUTH_UNAVAILABLE"});return null;}
}
function failure(error:unknown,request:any,reply:any,defaultMessage:string,defaultCode:string){
  const message=(error as {message?:string})?.message??"";
  if(message.includes("AUTH_REQUIRED"))return reply.code(401).send({error:"Authenticated session required",code:"AUTH_REQUIRED"});
  if(message.includes("ONBOARDING_AUTHORITY_FORBIDDEN")||message.includes("STAKEHOLDER_SELF_APPROVAL_FORBIDDEN"))return reply.code(403).send({error:"Authorized reviewer required",code:"ONBOARDING_AUTHORITY_FORBIDDEN"});
  if(message.includes("APPLICATION_NOT_FOUND"))return reply.code(404).send({error:"Pending stakeholder application not found",code:"APPLICATION_NOT_FOUND"});
  if(message.includes("LEGAL_EVIDENCE_MISSING"))return reply.code(409).send({error:"At least one persisted legal evidence reference with a content hash is required before legal verification.",code:"LEGAL_EVIDENCE_MISSING"});
  if(message.includes("LEGAL_VERIFICATION_REQUIRED"))return reply.code(409).send({error:"Legal organization verification must be VERIFIED before final platform approval",code:"LEGAL_VERIFICATION_REQUIRED"});
  if(message.includes("APPROVAL_CHAIN_COMPLETE"))return reply.code(409).send({error:"No pending approval step remains",code:"APPROVAL_CHAIN_COMPLETE"});
  if(message.includes("REVIEW_NOTE_REQUIRED"))return reply.code(400).send({error:"A review rationale is required when rejecting an application.",code:"REVIEW_NOTE_REQUIRED"});
  if(message.includes("LEGAL_REVIEW_INVALID")||message.includes("INVALID_DECISION"))return reply.code(400).send({error:"Invalid onboarding review request",code:"INVALID_REVIEW"});
  request.log.error(error);
  return reply.code(503).send({error:defaultMessage,code:defaultCode});
}

export async function registerOnboardingHierarchyRoutes(app:FastifyInstance,appPool:Pool|null,authPool:Pool|null):Promise<void>{
  app.get("/api/v1/onboarding/review-queue",async(request,reply)=>{
    const hash=await authn(request,reply,appPool,authPool);if(!hash||!authPool)return;
    try{
      const result=await authPool.query<{queue_result:any}>(
        "select auth_private.get_onboarding_review_queue($1) as queue_result",[hash],
      );
      const value=result.rows[0]?.queue_result;
      if(!value||!Array.isArray(value.applications))throw new Error("ONBOARDING_QUEUE_FUNCTION_INVALID_RESULT");
      return value;
    }catch(error){return failure(error,request,reply,"Stakeholder review queue unavailable","ONBOARDING_QUEUE_UNAVAILABLE");}
  });

  app.post("/api/v1/onboarding/applications/:applicationId/verify-legal",async(request,reply)=>{
    const hash=await authn(request,reply,appPool,authPool);if(!hash||!authPool)return;
    const id=(request.params as {applicationId:string}).applicationId;
    if(!UUID.test(id))return reply.code(400).send({error:"Invalid application id",code:"INVALID_APPLICATION_ID"});
    const b=bodyOf(request),status=text(b,"verificationStatus"),note=text(b,"verificationNote");
    if(!note||!["VERIFIED","REJECTED"].includes(status??""))return reply.code(400).send({error:"verificationStatus and verificationNote are required",code:"LEGAL_REVIEW_INVALID"});
    try{
      const result=await authPool.query<{verification_result:any}>(
        "select auth_private.verify_stakeholder_legal($1,$2::uuid,$3,$4) as verification_result",
        [hash,id,status,note],
      );
      const value=result.rows[0]?.verification_result;
      if(!value?.organizationId||value.status!==status)throw new Error("LEGAL_VERIFICATION_FUNCTION_INVALID_RESULT");
      return {source:"postgresql",syntheticData:false,status:value.status,organizationId:value.organizationId};
    }catch(error){return failure(error,request,reply,"Legal verification unavailable","LEGAL_REVIEW_UNAVAILABLE");}
  });

  app.post("/api/v1/onboarding/applications/:applicationId/:action",async(request,reply)=>{
    const hash=await authn(request,reply,appPool,authPool);if(!hash||!authPool)return;
    const p=request.params as {applicationId:string;action:string};
    if(!UUID.test(p.applicationId)||!["approve","reject"].includes(p.action))return reply.code(400).send({error:"Invalid onboarding decision",code:"INVALID_DECISION"});
    const note=text(bodyOf(request),"reviewNote");
    if(p.action==="reject"&&!note)return reply.code(400).send({error:"A review rationale is required when rejecting an application.",code:"REVIEW_NOTE_REQUIRED"});
    try{
      const result=await authPool.query<{decision_result:any}>(
        "select auth_private.review_stakeholder_application($1,$2::uuid,$3,$4) as decision_result",
        [hash,p.applicationId,p.action,note],
      );
      const value=result.rows[0]?.decision_result;
      if(!value?.status||!value?.approvalLevel)throw new Error("ONBOARDING_DECISION_FUNCTION_INVALID_RESULT");
      return {source:"postgresql",syntheticData:false,status:value.status,approvalLevel:value.approvalLevel};
    }catch(error){return failure(error,request,reply,"Stakeholder approval could not be recorded","ONBOARDING_DECISION_UNAVAILABLE");}
  });
}
