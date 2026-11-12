import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

test("P0 Pi package declares an existing TypeScript extension", async () => {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.equal(manifest.name, "pi-memory");
  assert.ok(manifest.keywords.includes("pi-package"));
  assert.equal(manifest.pi.extensions.length, 1);
  const entry = manifest.pi.extensions[0].replace(/^\.\//, "");
  const s = await stat(join(root, entry));
  assert.ok(s.isFile(), "Pi extension entrypoint must exist in git checkout");
  assert.ok(entry.endsWith(".ts"), "Git install should not require prebuilt dist");
});

test("host modules are never bundled as runtime dependencies", async () => {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  for (const name of ["@earendil-works/pi-coding-agent", "@earendil-works/pi-ai", "@earendil-works/pi-agent-core", "@earendil-works/pi-tui", "typebox"]) {
    assert.ok(!manifest.dependencies?.[name], `host dependency wrongly included: ${name}`);
  }
  assert.equal(manifest.peerDependencies["@earendil-works/pi-coding-agent"], "*");
});

test("Pi Extension exposes manually scoped P1 search but no automatic capture", async () => {
  const text = await readFile(join(root, "extensions/pi-memory.ts"), "utf8");
  assert.match(text, /export default function piMemoryExtension/);
  assert.match(text, /registerCommand\("pi-memory-doctor"/);
  assert.match(text, /NOT implemented/);
  assert.doesNotMatch(text, /registerTool\(/);
});
