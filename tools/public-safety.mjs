// Auditoria do que será exposto ao tornar o repositório público.
// Procura dados pessoais, credenciais e caminhos absolutos da máquina.
import { execFileSync } from "node:child_process";

const ls = (args) =>
  execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 20e6,
  });

const files = ls(["ls-files"])
  .split("\n")
  .filter((f) => /\.(js|jsx|mjs|md|json|html|css|txt)$/.test(f));

const rules = [
  { name: "nome de usuário do Windows", re: /PCZADA/gi },
  { name: "caminho absoluto Windows", re: /[A-Z]:\\\\?Users\\\\?[A-Za-z0-9._-]+/g },
  { name: "e-mail pessoal", re: /[a-z0-9._%+-]+@(gmail|hotmail|outlook|yahoo)\./gi },
  { name: "chave privada", re: /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/g },
  { name: "token de API", re: /(ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,})/g },
  { name: "senha literal", re: /(password|senha|passwd)\s*[:=]\s*["'`][^"'`\s]{6,}["'`]/gi },
  // Só arquivos reais: ".env" como extensão/arquivo, não o nome de uma chave
  // de storage ("nexus.vault"). Por isso o lookahead de fim de string/aspas.
  { name: "arquivo de ambiente", re: /(^|[/\\"'\s])\.env(\b|["'`]|$)/g },
];

// Constantes de teste conhecidas: sementes públicas dos RFCs, não são segredos.
const TEST_CONSTANTS = new Set([
  "JBSWY3DPEHPK3PXP",
  "GEZDGNBVGY3TQOJQ",
  "KRSXG5AAMRQXI2LB",
  "MZXW6YTBOI2XG3DH",
]);

let findings = 0;
let i = 0;

for (const file of files) {
  let text;
  try {
    text = ls(["show", `HEAD:${file}`]);
  } catch {
    continue;
  }
  i++;

  for (const rule of rules) {
    const hits = [...text.matchAll(rule.re)].map((m) => m[0]);
    if (!hits.length) continue;
    findings++;
    console.log(`  ACHADO  ${file}`);
    console.log(`          ${rule.name}: ${[...new Set(hits)].slice(0, 3).join(", ")}`);
  }

  // sementes base32 longas que NÃO são constantes de teste
  for (const m of text.matchAll(/[A-Z2-7]{20,}/g)) {
    if (TEST_CONSTANTS.has(m[0])) continue;
    // o alfabeto do codec não é segredo
    if (m[0].startsWith("ABCDEFGHIJKLMNOPQRSTUVWXYZ")) continue;
    findings++;
    console.log(`  ACHADO  ${file}`);
    console.log(`          semente base32 não reconhecida: ${m[0].slice(0, 24)}…`);
  }
}

console.log(`\n${i} arquivos de texto verificados`);
console.log(findings === 0 ? "PASS — nada sensível encontrado" : `ATENÇÃO — ${findings} achado(s)`);
process.exit(findings === 0 ? 0 : 1);
