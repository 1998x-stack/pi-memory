import test from "node:test";
import assert from "node:assert/strict";
import { analyzeL4Usage, summarizeL4Usage } from "../../src/evals/l4-usage.mjs";

function patch(id,parentId,value){
 return {type:"message",id,parentId,timestamp:"2026-11-12T00:00:00Z",message:{
  role:"system",content:"",sections:{"pi-memory":value}
 }};
}
function assistant(id,parentId,usage){
 return {type:"message",id,parentId,timestamp:"2026-11-12T00:00:00Z",message:{
  role:"assistant",provider:"synthetic",model:"synthetic",usage,content:[{type:"text",text:"do not export"}]
 }};
}

test("L4 offline usage report distinguishes off / newly changed / stable prompt-cache cohorts",()=>{
 const s=[
  assistant("a0",null,{input:100,output:10,cacheRead:0,cacheWrite:0,totalTokens:110,cost:{total:0.01}}),
  patch("s1","a0","<pi-memory>\nmem_approved one\n</pi-memory>"),
  assistant("a2","s1",{input:110,output:10,cacheRead:0,cacheWrite:80,totalTokens:200,cost:{total:0.02}}),
  assistant("a3","a2",{input:100,output:8,cacheRead:75,cacheWrite:0,totalTokens:183,cost:{total:0.01}}),
  patch("s4","a3","<pi-memory>\nmem_approved two\n</pi-memory>"),
  assistant("a5","s4",{input:120,output:10,cacheRead:0,cacheWrite:90,totalTokens:220,cost:{total:0.03}}),
  patch("s6","a5",null),
  assistant("a7","s6",{input:90,output:9,cacheRead:0,cacheWrite:0,totalTokens:99,cost:{total:0.009}})
 ];
 const r=analyzeL4Usage(s);
 assert.equal(r.groups.off.requests,2);
 assert.equal(r.groups.onChanged.requests,2);
 assert.equal(r.groups.onStable.requests,1);
 assert.equal(r.groups.onStable.cacheRead,75);
 assert.equal(r.groups.onChanged.cacheWrite,170);
 assert.equal(r.diagnostics.systemPatches,3);
 const sum=summarizeL4Usage([r,r]);
 assert.equal(sum.off.requests,4);
 assert.equal(sum.onStable.cacheRead,150);
 assert.ok(!JSON.stringify(sum).includes("do not export"));
});
