/**
 * Offline, no-network evaluation of native Pi Session usage + L4 section changes.
 * All returned fields are numeric aggregates: never export prompts or source text.
 */
import { createHash } from "node:crypto";
import { selectPiBranch } from "../transcripts/pi-lineage.mjs";

const hash=s=>createHash("sha256").update(s).digest("hex");
function empty(){return {requests:0,input:0,output:0,cacheRead:0,cacheWrite:0,total:0,cost:0};}
function groupSummary(g){
  return {
    ...g,
    meanInput:g.requests?g.input/g.requests:0,
    meanCacheRead:g.requests?g.cacheRead/g.requests:0,
    meanCacheWrite:g.requests?g.cacheWrite/g.requests:0,
    meanTotalTokens:g.requests?g.total/g.requests:0,
    meanCost:g.requests?g.cost/g.requests:0
  };
}
export function analyzeL4Usage(entries,{leafId}={}){
  const branch=selectPiBranch(entries,leafId===undefined?{}:{leafId});
  const groups={off:empty(),onChanged:empty(),onStable:empty()};
  let l4Hash=null, changed=false;
  const diagnostics={assistantWithoutUsage:0,systemPatches:0,compactions:0};
  for(const e of branch.path){
    if(e.type==="compaction"){
      diagnostics.compactions++;
      const sections=e.systemMessage?.sections;
      if(sections && Object.hasOwn(sections,"pi-memory")){
        const next=sections["pi-memory"];
        const newHash=typeof next==="string"&&next?hash(next):null;
        changed=newHash!==l4Hash;l4Hash=newHash;
      }
    }
    if(e.type!=="message")continue;
    const msg=e.message??{};
    if(msg.role==="system"&&msg.sections && Object.hasOwn(msg.sections,"pi-memory")){
      diagnostics.systemPatches++;
      const next=msg.sections["pi-memory"];
      const newHash=typeof next==="string"&&next?hash(next):null;
      changed=newHash!==l4Hash;l4Hash=newHash;
      continue;
    }
    if(msg.role!=="assistant")continue;
    const usage=msg.usage;
    if(!usage||typeof usage!=="object"){diagnostics.assistantWithoutUsage++;continue;}
    const label=!l4Hash?"off":changed?"onChanged":"onStable";
    const g=groups[label];
    g.requests++;
    for(const key of ["input","output","cacheRead","cacheWrite"]){
      const value=Number(usage[key]);
      if(Number.isFinite(value)&&value>=0)g[key]+=value;
    }
    const total=Number(usage.totalTokens);
    g.total+=Number.isFinite(total)&&total>=0?total:
      (Number(usage.input)||0)+(Number(usage.output)||0)+(Number(usage.cacheRead)||0)+(Number(usage.cacheWrite)||0);
    const cost=Number(usage.cost?.total);
    if(Number.isFinite(cost)&&cost>=0)g.cost+=cost;
    changed=false;
  }
  return {
    leafId:branch.leafId,
    leafSource:branch.leafSource,
    groups:Object.fromEntries(Object.entries(groups).map(([k,g])=>[k,groupSummary(g)])),
    diagnostics
  };
}

export function summarizeL4Usage(reports){
  const all={off:empty(),onChanged:empty(),onStable:empty()};
  for(const r of reports){
    for(const arm of Object.keys(all)){
      for(const key of Object.keys(all[arm])){
        all[arm][key]+=Number(r.groups[arm][key])||0;
      }
    }
  }
  return Object.fromEntries(Object.entries(all).map(([k,g])=>[k,groupSummary(g)]));
}
