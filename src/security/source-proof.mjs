/** Stable SHA-256 attestation of an indexed Pi JSONL entry at its byte offset.
 * This deliberately reads the source file rather than trusting stale SQLite.
 * The Pi source is not modified.
 */
import { openSync,readSync,closeSync,realpathSync } from "node:fs";
import { createHash } from "node:crypto";

export function sourceEventStillValid(entry){
  if(!entry || typeof entry.source_file!=="string" || !entry.source_file ||
     !/^[a-f0-9]{64}$/.test(entry.raw_hash))return false;
  let fd;
  try{
    if(realpathSync(entry.source_file)!==entry.source_file)return false;
    const position=Number(entry.source_offset);
    if(!Number.isSafeInteger(position)||position<0)return false;
    fd=openSync(entry.source_file,"r");
    const maxBytes=2*1024*1024;
    const chunks=[];
    let bytesTotal=0,at=position;
    for(;;){
      const buf=Buffer.alloc(Math.min(4096,maxBytes-bytesTotal));
      if(!buf.length)return false;
      const read=readSync(fd,buf,0,buf.length,at);
      if(!read)return false;
      const part=buf.subarray(0,read);
      const lf=part.indexOf(10);
      if(lf>=0){chunks.push(part.subarray(0,lf));bytesTotal+=lf;break;}
      chunks.push(part);bytesTotal+=part.length;at+=part.length;
    }
    let raw=Buffer.concat(chunks,bytesTotal);
    if(raw.at(-1)===13)raw=raw.subarray(0,-1);
    return createHash("sha256").update(raw).digest("hex")===entry.raw_hash;
  }catch{return false;}
  finally{if(fd!==undefined)closeSync(fd);}
}
