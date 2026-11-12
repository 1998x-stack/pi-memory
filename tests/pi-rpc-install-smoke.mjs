/**
 * Real Pi RPC smoke test. No LLM requests, credentials, or user session files.
 * Usage: node tests/pi-rpc-install-smoke.mjs [--installed]
 * --installed tests the Pi package already installed into PI_CODING_AGENT_DIR.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const installed = process.argv.includes("--installed");
const disabled = process.argv.includes("--disabled");
const existingAgentDir = process.env.PI_CODING_AGENT_DIR;
const agentDir = existingAgentDir ?? await mkdtemp(resolve(tmpdir(), "pi-memory-rpc-"));
const shouldClean = !existingAgentDir;
const cwd = resolve(import.meta.dirname, "..");

async function check() {
  const args = ["--mode", "rpc", "--no-session"];
  if (!installed) args.push("-ne", "-e", cwd);
  else if (disabled) args.push("-ne");
  const child = spawn("pi", args, {
    cwd,
    env: { ...process.env, PI_CODING_AGENT_DIR: agentDir, CI: "true", NO_COLOR: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const childClosed = new Promise(resolveClose => child.once("close", resolveClose));
  let stdoutBuffer = "";
  let stderr = "";
  let finished = false;

  try {
    const response = await new Promise((resolveResult, rejectResult) => {
      const timeout = setTimeout(() => rejectResult(new Error(`RPC get_commands timed out. stderr=${stderr.slice(-2000)}`)), 30000);
      const done = (err, value) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        if (err) rejectResult(err);
        else resolveResult(value);
      };
      child.on("error", err => done(err));
      child.on("exit", code => done(new Error(`pi RPC exited before response (code ${code}): ${stderr.slice(-2000)}`)));
      child.stderr.on("data", data => { stderr = (stderr + data.toString("utf8")).slice(-6000); });
      child.stdout.on("data", data => {
        stdoutBuffer += data.toString("utf8");
        while (stdoutBuffer.includes("\n")) {
          const pos = stdoutBuffer.indexOf("\n");
          const line = stdoutBuffer.slice(0, pos).trim();
          stdoutBuffer = stdoutBuffer.slice(pos + 1);
          if (!line) continue;
          let record;
          try { record = JSON.parse(line); }
          catch { done(new Error(`Pi RPC emitted non-JSON stdout: ${line.slice(0,200)}`)); return; }
          if (record.type === "response" && record.id === "probe-commands") {
            if (!record.success) done(new Error(`get_commands failed: ${JSON.stringify(record)}`));
            else done(null, record.data);
            return;
          }
        }
      });
      child.stdin.write(JSON.stringify({ id: "probe-commands", type: "get_commands" }) + "\n");
    });
    assert.ok(Array.isArray(response.commands), "get_commands must return a commands array");
    const names = response.commands.filter(c => c.source === "extension").map(c => c.name);
    if (disabled) assert.ok(!names.includes("pi-memory-doctor"), "Pi loaded disabled extension unexpectedly");
    else assert.ok(names.includes("pi-memory-doctor"), `P0 doctor absent. Extension commands: ${names.join(", ")}; stderr: ${stderr.slice(-1000)}`);
    process.stdout.write(`PASS real Pi RPC: ${disabled ? "disabled extension absent" : "doctor registered"} (${installed ? "installed package" : "source extension"})\n`);
  } finally {
    child.stdin.end();
    if (!child.killed) child.kill("SIGTERM");
    await Promise.race([childClosed, new Promise(resolveWait => setTimeout(resolveWait, 5000))]);
  }
}

try {
  await check();
} finally {
  if (shouldClean) await rm(agentDir, { recursive: true, force: true });
}
