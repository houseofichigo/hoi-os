// Fictional local graph benchmark. No model, credential or private workspace access.
import { initialize, Store } from '../dist/core/store.js';
import { entity, relationship } from '../dist/core/knowledge.js';
import { graphQuery } from '../dist/core/graph-query.js';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, cpus, platform, arch } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
const root=mkdtempSync(join(tmpdir(),'hoi-graph-benchmark-'));
let s;
try {
 initialize(root);s=new Store(root); const start=performance.now();
 s.exec('BEGIN');
 for(let i=0;i<10000;i++) entity(s,{id:`entity_bench_${i}`,name:`Fictional process ${i}`,type:'process'});
 for(let i=0;i<99;i++) relationship(s,{from:`entity_bench_${i}`,to:`entity_bench_${i+1}`,type:'CITES',basis:'manual'},'local');
 s.exec('COMMIT');const seedMs=performance.now()-start;
 graphQuery(s,'codex','path',{source:'entity_bench_0',target:'entity_bench_2',depth:2});
 const samples=[];
 for(let i=0;i<10;i++){const a=performance.now();const result=graphQuery(s,'codex','path',{source:'entity_bench_0',target:'entity_bench_2',depth:2});if(result.links.length!==2) throw Error('Wrong path');samples.push({ms:performance.now()-a,characters:JSON.stringify(result).length});}
 const sorted=samples.map(s=>s.ms).sort((a,b)=>a-b);
 const report={hardware:cpus()[0].model,platform:platform(),arch:arch(),node:process.version,entities:10000,relationships:99,samples,seedMs,p50Ms:sorted[4],p95Ms:sorted[9],peakRssBytes:process.resourceUsage().maxRSS*1024,providerCalls:0,providerTokens:null,providerCost:0,limitations:'Graph-read benchmark, not 10,000 passage retrieval or human-reviewed answer quality. Character counts are not tokenizer counts. Projection rebuilt on every read; no persistent derived graph index.'};
 if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{s?.close();rmSync(root,{recursive:true,force:true});}
