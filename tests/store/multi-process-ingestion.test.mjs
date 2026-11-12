import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp,mkdir,copyFile,writeFile,appendFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openMemoryStore } from "../../src/store/sqlite-store.mjs";
const fixture=fileURLToPath(new URL("../fixtures/pi-v3/branched-compacted.jsonl",import.meta.url));
const worker=fileURLToPath(new URL("../../scripts/index-concurrency-worker.mjs",import.meta.url));
const scope={ownerId:"stress-owner",projectId:"stress-project"};
function launch(db,source,root,barrier){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[worker,db,source,root,barrier],{
      stdio:["ignore","pipe","pipe"]
    });
    let stdout="",stderr="";
    const timeout=setTimeout(()=>{child.kill("SIGKILL");reject(new Error("worker timeout "+stderr));},20000);
    child.stdout.on("data",c=>stdout+=c.toString("utf8"));
    child.stderr.on("data",c=>stderr+=c.toString("utf8"));
    child.on("error",e=>{clearTimeout(timeout);reject(e);});
    child.on("close",code=>{
      clearTimeout(timeout);
      if(code!==0)reject(new Error("concurrent worker failed: "+stderr.slice(-1000)));
      else {
        try{resolve(JSON.parse(stdout.trim()));}
        catch(e){reject(e);}
      }
    });
  });
}

test("Five Pi processes ingest the same v3 source without checkpoint loss/duplicate FTS",{
  skip:process.platform==="win32"?"Cross-process timing matrix currently Linux CI only":false
},async()=>{
  const root=await mkdtemp(join(tmpdir(),"pi-memory-race-"));
  const sessionDir=join(root,"sessions");await mkdir(sessionDir);
  const source=join(sessionDir,"source.jsonl");
  await copyFile(fixture,source);
  const db=join(root,"shared.sqlite");
  const setup=openMemoryStore(db);setup.close();
  try{
    for(let round=0;round<2;round++){
      if(round){
        await appendFile(source,JSON.stringify({
          type:"message",id:"u-next",parentId:"tl12",timestamp:"2026-11-12T03:50:00Z",
          message:{role:"user",content:"New concurrent checkpoint; no duplicated rows"}
        })+"\n");
      }
      const barrier=join(root,"barrier"+round);
      const workers=Array.from({length:5},()=>launch(db,source,sessionDir,barrier));
      await writeFile(barrier,"go");
      const outputs=await Promise.all(workers);
      assert.equal(outputs.length,5);
      const store=openMemoryStore(db);
      try {
        assert.equal(store.countEvents(scope),round?14:13);
        assert.equal(store.search("All 14 tests passed",scope).length,1);
        assert.equal(store.verifyIndex(),true);
        assert.equal(store.database.prepare("PRAGMA foreign_key_check").all().length,0);
      }finally{store.close();}
    }
  }finally{await rm(root,{recursive:true,force:true});}
});
