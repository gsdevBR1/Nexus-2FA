// Bateria completa. Cada suíte roda isolada e reporta seu placar.
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const SUITES = [
  ["motor (RFC 6238/4226 + crypto)", "tools/verify.mjs"],
  ["geometria do popup", "tools/geometry-test.mjs"],
  ["fluxos de UI", "tools/ui-test.mjs"],
  ["caminho chrome.storage", "tools/storage-test.mjs"],
  ["layout medido 380/420/760/1100", "tools/layout-audit.mjs"],
  ["acessibilidade por teclado", "tools/a11y-test.mjs"],
];

const results = [];

for (const [label, script] of SUITES) {
  process.stdout.write(`\n═══ ${label} ═══\n`);
  // Limpa perfis temporários de execuções anteriores: dois testes rodando com o
  // mesmo userDataDir disputam o lock do Chrome e o segundo nem abre.
  for (const dir of readdirSync(root)) {
    if (dir.startsWith(".tmp-")) {
      rmSync(resolve(root, dir), { recursive: true, force: true });
    }
  }
  const r = spawnSync(process.execPath, [resolve(root, script)], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const line = out.split("\n").filter((l) => /^(PASS|FAIL) —/.test(l.trim())).pop();
  process.stdout.write(
    out
      .split("\n")
      .filter((l) => /^\s+(ok|FAIL)|^\[|^(PASS|FAIL) —/.test(l))
      .join("\n") + "\n"
  );
  results.push({ label, ok: r.status === 0, line: line || "(sem placar)" });
  if (r.status !== 0 && !line) {
    process.stdout.write(out.slice(-1200) + "\n");
  }
}

console.log("\n══════════════════════════════════════");
let bad = 0;
for (const r of results) {
  console.log(`${r.ok ? "  PASS" : "  FAIL"}  ${r.label.padEnd(38)} ${r.line.replace(/^(PASS|FAIL) — /, "")}`);
  if (!r.ok) bad++;
}
console.log("══════════════════════════════════════");
console.log(bad === 0 ? "TUDO VERDE" : `${bad} suíte(s) falhando`);
process.exit(bad === 0 ? 0 : 1);
