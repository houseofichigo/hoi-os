import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, realpathSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { fixture } from './helpers.mjs';
import { routeHarness } from '../dist/core/harness-routing.js';
import { skillDetail, controlSkill } from '../dist/core/skill-library.js';
const root=resolve('.');
const catalog=JSON.parse(readFileSync(join(root,'expertise/catalog.json')));
const tasks=catalog.packs.flatMap(p=>p.tasks);
const hash=b=>createHash('sha256').update(b).digest('hex');
function scratch(t){const p=realpathSync(mkdtempSync(join(tmpdir(),'hoi-expertise-')));t.after(()=>rmSync(p,{recursive:true,force:true}));return p;}
function run(file,args){const r=spawnSync(process.execPath,[file,...args],{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);return r;}

test('all 36 expertise routes resolve exact revisions in English and French without execution',t=>{
  const {s}=fixture(t);
  for(const task of tasks){
    for(const message of task.phrases.slice(0,2)){
      const result=routeHarness(s,{message,inputs:Object.fromEntries(task.requiredInputs.map(f=>[f,'Fictional supplied '+f]))},'local');
      assert.equal(result.state,'ready',task.skillId+' '+message+' '+JSON.stringify(result));
      assert.equal(result.executed,false);
      assert.equal(result.stages.length,1);
      assert.equal(result.stages[0].skillId,task.skillId);
      assert.ok(result.stages[0].checksum);
    }
    const missing=routeHarness(s,{message:task.phrases[0]},'local');
    assert.equal(missing.state,'clarification');assert.deepEqual(missing.fields,task.requiredInputs);
  }
  assert.equal(s.one('SELECT count(*) n FROM executions').n,0);
});
test('ambiguous, explicit, disabled and governance routes retain their boundaries',t=>{
  const {s}=fixture(t),a=tasks[0],b=tasks[1];
  assert.equal(routeHarness(s,{message:a.phrases[0]+' and '+b.phrases[0]},'local').state,'clarification');
  const explicit=routeHarness(s,{message:a.phrases[0],skillId:b.skillId,inputs:Object.fromEntries(b.requiredInputs.map(f=>[f,'Supplied fictional value']))},'local');
  assert.equal(explicit.stages[0].skillId,b.skillId);
  assert.equal(routeHarness(s,{message:'Approve '+a.phrases[0]},'local').state,'clarification');
  const detail=skillDetail(s,a.skillId,'local');
  controlSkill(s,{name:a.skillId,action:'disable',expectedVersion:detail.version},'local');
  assert.equal(routeHarness(s,{message:a.phrases[0]},'local').state,'unavailable');
});
test('15 deterministic self-contained plugin archives agree with authoritative skills',async t=>{
  const temp=scratch(t),one=join(temp,'one'),two=join(temp,'two');
  run('scripts/package-expertise.mjs',['--output',one]); run('scripts/package-expertise.mjs',['--output',two]);
  const manifest=JSON.parse(readFileSync(join(one,'MANIFEST.json')));
  assert.equal(manifest.plugins.length,15);
  assert.equal(new Set(manifest.plugins.flatMap(p=>p.skills)).size,45);
  assert.deepEqual(readFileSync(join(one,'MANIFEST.json')),readFileSync(join(two,'MANIFEST.json')));
  for(const pack of manifest.plugins){
    const bytes=readFileSync(join(one,pack.file)); assert.equal(hash(bytes),pack.sha256);
    const zip=await JSZip.loadAsync(bytes),meta=JSON.parse(await zip.file('plugin.json').async('string'));
    assert.ok(meta.extensions['com.openai'].interface.shortDescription.length<=30);
    assert.equal(meta.version,'0.1.0');assert.ok(!meta.mcpServers&&!meta.apps&&!meta.skills);
    for(const f of pack.files){
      const content=await zip.file(f.path).async('nodebuffer');assert.equal(hash(content),f.sha256);
      if(f.path.startsWith('skills/')) assert.deepEqual(content,readFileSync(join(root,f.path)));
      assert.ok(!/\.env|\.secrets|__pycache__|\.pyc$/.test(f.path));
    }
  }
  const rerun=spawnSync(process.execPath,['scripts/package-expertise.mjs','--output',one],{encoding:'utf8'});
  assert.notEqual(rerun.status,0);
});
test('private profiles preserve attribution, invalidate review on edits and reject cross-client reuse',t=>{
  const temp=scratch(t),script=join(root,'skills/hoi-expertise-customize/scripts/profile.py');
  const python=(args,ok=true)=>{const r=spawnSync('python3',[script,...args],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},encoding:'utf8'}); if(ok)assert.equal(r.status,0,r.stderr);else assert.notEqual(r.status,0);return r;};
  const selection={workspaceId:'fictional-workspace',clientId:'fictional-studio',packs:{'marketing-brand':{audiences:{state:'confirmed',value:'Independent fictional retailers',evidence:[{recordId:'statement_owner_1',revision:'1',locator:'Attributed interview answer, 2026-01-01'}]}}}};
  const input=join(temp,'selection.json'),draft=join(temp,'draft.json'),reviewed=join(temp,'reviewed.json');
  writeFileSync(input,JSON.stringify(selection));
  python(['preview',input,'--output',draft]);
  const validated=JSON.parse(python(['validate',draft]).stdout);assert.equal(validated.gaps.length,4);
  python(['review',draft,'--reviewer','Fictional owner','--expected-digest','wrong','--output',reviewed],false);
  python(['review',draft,'--reviewer','Fictional owner','--expected-digest',validated.digest,'--output',reviewed]);
  python(['validate',reviewed]);
  const changed=JSON.parse(readFileSync(reviewed));changed.packs['marketing-brand'].audiences.value='Changed after review';
  writeFileSync(join(temp,'changed.json'),JSON.stringify(changed));python(['validate',join(temp,'changed.json')],false);
  selection.clientId='another-client';writeFileSync(input,JSON.stringify(selection));
  python(['preview',input,'--previous',reviewed,'--output',join(temp,'v2.json')],false);
  selection.clientId='fictional-studio';selection.packs['marketing-brand'].permissions={state:'confirmed',value:'all',evidence:[]};writeFileSync(input,JSON.stringify(selection));
  python(['preview',input,'--output',join(temp,'unsafe.json')],false);
  delete selection.packs['marketing-brand'].permissions;writeFileSync(input,JSON.stringify(selection));
  python(['preview',input,'--output',draft],false);
  mkdirSync(join(temp,'repo'));mkdirSync(join(temp,'repo/.git'));
  python(['preview',input,'--output',join(temp,'repo/private-profile.json')],false);
  assert.equal(existsSync(join(temp,'repo/private-profile.json')),false);
  python(['preview',input,'--previous',reviewed,'--output',join(temp,'v2.json')]);
  assert.equal(JSON.parse(readFileSync(join(temp,'v2.json'))).version,2);
});
test('variance arithmetic is deterministic and refuses invalid or mixed-unit rows',t=>{
  const temp=scratch(t),input=join(temp,'numbers.json'),script=join(root,'skills/hoi-finance-variance/scripts/variance.py');
  const value={currency:'EUR',period:'Fictional January',rows:[{id:'revenue',budget:'100.00',actual:'110.10'},{id:'new',budget:'0',actual:'7'}]};
  writeFileSync(input,JSON.stringify(value));
  let r=spawnSync('python3',[script,input],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  const rows=JSON.parse(r.stdout).rows;assert.equal(rows[0].difference,'10.10');assert.equal(rows[0].percentOfAbsoluteBudget,'10.10');assert.equal(rows[1].percentOfAbsoluteBudget,null);
  value.rows[0].currency='USD';writeFileSync(input,JSON.stringify(value));
  r=spawnSync('python3',[script,input],{encoding:'utf8'});assert.notEqual(r.status,0);
});
