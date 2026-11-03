import { readProductionConfig } from "./production-config.js";

// Validate the production contract before the container is allowed to run
// migration SQL or the optional acceptance seeder.
readProductionConfig();
console.log("Production startup preflight passed.");
