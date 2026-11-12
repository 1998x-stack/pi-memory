/**
 * Concurrent indexer worker for test-only multi-process SQLite CAS stress.
 */
import { existsSync } from "node:fs";
import { openMemoryStore } from "../src/store/sqlite-store.mjs";
import { ingestPiSessionWithRetry } from "../src/transcripts/pi-indexer.mjs";
const [db,source,root,flag]=process.argv.slice(2);
if(!db||!source||!root||!flag)process.exit(2);
const deadline=Date.now()+10000;
while(!existsSync(flag)){
  if(Date.now()>deadline)throw new Error("Timed out waiting for start barrier");
  await new Promise(r=>setTimeout(r,10));
}
const scope={ownerId:"stress-owner",projectId:"stress-project",sourceNamespace:"stress-install"};
const store=openMemoryStore(db);
try{
  const r=await ingestPiSessionWithRetry(store,source,{
    ...scope,allowedSessionRoot:root,captureApproved:true
  },{attempts:8});
  process.stdout.write(JSON.stringify({mode:r.mode,processed:r.processed})+"\n");
}finally{store.close();}
