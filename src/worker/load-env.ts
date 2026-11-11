import { config } from "dotenv";

// Next.js loads .env / .env.local automatically for the web app. The worker
// and one-shot checker run under tsx, so they load the same files here.
config({ quiet: true });
config({ path: ".env.local", override: true, quiet: true });
