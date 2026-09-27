import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTryOnCatalog, createTryOnServer } from './tryon-server.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try{process.loadEnvFile(path.join(root,'.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(process.env.NODE_ENV==='production')throw new Error('This launcher is for local setup. Mount createTryOnServer with your server-side authorize function before public deployment; see TRY-ON-SETUP.md.');
const config=JSON.parse(await fs.readFile(path.join(root,'config/tryon-products.json'),'utf8'));
const catalog=await loadTryOnCatalog(root,config);
const port=Number(process.env.TRYON_PORT || 3001);
const origins=(process.env.TRYON_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s=>s.trim());
const server=createTryOnServer({root,catalog,apiKey:process.env.FASHN_API_KEY || '',model:process.env.TRYON_MODEL || 'tryon-max',allowedOrigins:origins});
server.listen(port,'127.0.0.1',()=>console.log(`GymDrobe fitting room: http://127.0.0.1:${port}\nProvider ${process.env.FASHN_API_KEY?'configured':'not configured'}; ${catalog.approved.size} approved colour photos. See TRY-ON-SETUP.md.`));