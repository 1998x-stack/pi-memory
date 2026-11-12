/**
 * Real Pi cross-session recall smoke, without model API calls.
 * Synthetic Session → /pi-memory index → new_session → /pi-memory search.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { openMemoryStore } from "../src/store/sqlite-store.mjs";
import { openNoteRepository } from "../src/notes/notes.mjs";
import { openL4Controller } from "../src/injection/l4-index.mjs";

const cwd=resolve(import.meta.dirname,"..");
const temp=await mkdtemp(join(tmpdir(),"pi-memory-recall-"));
const agentDir=join(temp,"agent");
const sessionDir=join(temp,"sessions");
const source=join(sessionDir,"synthetic.jsonl");
const needle="PI_MEMORY_REAL_RPC_RECALL_2048";
const d=s=>createHash("sha256").update(s).digest("hex");
let child;
let childClosed=Promise.resolve();
try {
  await mkdir(agentDir,{recursive:true});
  await mkdir(sessionDir,{recursive:true});
  await writeFile(join(agentDir,"settings.json"),JSON.stringify({defaultProjectTrust:"always"}));
  const header={type:"session",version:3,id:"rpc-p1-recall",cwd,timestamp:"2026-11-12T00:00:00Z"};
  const user={type:"message",id:"u1",parentId:null,timestamp:"2026-11-12T00:00:01Z",message:{role:"user",content:"Find " + needle,timestamp:1794441601000}};
  const tool={type:"message",id:"t2",parentId:"u1",timestamp:"2026-11-12T00:00:02Z",message:{role:"toolResult",toolCallId:"fake1",toolName:"bash",isError:false,content:[{type:"text",text:"Diagnostic " + needle}],timestamp:1794441602000}};
  await writeFile(source,[header,user,tool].map(JSON.stringify).join("\n")+"\n");

  child=spawn("pi",["--mode","rpc","--session",source,"-ne","-e",cwd],{
    cwd,env:{...process.env,PI_CODING_AGENT_DIR:agentDir,CI:"true",NO_COLOR:"1"},
    stdio:["pipe","pipe","pipe"]
  });
  childClosed=new Promise(resolveClose=>child.once("close",resolveClose));
  let buffer="",stderr="";
  const pending=new Map();
  const notifications=[];
  let protocolError=null;
  function failAll(error) {
    protocolError=error;
    for(const entry of pending.values()) {clearTimeout(entry.timer);entry.reject(error);}
    pending.clear();
  }
  child.on("error",failAll);
  child.on("exit",code=>{if(pending.size)failAll(new Error("Pi RPC exited before command: "+code+" "+stderr.slice(-1000)));});
  child.stderr.on("data",c=>{stderr=(stderr+c.toString("utf8")).slice(-5000);});
  child.stdout.on("data",c=>{
    buffer+=c.toString("utf8");
    while(buffer.includes("\n")){
      const at=buffer.indexOf("\n");
      const line=buffer.slice(0,at).trim();
      buffer=buffer.slice(at+1);
      if(!line)continue;
      let record;
      try{record=JSON.parse(line);}
      catch{failAll(new Error("Non-JSON Pi RPC stdout: "+line.slice(0,100)));return;}
      if(record.type==="extension_ui_request" && record.method==="notify") notifications.push(record.message);
      if(record.type==="response" && pending.has(record.id)){
        const p=pending.get(record.id);pending.delete(record.id);
        clearTimeout(p.timer);
        if(record.success)p.resolve(record.data);
        else p.reject(new Error("Pi RPC "+record.command+" error: "+JSON.stringify(record)));
      }
    }
  });
  let n=0;
  function request(type,props={}) {
    if(protocolError) return Promise.reject(protocolError);
    const id="rpc-"+(++n);
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error("RPC timeout "+type+" "+stderr.slice(-1000)))},30000);
      pending.set(id,{resolve,reject,timer});
      child.stdin.write(JSON.stringify({id,type,...props})+"\n");
    });
  }
  const commands=await request("get_commands");
  assert.ok(commands.commands.some(c=>c.name==="pi-memory"));
  const initial=await request("get_state");
  assert.ok(initial.sessionFile, "Pi should be reading the synthetic persisted session");
  const indexed=await request("prompt",{message:"/pi-memory index"});
  assert.equal(indexed.disposition,"handled","command must not invoke an LLM");
  assert.ok(notifications.some(n=>n.includes("index completed")), "manual index command must confirm success: "+JSON.stringify(notifications));
  await request("new_session");
  const recalled=await request("prompt",{message:"/pi-memory search "+needle});
  assert.equal(recalled.disposition,"handled");
  assert.ok(notifications.some(n=>n.includes("t2") && n.includes(needle)), "new session must retrieve old tool evidence: "+JSON.stringify(notifications));
  // Authoritative DB check after the Pi command completed.
  const store=openMemoryStore(join(agentDir,"memory","pi-memory.sqlite"));
  try{
    const scope={ownerId:d("user:"+homedir()),projectId:d("project:"+cwd)};
    const hits=store.search(needle,scope);
    assert.ok(hits.some(h=>h.entryId==="t2"));

    assert.ok(store.countEvents(scope) >= 2, "Pi may persist additional session metadata during command processing");
    // Notes are not created or approved by the model: every transition is a user command.
    const created=await request("prompt",{message:
      "/pi-memory note add fact rpc-p1-recall#t2 | "+needle+" | Manual Pi evidence from a prior session"});
    assert.equal(created.disposition,"handled");
    const notes=openNoteRepository(store);
    const candidates=notes.list({...scope,sourceNamespace:d("pi-agent-dir:"+agentDir)});
    assert.equal(candidates.length,1);
    assert.equal(candidates[0].status,"candidate");
    const id=candidates[0].id;
    const approved=await request("prompt",{message:"/pi-memory note approve "+id});
    assert.equal(approved.disposition,"handled");
    assert.equal(notes.get(id,scope).status,"verified");
    const opened=await request("prompt",{message:"/pi-memory search "+id});
    assert.equal(opened.disposition,"handled");
    assert.ok(notifications.some(n=>n.includes("Approved Note "+id) && n.includes("rpc-p1-recall#t2")),
      "L4 pointer should resolve to lower-trust Note details with provenance");
    await request("prompt",{message:"/pi-memory l4 on"});
    const l4=openL4Controller(store);
    const index=l4.render(scope);
    assert.equal(index.count,1);
    assert.ok(index.text.includes(id));
    assert.ok(!index.text.includes(needle),"L4 must never contain raw user Note title");
    await request("prompt",{message:"/pi-memory l4 preview"});
    assert.ok(notifications.some(n=>n.includes(id) && n.includes("metadata only")));
    await request("prompt",{message:"/pi-memory note export "+id});
    const expectedMarkdown=join(agentDir,"memory","notes",id+".md");
    assert.ok((await readFile(expectedMarkdown,"utf8")).includes(id));
    const revoke=await request("prompt",{message:"/pi-memory note revoke "+id});
    assert.equal(revoke.disposition,"handled");
    assert.equal(notes.get(id,scope).status,"revoked");
    assert.equal(l4.render(scope).count,0,"revoked Note must disappear from L4 immediately");
    await request("prompt",{message:"/pi-memory search "+id});
    assert.ok(notifications.at(-1).includes("No matching indexed evidence"),
      "Revoked note must not resolve from a copied L4 pointer");
  }finally{store.close();}
  process.stdout.write("PASS real Pi RPC cross-session FTS memory recall, no model call\n");
}finally{
  if(child){
    child.stdin.end();
    if(!child.killed)child.kill("SIGTERM");
    await Promise.race([childClosed,new Promise(resolveWait=>setTimeout(resolveWait,5000))]);
  }
  await rm(temp,{recursive:true,force:true});
}
