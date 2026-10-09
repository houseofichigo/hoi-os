import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const base=process.argv[2], moduleOf=n=>import(pathToFileURL(join(base,'dist/core/'+n+'.js')));
const {initialize,Store}=await moduleOf('store');const {ingest}=await moduleOf('intake');
const {configureSemantic,installLocalModel,rebuildKnowledge,prepareSemanticQuery}=await moduleOf('semantic');const {knowledgeSearch}=await moduleOf('retrieval');
const root=mkdtempSync(join(tmpdir(),'hoi-staged-semantic-'));initialize(join(root,'workspace'));const s=new Store(join(root,'workspace'));
try{
 const f=join(root,'fictional.md');writeFileSync(f,'La formation des dirigeants comprend un atelier pratique sur les agents IA.');await ingest(s,f,{host:'local'});
 configureSemantic(s,'local',{enabled:true,confirm:true});await installLocalModel(s,'local',{confirm:true,directory:process.argv[3]});await rebuildKnowledge(s,'local',{requestKey:'staged-native-test'});
 const query='What does the leadership training include?';await prepareSemanticQuery(s,'local',query);const r=knowledgeSearch(s,{query},'local');
 if(r.coverage.mode!=='hybrid'||r.evidence.length!==1)throw Error('STAGED_HYBRID_FAILED');
 console.log(JSON.stringify({test:'staged Electron local bilingual model',status:'passed',electron:process.versions.electron,platform:process.platform,arch:process.arch}));
}finally{configureSemantic(s,'local',{enabled:false,confirm:true});s.close();rmSync(root,{recursive:true,force:true});}
