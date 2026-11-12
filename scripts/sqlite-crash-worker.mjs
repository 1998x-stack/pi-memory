/**
 * Used ONLY by tests: kill process while an uncommitted FTS mutation is open.
 */
import { openMemoryStore } from "../src/store/sqlite-store.mjs";
const [path,namespace,sessionId]=process.argv.slice(2);
if(!path||!namespace||!sessionId)process.exit(2);
const store=openMemoryStore(path);
store.transaction(()=>{
  store.deleteSessionEvents(namespace,sessionId);
  process.kill(process.pid,"SIGKILL");
  throw new Error("SIGKILL did not terminate");
});
