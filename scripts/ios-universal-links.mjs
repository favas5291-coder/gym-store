import { mkdir, writeFile } from "node:fs/promises";

const team = process.env.IOS_APPLE_TEAM_ID;
if (!/^[A-Z0-9]{10}$/.test(team || "")) throw new Error("Set the actual 10-character IOS_APPLE_TEAM_ID. No placeholder association will be generated.");
const directory = "test-results/ios/release";
await mkdir(directory, { recursive: true });
const document = { applinks: { details: [{ appIDs: [`${team}.com.gymdrobe.app`], components: [
  { "/": "/product/*" }, { "/": "/shop" }, { "/": "/kits/*" }, { "/": "/orders/*" },
] }] } };
await writeFile(`${directory}/apple-app-site-association`, JSON.stringify(document, null, 2));
console.log(`Prepared ${directory}/apple-app-site-association. Serve as application/json over HTTPS without redirects at /.well-known/apple-app-site-association on both GymDrobe domains before device testing.`);
