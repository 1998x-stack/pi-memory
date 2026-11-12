/**
 * P0 package-load probe.
 *
 * Intentionally NO memory capture, indexing, model calls, tools, network,
 * process timers or file I/O. This command only tests Pi discovery/loading.
 * Remove the "probe only" wording after implementation has passed P1-G1.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function piMemoryInstallProbe(pi: ExtensionAPI): void {
  pi.registerCommand("pi-memory-doctor", {
    description: "Verify Pi Memory extension discovery (P0 probe only)",
    handler: async (_args, ctx) => {
      const lines = [
        "Pi Memory P0 install probe: extension loaded.",
        "Memory search, capture, dreaming and CLI are NOT implemented.",
        `Pi mode: ${ctx.mode}`,
        `Project trusted: ${ctx.isProjectTrusted() ? "yes" : "no"}`,
        `Session ID available: ${ctx.sessionManager.getSessionId() ? "yes" : "no"}`,
        `Session file present: ${ctx.sessionManager.getSessionFile() ? "yes" : "not yet / ephemeral"}`,
      ];
      // TUI and RPC support UI notifications. Do not write stdout in JSON/print
      // mode, as that can corrupt machine-readable streams.
      if (ctx.hasUI) ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}
