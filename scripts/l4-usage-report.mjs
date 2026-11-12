/**
 * Usage:
 *   node scripts/l4-usage-report.mjs /path/to/a.jsonl /path/to/b.jsonl
 * Reads only explicit files; prints numerical aggregates, not prompt contents.
 */
import { readPiSessionFile } from "../src/transcripts/pi-reader.mjs";
import { analyzeL4Usage, summarizeL4Usage } from "../src/evals/l4-usage.mjs";
const paths=process.argv.slice(2);
if(!paths.length){process.stderr.write("Usage: node scripts/l4-usage-report.mjs <pi-session.jsonl>...\n");process.exit(2);}
const outputs=[];
for(const path of paths){
  const read=await readPiSessionFile(path);
  if(read.issues.length)throw new Error("Pi Session source has integrity issues; refusing misleading usage report");
  outputs.push(analyzeL4Usage(read.entries));
}
process.stdout.write(JSON.stringify({sessions:outputs.length,aggregate:summarizeL4Usage(outputs),perSession:outputs.map((r,i)=>({index:i,leafSource:r.leafSource,groups:r.groups,diagnostics:r.diagnostics}))},null,2)+"\n");
