import {type Store} from './store.js';
import {type Host} from './schema.js';
import {now,sha} from './files.js';
import {enabled,knowledgeFingerprint,localModelPresent,rebuildKnowledge,MODEL_FINGERPRINT} from './semantic.js';

// Called inside the existing engine queue. No additional database owner or scheduler service.
export async function maintainKnowledgeIndex(s:Store,h:Host) {
  if(s.schemaVersion<19||h!=='local'||!enabled(s)||s.policy().actions.draft!=='allow')return;
  const previous=JSON.parse(s.one("SELECT payload FROM knowledge_retrieval_config WHERE id='maintenance'")?.payload??'{}');
  const record=(value:any)=>{
    const state={...value,updatedAt:now()};
    s.exec("INSERT OR REPLACE INTO knowledge_retrieval_config VALUES('maintenance',?)",JSON.stringify(state));
    return state;
  };
  if(!localModelPresent(s))return record({state:'waiting',reason:'MODEL_INSTALL_REQUIRED'});
  const fingerprint=knowledgeFingerprint(s,h);
  const active=s.one("SELECT id FROM knowledge_index_generations WHERE state='active' AND model_fingerprint=?",MODEL_FINGERPRINT);
  if(active) {
    const complete=s.all("SELECT result FROM intake_jobs WHERE state='completed'").some(j=>{
      try{const r=JSON.parse(j.result);return r.generation===active.id&&r.fingerprint===fingerprint;}catch{return false;}
    });
    if(complete)return record({state:'current'});
  }
  const requestKey='automatic-index-'+sha(fingerprint+'\0'+(active?.id??'none'));
  const same=previous.requestKey===requestKey;
  const job=s.one("SELECT state FROM intake_jobs WHERE id=?",'index_'+sha(requestKey));
  if(job?.state==='cancelled')return record({state:'paused',reason:'CANCELLED_USE_MANUAL_REBUILD',requestKey});
  if(same&&previous.attempts>=3)return previous;
  if(same&&previous.nextAttemptAt&&Date.parse(previous.nextAttemptAt)>Date.now())return previous;
  const attempts=(same?previous.attempts??0:0)+1;
  record({state:'processing',requestKey,attempts});
  try {
    await rebuildKnowledge(s,h,{requestKey});
    return record({state:'current',requestKey,attempts});
  } catch {
    const cancelled=s.one("SELECT state FROM intake_jobs WHERE id=?",'index_'+sha(requestKey))?.state==='cancelled';
    return record({state:cancelled||attempts>=3?'paused':'retrying',reason:cancelled?'CANCELLED_USE_MANUAL_REBUILD':'LOCAL_INDEX_UNAVAILABLE',requestKey,attempts,nextAttemptAt:new Date(Date.now()+Math.min(300000,30000*2**attempts)).toISOString()});
  }
}
export function startIndexMaintenance(s:Store,h:Host,enqueue:<T>(fn:()=>Promise<T>)=>Promise<T>) {
  let stopped=false,pending=false;
  const tick=()=>{
    if(stopped||pending)return;
    pending=true;
    void enqueue(async()=>{if(!stopped)await maintainKnowledgeIndex(s,h);}).catch(()=>{}).finally(()=>{pending=false;});
  };
  const timer=setInterval(tick,30000);timer.unref();tick();
  return ()=>{stopped=true;clearInterval(timer);};
}
