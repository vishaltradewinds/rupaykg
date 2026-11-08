#!/usr/bin/env node
import fs from "node:fs";
const source=fs.readFileSync("apps/src/registry-routes.ts","utf8");
const failures=[];
if(!/order by created_at desc,id desc limit 1/.test(source)) failures.push("authoritative registry-owner/event lookups must use deterministic created_at,id ordering");
if(!/select coalesce\(to_owner_id,from_owner_id\) owner_id from registry_events/.test(source)) failures.push("retirement owner lookup must derive from registry event history");
if(!/select id,from_owner_id,to_owner_id,event_type from registry_events/.test(source)) failures.push("settlement creation must derive current registry state from registry events");
if(/order by created_at desc limit 1/.test(source)) failures.push("registry event latest-state queries must not rely on timestamp alone");
if(failures.length){console.error("Shakti registry deterministic event ordering contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));process.exit(1)}
console.log("Shakti registry deterministic event ordering contract PASSED: latest registry state resolution is deterministic under timestamp ties.");
