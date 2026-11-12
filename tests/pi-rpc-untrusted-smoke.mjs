/**
 * No-model Pi RPC trust-negative proof: a globally/CLI loaded Extension cannot
 * create or read derived memory when Pi marks the project untrusted.\n * Pi auto-trusts projects with no trust-requiring resources, so the explicit\n * --no-approve override is essential for this negative test.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp,mkdir,writeFile,access,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve } from "node:path";
const root=await mkdtemp(join(tmpdir(),"pi-memory-untrusted-"));
const agentDir=join(root,"agent"),cwd=resolve(import.meta.dirname,"..");
await mkdir(agentDir);
await writeFile(join(agentDir,"settings.json"),JSON.stringify({defaultProjectTrust:"never"}));
let child;
let done=Promise.resolve();
try{
  child=spawn("pi",["--mode","rpc","--no-session","--no-approve","-ne","-e",cwd],{
    cwd,env:{...process.env,PI_CODING_AGENT_DIR:agentDir,CI:"true",NO_COLOR:"1"},
    stdio:["pipe","pipe","pipe"]
  });
  done=new Promise(resolveClose=>child.once("close",resolveClose));
  let stdout="",stderr="",next=0;
  const outstanding=new Map();
  const notices=[];
  child.stderr.on("data",x=>{stderr=(stderr+x.toString("utf8")).slice(-1500);});
  child.stdout.on("data",x=>{
    stdout+=x.toString("utf8");
    while(stdout.includes("\n")){
      const i=stdout.indexOf("\n");
      const line=stdout.slice(0,i).trim();stdout=stdout.slice(i+1);
      if(!line)continue;
      let m;try{m=JSON.parse(line);}catch{continue;}
      if(m.type==="extension_ui_request"&&m.method==="notify")notices.push(m.message);
      if(m.type==="response"&&outstanding.has(m.id)){
        const {resolve,reject,timer}=outstanding.get(m.id);
        clearTimeout(timer);outstanding.delete(m.id);
        if(m.success)resolve(m.data);
        else reject(new Error("RPC error: "+JSON.stringify(m)));
      }
    }
  });
  function send(type,rest={}){
    return new Promise((resolve,reject)=>{
      const id="r"+(++next),timer=setTimeout(()=>reject(new Error("RPC timeout: "+type+" "+stderr)),30000);
      outstanding.set(id,{resolve,reject,timer});
      child.stdin.write(JSON.stringify({id,type,...rest})+"\n");
    });
  }
  async function promptWithNotice(command,expected){
    const at=notices.length;
    const r=await send("prompt",{message:command});
    assert.equal(r.disposition,"handled");
    const until=Date.now()+3500;
    while(Date.now()<until){
      if(notices.slice(at).some(text=>text.includes(expected)))return;
      await new Promise(doneWait=>setTimeout(doneWait,20));
    }
    throw new Error("Missing expected notification after "+command+": "+JSON.stringify(notices.slice(at)));
  }
  const commands=await send("get_commands");
  assert.ok(commands.commands.some(c=>c.name==="pi-memory"));
  await promptWithNotice("/pi-memory-doctor","Project trusted: no");
  await promptWithNotice("/pi-memory index","Project not trusted");
  await promptWithNotice("/pi-memory l4 on","Project not trusted");
  await promptWithNotice("/pi-memory forget status","Project not trusted");
  await assert.rejects(access(join(agentDir,"memory","pi-memory.sqlite")),{code:"ENOENT"});
  process.stdout.write("PASS Pi RPC project trust-negative: commands loaded but memory DB not created/accessed\n");
}finally{
  if(child){child.stdin.end();if(!child.killed)child.kill("SIGTERM");await Promise.race([done,new Promise(f=>setTimeout(f,5000))]);}
  await rm(root,{force:true,recursive:true});
}
