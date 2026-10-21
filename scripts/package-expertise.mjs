import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import JSZip from 'jszip';
import { files } from './skill-packages.mjs';
import { preparePackageOutput } from './package-output.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const {values}=parseArgs({options:{output:{type:'string'}}});
if(!values.output) throw Error('Use --output with a new distribution directory');
const checked=spawnSync(process.execPath,[join(root,'scripts/sync-expertise.mjs'),'--check'],{encoding:'utf8'});
if(checked.status!==0) throw Error(checked.stdout+checked.stderr);
const out=preparePackageOutput(root,values.output);
const catalogue=JSON.parse(readFileSync(join(root,'expertise/catalog.json')));
const digest=b=>createHash('sha256').update(b).digest('hex');
const manifest={schemaVersion:1,version:catalogue.version,status:'local-candidate; no host installation or publication',plugins:[]};
for(const pack of catalogue.packs){
  const base=join(root,'plugins',pack.name), z=new JSZip(), inventory=[];
  for(const path of files(base)){
    const rel=relative(base,path).replaceAll('\\','/'), bytes=readFileSync(path);
    if(/(^|\/)(\.git|\.env|\.secrets|node_modules|__pycache__)(\/|$)|\.(pyc|pem|key)$/.test(rel)) throw Error('Unsafe package path: '+rel);
    z.file(rel,bytes,{date:new Date('2020-01-01T00:00:00Z'),createFolders:false});
    inventory.push({path:rel,sha256:digest(bytes),bytes:bytes.length});
  }
  const bytes=await z.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:9},platform:'UNIX'});
  const filename=pack.name+'-'+pack.version+'.zip';
  writeFileSync(join(out,filename),bytes,{flag:'wx'});
  manifest.plugins.push({id:pack.id,file:filename,sha256:digest(bytes),skills:pack.skills,files:inventory});
}
writeFileSync(join(out,'MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
writeFileSync(join(out,'README.md'),readFileSync(join(root,'docs/EXPERTISE_PLUGINS.md')),{flag:'wx'});
console.log(JSON.stringify({output:out,plugins:manifest.plugins.length,skillSlots:manifest.plugins.reduce((n,p)=>n+p.skills.length,0)}));
