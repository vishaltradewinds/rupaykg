import fs from "node:fs";

function replaceOnce(path, oldText, newText) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(oldText)) throw new Error(`Expected auth gate not found in ${path}`);
  fs.writeFileSync(path, source.replace(oldText, newText));
}

replaceOnce(
  "apps/src/auth-routes.ts",
  'if (!claims.email || claims.email_verified !== true) return reply.code(403).send({ error: "Verified email is required before RupayKG access", code: "EMAIL_VERIFICATION_REQUIRED" });',
  'if (!claims.email) return reply.code(403).send({ error: "A Firebase account email is required", code: "EMAIL_REQUIRED" });'
);

replaceOnce(
  "apps/src/auth-routes.ts",
  'emailVerified: true',
  'emailVerified: claims.email_verified === true'
);

replaceOnce(
  "apps/web/src/main.tsx",
  'if(mode==="register"){if(name.trim())await updateProfile(c.user,{displayName:name.trim()});await sendEmailVerification(c.user);await signOut(firebaseAuth);setMode("signin");setMessage("Account created. Verify your email before signing in.");return}if(!c.user.emailVerified){await signOut(firebaseAuth);setError("Verify your email address before accessing RupayKG.");return}',
  'if(mode==="register"){if(name.trim())await updateProfile(c.user,{displayName:name.trim()});await sendEmailVerification(c.user).catch(()=>undefined);}'
);

console.log("Production auth bootstrap applied: email verification is optional; Firebase authentication and server-side organization/role authorization remain required.");
