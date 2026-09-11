const required = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];

const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(`Missing required web build configuration: ${missing.join(", ")}`);
  console.error("Provide the public Firebase web configuration through the controlled build environment.");
  process.exit(1);
}

console.log(`Validated required Firebase web configuration: ${required.join(", ")}`);
