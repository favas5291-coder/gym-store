import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = directory => fs.existsSync(directory) ? fs.readdirSync(directory,{withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(directory,e.name)) : [path.join(directory,e.name)]) : [];
let problems = 0;
const [major,minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) { console.error('ERROR: Use Node.js 22.12+ or a newer supported release. Current: '+process.version); problems++; }
else console.log('OK: Node '+process.version);
const sources = walk(path.join(root,'src')).filter(file => /\.(jsx?|css)$/.test(file));
const missing = [];
for (const file of sources) {
 const content = fs.readFileSync(file,'utf8');
 const imports = [...content.matchAll(/(?:from\s*|import\s*\(?\s*|@import\s*)["'](\.[^"']+)["']/g)];
 for (const [,specifier] of imports) {
  if (specifier.includes('*')) continue;
  const target = path.resolve(path.dirname(file),specifier.split('?')[0]);
  if (![target,...['.js','.jsx','.css','/index.js','/index.jsx'].map(ext=>target+ext)].some(p=>fs.existsSync(p))) missing.push(path.relative(root,file)+' -> '+specifier);
 }
}
if (missing.length) { console.error('ERROR: Missing imported files:\n'+missing.join('\n')); problems += missing.length; }
else console.log('OK: All '+sources.length+' source files have resolvable local imports.');
if (!fs.existsSync(path.join(root,'node_modules/vite/package.json'))) { console.error('ERROR: Dependencies are not installed. Run npm ci in this folder.'); problems++; }
else console.log('OK: Vite is installed.');
const filenames = new Set(walk(path.join(root,'src/assets')).map(p=>path.basename(p).toLowerCase().replace(/\s+/g,'')));
const expected = ['tshirt.jpg','tshirt2.jpg','tshirt3.jpg','shoes.jpg','shoes2.jpg','shoes3.jpg','shaker.jpg','Towel.jpg','towel2.jpg','towel3.jpg','Socks .jpg','socks2.jpg','socks3.jpg','bottle.jpg','bottle2.jpg','bottle3.jpg'];
const absent = expected.filter(name=>!filenames.has(name.toLowerCase().replace(/\s+/g,'')));
if(absent.length) console.warn('PHOTOS: Copy these original photos to src/assets. Until then, labelled illustrations appear:\n'+absent.join(', '));
else console.log('OK: All catalogue photos are present.');
console.log('Mode: browser-local storefront preview. Payments, courier tracking and shared server accounts are not connected.');
process.exitCode = problems ? 1 : 0;