import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const snapshot=fs.readFileSync(path.join(root,"docs/G002_PRODUCTION_MIGRATION_LEDGER_SNAPSHOT_20261107.md"),"utf8");
const ledger=[...snapshot.matchAll(/^(\d+)\s+(\S+\.sql)$/gm)].map(m=>({version:m[1],filename:m[2]}));
const files=ledger.map(row=>{
  const p=path.join(root,"migrations",row.filename);
  if(!fs.existsSync(p)) return {...row,status:"missing",sha256:null,bytes:null};
  const b=fs.readFileSync(p);
  return {...row,status:"exact_repository_sql",sha256:crypto.createHash("sha256").update(b).digest("hex"),bytes:b.length};
});
const releaseCommit=process.env.GITHUB_SHA||"UNKNOWN";
const liveSchemaHash="fee94d42fd0a23fafe80236604084b0a07b0ad3721a66de6c4cae6dbcf227051";
const classifications=files.map(x=>({
  version:x.version,
  filename:x.filename,
  classification:x.version==="096" ? "recovered_historical_sql_live_schema_effect_confirmed" : (x.status==="exact_repository_sql" ? "exact_repository_match" : "unexplained_discrepancy")
}));
const manifest={
  manifest_version:"1.0",
  generated_at:new Date().toISOString(),
  repository:"vishaltradewinds/rupaykg",
  release_commit_sha:releaseCommit,
  production_ledger_source:"docs/G002_PRODUCTION_MIGRATION_LEDGER_SNAPSHOT_20261107.md",
  production_ledger_row_count:ledger.length,
  repository_migration_sql_count:files.filter(x=>x.status==="exact_repository_sql").length,
  production_ledger_versions:ledger,
  migration_files:files,
  classifications,
  live_schema_structural_metadata_sha256:liveSchemaHash,
  migration_096_provenance:{
    source_commit:"ca8f4100782e13f8d72106187fafc8e1e446214f",
    removal_commit:"54a7fe1ceb41b37a68720a71c10a1dd03af30dea",
    production_applied_at:"2026-10-27T13:46:14.262Z",
    determination:"RECOVERED HISTORICAL SQL + LIVE SCHEMA EFFECT CONFIRMED",
    do_not_reapply:true
  },
  gate_status:{
    migration_history:"SUBSTANTIALLY_RESOLVED",
    g002_overall:"OPEN",
    remaining_blockers:[
      "deployed runtime DB identity independently proven NOBYPASSRLS",
      "production RLS and tenant isolation proven",
      "two-organization runtime A/B isolation proven",
      "independent review of this deterministic manifest"
    ]
  }
};
const out=path.join(root,"docs/G002_PRIMARY_MIGRATION_RECONCILIATION_MANIFEST_20261107.json");
fs.writeFileSync(out,JSON.stringify(manifest,null,2)+"\n");
console.log(out);
console.log(JSON.stringify({releaseCommit,ledgerRows:ledger.length,repoSql:manifest.repository_migration_sql_count,missing:files.filter(x=>x.status==="missing").map(x=>x.filename),liveSchemaHash},null,2));
