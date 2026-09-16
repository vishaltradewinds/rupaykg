import { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getApps, initializeApp } from "firebase/app";
import "./ulb-command-center.css";

type Membership={organization_id:string;role_name:string;organization_name:string;organization_type:string;status:string;permissions:string[]};
type Me={memberships:Membership[]};
type Workspace={source?:string;syntheticData?:boolean;[key:string]:unknown};
type Counts=Record<string,number>;
const cfg={apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID};
const firebaseConfigured=Object.values(cfg).every(Boolean);
const app=firebaseConfigured?(getApps()[0]??initializeApp(cfg)):null;
const auth=app?getAuth(app):null;
function orgId(){return localStorage.getItem("rupaykg.activeOrganizationId")??"";}
async function api<T>(path:string,token:string){const h=new Headers({Accept:"application/json",Authorization:`Bearer ${token}`});const id=orgId();if(id)h.set("x-rupaykg-organization-id",id);const r=await fetch(path,{headers:h});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json() as Promise<T>;}
const arr=(w:Workspace|undefined,key:string)=>((w?.[key]??(w?.data as Record<string,unknown>|undefined)?.[key]) as unknown[])??[];
const count=(rows:unknown[])=>rows.length;
function ULBCommandCenter(){
 const [token,setToken]=useState("");const [me,setMe]=useState<Me|null>(null);const [counts,setCounts]=useState<Counts>({});const [ops,setOps]=useState<Workspace>();const [mrv,setMrv]=useState<Workspace>();const [compliance,setCompliance]=useState<Workspace>();const [error,setError]=useState("");const [loading,setLoading]=useState(false);
 useEffect(()=>{if(!auth)return;return onAuthStateChanged(auth,async user=>{if(!user||!user.emailVerified){setToken("");setMe(null);return}try{const ex=await api<{sessionToken:string}>("/api/v1/auth/exchange",await user.getIdToken(true));setToken(ex.sessionToken);const identity=await api<Me>("/api/v1/auth/me",ex.sessionToken);setMe(identity);}catch{setToken("");setMe(null);}})},[]);
 const membership=useMemo(()=>{const id=orgId();return me?.memberships.find(m=>m.status==="VERIFIED"&&m.organization_id===id)??me?.memberships.find(m=>m.status==="VERIFIED");},[me]);
 const visible=!!membership&&(membership.role_name==="municipal_admin"||membership.role_name==="regulator"||membership.organization_type.toLowerCase().includes("municipal")||membership.organization_type.toLowerCase().includes("ulb"));
 async function refresh(){if(!token||!visible)return;setLoading(true);setError("");try{const [o,r,m,c]=await Promise.all([api<{counts:Counts}>("/api/v1/overview",token),api<Workspace>("/api/v1/workspaces/resource-flows",token),api<Workspace>("/api/v1/workspaces/mrv",token),api<Workspace>("/api/v1/workspaces/compliance",token)]);setCounts(o.counts??{});setOps(r);setMrv(m);setCompliance(c);}catch(e){setError(e instanceof Error?e.message:"Unable to load institutional data");}finally{setLoading(false)}}
 useEffect(()=>{if(visible)void refresh()},[visible,token,orgId()]);
 if(!visible)return null;
 const flows=arr(ops,"resourceFlows"),activities=arr(mrv,"activities"),measurements=arr(mrv,"measurements"),evidence=arr(mrv,"evidence"),verifications=arr(mrv,"verifications"),obligations=arr(compliance,"obligations");
 const verified=Number(counts.approvedVerifications??count(verifications.filter(x=>String((x as any).status??(x as any).decision??"").toUpperCase().includes("APPROV"))));
 const open=Number(counts.openObligations??obligations.filter(x=>!String((x as any).status??"").toUpperCase().includes("CLOSED")).length);
 return <section className="ulb-command" aria-label="Institutional command center"><div className="ulb-head"><div><p className="eyebrow">INSTITUTIONAL COMMAND CENTRE</p><h2>{membership?.organization_name}</h2><p>City / local-body operating view · authoritative records only</p></div><button className="secondary" onClick={()=>void refresh()} disabled={loading}>{loading?"Refreshing…":"Refresh"}</button></div>
  <div className="ulb-metrics"><article><span>RESOURCE FLOWS</span><strong>{Number(counts.activities??flows.length)}</strong><small>Recorded operational activity</small></article><article><span>MEASUREMENTS</span><strong>{Number(counts.measurements??measurements.length)}</strong><small>Quantity records</small></article><article><span>EVIDENCE</span><strong>{Number(counts.evidence??evidence.length)}</strong><small>Evidence records</small></article><article><span>VERIFIED</span><strong>{verified}</strong><small>Approved verification</small></article><article><span>OPEN OBLIGATIONS</span><strong>{open}</strong><small>Compliance items</small></article></div>
  <div className="ulb-grid"><article><p className="eyebrow">OPERATIONS</p><h3>What is moving?</h3><p>Resource-flow records available in this organization and geography scope.</p><div className="ulb-stat">{flows.length}<span>records loaded</span></div></article><article><p className="eyebrow">MRV READINESS</p><h3>What is proven?</h3><div className="ulb-checks"><span>Activities <b>{activities.length}</b></span><span>Measurements <b>{measurements.length}</b></span><span>Evidence <b>{evidence.length}</b></span><span>Approved verification <b>{verified}</b></span></div></article><article><p className="eyebrow">COMPLIANCE</p><h3>What needs attention?</h3><div className="ulb-stat">{open}<span>open obligations</span></div><p className="ulb-note">No obligation is treated as satisfied unless an authoritative record says so.</p></article></div>
  <div className="ulb-boundary"><div><p className="eyebrow">GOVERNANCE BOUNDARY</p><strong>Operational visibility ≠ regulatory issuance.</strong><p>RupayKg can show activity, evidence, verification and compliance state. Credential issuance, external registry consensus, government acceptance and settlement remain separate authoritative stages.</p></div><div className="ulb-source">Source: PostgreSQL<br/>Synthetic data: {ops?.syntheticData===true?"true":"false"}</div></div>{error&&<p className="error">{error}</p>}</section>;
}

createRootSafe();
function createRootSafe(){const root=document.getElementById("ulb-command-center");if(!root)return;import("react-dom/client").then(({createRoot})=>createRoot(root).render(<ULBCommandCenter/>));}
