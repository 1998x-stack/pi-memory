/**
 * A trusted L4 pointer resolves to source-grounded L2 note content only as
 * explicitly low-trust tool data. Normal searches remain scoped raw L1 hits.
 */
import { openNoteRepository } from "../notes/notes.mjs";
const noteId=/^mem_[a-f0-9-]{36}$/i;
export function resolveMemoryQuery(store,query,scope,limit=5){
  if(typeof query!=="string"||!query.trim())throw new Error("Memory search query required");
  const id=query.trim();
  if(noteId.test(id)){
    const note=openNoteRepository(store).get(id,scope);
    if (!note || note.status!=="verified" || !note.evidenceComplete) {
      return {kind:"not_found_or_not_verified",hits:[]};
    }
    return {
      kind:"human_approved_memory_note_untrusted_tool_data",
      hits:[{
        id:note.id,layer:"note",status:"verified",sourceTrust:note.sourceTrust,
        noteType:note.type,title:note.title,content:note.content,revision:note.revision,
        evidence:note.evidence.map(e=>({
          sessionId:e.sessionId,entryId:e.entryId,sourceHash:e.sourceHash
        }))
      }]
    };
  }
  return {kind:"unverified_transcript_evidence",hits:store.search(query,scope,limit)};
}
