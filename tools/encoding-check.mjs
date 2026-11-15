// Verifica os bytes que o git realmente guarda: procura duplo-encoding e
// caracteres inválidos em todo arquivo de texto versionado.
import { execFileSync } from "node:child_process";

const files = execFileSync("git", ["ls-files"], { cwd: process.cwd(), encoding: "utf8" })
  .split("\n")
  .filter((f) => /\.(md|js|jsx|mjs|css|html|json)$/.test(f));

let bad = 0;
let checked = 0;

for (const f of files) {
  let buf;
  try {
    buf = execFileSync("git", ["cat-file", "blob", `HEAD:${f}`], {
      cwd: process.cwd(),
      maxBuffer: 10e6,
    });
  } catch {
    continue;
  }
  checked++;

  const hex = buf.toString("hex");
  const doubleEnc = /c383c2|c382c2|c283/.test(hex);
  const text = buf.toString("utf8");
  const invalid = [...text].filter((c) => c === "\uFFFD").length;

  if (doubleEnc || invalid > 0) {
    bad++;
    console.log(`  FAIL ${f}  duplo=${doubleEnc} invalidos=${invalid}`);
    if (doubleEnc) {
      const i = text.indexOf("Ã");
      if (i >= 0) console.log(`         amostra: "${text.slice(Math.max(0, i - 25), i + 25)}"`);
    }
  }
}

console.log(`\n${checked} arquivos de texto verificados no git`);
// O README é o único com acentuação pesada; confirma amostras conhecidas
const readme = execFileSync("git", ["cat-file", "blob", "HEAD:README.md"], {
  cwd: process.cwd(),
  maxBuffer: 10e6,
}).toString("utf8");

const samples = ["Extensão", "autenticação", "não confio", "Selecione a pasta"];
for (const s of samples) {
  const ok = readme.includes(s);
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "FAIL"} amostra: "${s}"`);
}

console.log(bad === 0 ? "\nPASS — encoding limpo" : `\nFAIL — ${bad} problema(s)`);
process.exit(bad === 0 ? 0 : 1);
