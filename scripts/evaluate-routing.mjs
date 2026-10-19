import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {initialize,Store} from '../dist/core/store.js';import {routeHarness} from '../dist/core/harness-routing.js';
const corpus=JSON.parse(readFileSync('examples/routing/cases.json','utf8')),root=mkdtempSync(join(tmpdir(),'hoi-route-eval-')),workspace=join(root,'Fictional workspace');initialize(workspace);const s=new Store(workspace);
try{
 const cases=corpus.cases.map(c=>{const r=routeHarness(s,c.input,'local');const skill=r.stages?.[0]?.skillId??null;return {id:c.id,family:c.family,split:c.split,language:c.language,expectedSkill:c.expectedSkill,actualSkill:skill,expectedState:c.expectedState,actualState:r.state,passed:skill===c.expectedSkill&&r.state===c.expectedState};});
 const groups={};for(const c of cases){const key=c.split+'/'+c.language+'/'+(c.expectedSkill??c.expectedState);groups[key]??={passed:0,total:0};groups[key].total++;if(c.passed)groups[key].passed++;}
 const report={version:1,at:new Date().toISOString(),labelStatus:corpus.labelStatus,scope:'Deterministic plan selection only; no model calls, human answer-quality certification or live scheduler execution.',cases:cases.length,passed:cases.filter(c=>c.passed).length,groups,failures:cases.filter(c=>!c.passed),humanAcceptance:'pending'};
 const output=process.argv[2];if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 if(report.failures.length)process.exitCode=1;
}finally{s.close();rmSync(root,{recursive:true,force:true});}
