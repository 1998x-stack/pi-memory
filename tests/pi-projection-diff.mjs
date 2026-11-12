/**
 * Differential test against the real installed Pi package's exported
 * buildSessionProjection, not a hand-written expected snapshot.
 * Run only in CI job after npm install -g Pi@1.5.2.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readPiSessionFile } from "../src/transcripts/pi-reader.mjs";
import { projectPiSession } from "../src/transcripts/pi-projection.mjs";

const npmRoot=execFileSync("npm",["root","-g"],{encoding:"utf8"}).trim();
const piPath=join(npmRoot,"@earendil-works","pi-coding-agent","dist","index.js");
const pi=await import(pathToFileURL(piPath).href);
assert.equal(typeof pi.buildSessionProjection,"function","Pi must export buildSessionProjection");

const fixture=new URL("./fixtures/pi-v3/branched-compacted.jsonl",import.meta.url);
const { entries }=await readPiSessionFile(fixture);
const examples=[undefined,"a4","u6","t7r","c8","e9","cm10","tl12"];
for(const leafId of examples){
  const upstream=pi.buildSessionProjection(entries,leafId);
  const ours=projectPiSession(entries,leafId===undefined?{}:{leafId});
  assert.deepEqual(ours.contextEntryIds,upstream.entries.map(x=>x.sourceEntry.id),
    "context entries mismatch for leaf "+String(leafId));
  assert.deepEqual(ours.messages,upstream.messages,
    "model-visible messages mismatch for leaf "+String(leafId));
  assert.deepEqual(ours.model,upstream.model,"model mismatch for "+String(leafId));
  assert.deepEqual(ours.thinkingLevel,upstream.thinkingLevel,"thinking mismatch for "+String(leafId));
}

const ts="2026-11-12T00:00:00.000Z";
const sample=[
  {type:"message",id:"u1",parentId:null,timestamp:ts,message:{role:"user",content:"original"}},
  {type:"message",id:"a2",parentId:"u1",timestamp:ts,message:{role:"assistant",provider:"p",model:"m",content:[{type:"text",text:"original"}]}},
  {type:"context_edit",id:"e3",parentId:"a2",timestamp:ts,targetId:"a2",replacement:{content:"replacement-1"}},
  {type:"context_edit",id:"e4",parentId:"e3",timestamp:ts,targetId:"a2",replacement:{content:"replacement-2"}},
  {type:"compaction",id:"c5",parentId:"e4",timestamp:ts,firstKeptEntryId:"a2",summary:"summary-1",tokensBefore:100,systemMessage:{role:"system",content:"checkpoint-1"}},
  {type:"message",id:"u6",parentId:"c5",timestamp:ts,message:{role:"user",content:"next"}},
  {type:"compaction",id:"c7",parentId:"u6",timestamp:ts,firstKeptEntryId:"c5",summary:"summary-2",tokensBefore:80,systemMessage:{role:"system",content:"checkpoint-2"}},
  {type:"message",id:"a8",parentId:"c7",timestamp:ts,message:{role:"assistant",provider:"p",model:"m",content:[{type:"text",text:"last"}]}}
];
for(const leafId of ["e4","c5","a8"]){
  const upstream=pi.buildSessionProjection(sample,leafId);
  const ours=projectPiSession(sample,{leafId});
  assert.deepEqual(ours.contextEntryIds,upstream.entries.map(x=>x.sourceEntry.id),
    "double-compaction entry mismatch "+leafId);
  assert.deepEqual(ours.messages,upstream.messages,
    "double-compaction message mismatch "+leafId);
}
process.stdout.write("PASS P1 projection differential: " + (examples.length+3) + " cases against Pi@1.5.2\n");
