#!/usr/bin/env node
import fs from "node:fs";
const hardening=fs.readFileSync("migrations/20261108_context_identity_liveness_hardening.sql","utf8");
const completion=fs.readFileSync("migrations/20261108_context_identity_liveness_completion.sql","utf8");
const failures=[];
for(const [fn,source] of [["app.set_platform_context",hardening],["app.set_authority_context",hardening],["app.set_identity_context",completion]]){
 const start=source.indexOf(`function ${fn}`);
 const end=source.indexOf("\n$$;",start)>=0 ? source.indexOf("\n$$;",start) : source.indexOf("\n$shakti$;",start);
 const block=source.slice(start,end);
 if(!/status = 'VERIFIED'/.test(block)||!/suspended_at is null/.test(block)) failures.push(fn+": must reject non-verified or suspended identities");
 if(!/security definer/.test(block)) failures.push(fn+": must remain SECURITY DEFINER");
 if(!/set search_path = public, app/.test(block)) failures.push(fn+": must use fixed search_path");
 if(!/set_config\('app\.identity_id'.*true\)/s.test(block)) failures.push(fn+": identity context must be transaction-local");
}
if(failures.length){console.error("Shakti context identity liveness contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));process.exit(1);}
console.log("Shakti context identity liveness contract PASSED");
