// Validação estática do pacote de extensão — o que o Chrome exige para carregar
// uma pasta desempacotada. Não abre browser: checa estrutura, caminhos e CSP.

import { existsSync, readFileSync, statSync, readdirSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

let pass = 0;
let fail = 0;
const ok = (n, c, d = "") => {
  if (c) {
    pass++;
    console.log(`  ok   ${n}`);
  } else {
    fail++;
    console.log(`  FAIL ${n}${d ? "  → " + d : ""}`);
  }
};

console.log("\n[1] Manifest na raiz do projeto");
const rootManifestPath = resolve(root, "manifest.json");
ok("manifest.json existe na raiz", existsSync(rootManifestPath));

let manifest = null;
try {
  manifest = JSON.parse(readFileSync(rootManifestPath, "utf8"));
  ok("é JSON válido", true);
} catch (e) {
  ok("é JSON válido", false, e.message);
}

if (manifest) {
  ok("manifest_version 3", manifest.manifest_version === 3, String(manifest.manifest_version));
  ok("name presente", !!manifest.name, manifest.name);
  ok("version no formato x.y.z", /^\d+\.\d+\.\d+$/.test(manifest.version || ""), manifest.version);
  ok("description dentro de 132 chars", (manifest.description || "").length <= 132, String((manifest.description || "").length));
  ok("action com popup", !!manifest.action?.default_popup, manifest.action?.default_popup);

  // todos os caminhos citados existem
  const refs = [
    manifest.action?.default_popup,
    ...Object.values(manifest.action?.default_icon || {}),
    ...Object.values(manifest.icons || {}),
  ].filter(Boolean);
  const missing = refs.filter((r) => !existsSync(resolve(root, r)));
  ok("todos os arquivos referenciados existem", missing.length === 0, missing.join(", "));

  // permissões mínimas
  const perms = manifest.permissions || [];
  ok("permissão storage", perms.includes("storage"), perms.join(","));
  ok("permissão clipboardWrite", perms.includes("clipboardWrite"), perms.join(","));
  const dangerous = perms.filter((p) =>
    ["<all_urls>", "tabs", "webRequest", "cookies", "debugger", "proxy", "management"].includes(p)
  );
  ok("sem permissões largas desnecessárias", dangerous.length === 0, dangerous.join(","));

  ok("CSP restritiva definida", !!manifest.content_security_policy?.extension_pages, "sem CSP explícita");
  const csp = manifest.content_security_policy?.extension_pages || "";
  ok("CSP não permite eval", !/unsafe-eval/.test(csp), csp);
  ok("CSP não permite script remoto", !/https?:/.test(csp), csp);
  ok("CSP não permite unsafe-inline em script", !/script-src[^;]*unsafe-inline/.test(csp), csp);

  ok("sem content_scripts (não injeta em páginas)", !manifest.content_scripts, "injeção presente");
  ok("sem host_permissions", !manifest.host_permissions, JSON.stringify(manifest.host_permissions));
}

console.log("\n[2] Pasta dist (build)");
const distDir = resolve(root, "dist");
ok("dist existe", existsSync(distDir));
const distManifest = resolve(distDir, "manifest.json");
ok("dist/manifest.json existe", existsSync(distManifest));
if (existsSync(distManifest)) {
  const dm = JSON.parse(readFileSync(distManifest, "utf8"));
  const refs = [
    dm.action?.default_popup,
    ...Object.values(dm.action?.default_icon || {}),
  ].filter(Boolean);
  const missing = refs.filter((r) => !existsSync(resolve(distDir, r)));
  ok("dist: caminhos do manifest existem", missing.length === 0, missing.join(", "));
}

console.log("\n[3] HTML não referencia recursos externos");
for (const name of ["popup.html", "app.html"]) {
  for (const dir of [distDir, root]) {
    const p = resolve(dir, name);
    if (!existsSync(p)) continue;
    const html = readFileSync(p, "utf8");
    const external = [...html.matchAll(/(?:src|href)="(https?:)?\/\/[^"]+"/g)].map((m) => m[0]);
    ok(`${dirname(p).split(/[\\/]/).pop()}/${name}: sem recurso remoto`, external.length === 0, external.join(", "));
    ok(`${dir.split(/[\\/]/).pop()}/${name}: sem inline script`, !/<script(?![^>]*src=)[^>]*>/.test(html));
  }
}

console.log("\n[4] Bundle sem eval");
const assetsDir = resolve(distDir, "assets");
const jsFiles = existsSync(assetsDir)
  ? readdirSync(assetsDir).filter((f) => f.endsWith(".js"))
  : [];
ok("bundles encontrados", jsFiles.length > 0, String(jsFiles.length));
let evalFound = [];
for (const f of jsFiles) {
  const code = readFileSync(resolve(assetsDir, f), "utf8");
  // eval( direto e new Function( são bloqueados pela CSP do MV3
  if (/\beval\s*\(/.test(code) || /new\s+Function\s*\(/.test(code)) evalFound.push(f);
}
ok("nenhum bundle usa eval/new Function", evalFound.length === 0, evalFound.join(", "));

console.log("\n[5] Ícones");
for (const size of [16, 32, 48, 128]) {
  const p = resolve(root, "public", "icons", `icon${size}.png`);
  const exists = existsSync(p);
  ok(`icon${size}.png gerado`, exists);
  if (exists) {
    const buf = readFileSync(p);
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    ok(`icon${size}.png é PNG ${size}x${size}`, isPng && w === size && h === size, `${w}x${h}`);
  }
}

console.log("\n[6] Nenhum segredo no código entregue");
const suspend = /(?:secret|seed)\s*[:=]\s*["'][A-Z2-7]{16,}["']/gi;
let hardcoded = [];
const srcDir = resolve(root, "src");
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(e.name)) {
      const code = readFileSync(p, "utf8");
      // ignora os arquivos de teste e constantes de exemplo em comentário
      if (/tools[\\/]/.test(p)) continue;
      const hits = [...code.matchAll(suspend)].map((m) => m[0]);
      if (hits.length) hardcoded.push(`${e.name}: ${hits[0]}`);
    }
  }
};
walk(srcDir);
ok("sem segredo fixo no código de produção", hardcoded.length === 0, hardcoded.join(" | "));

console.log("\n[7] Pacote .zip para distribuição");
const zipPath = resolve(root, "nexus-2fa.zip");
const readmePath = resolve(distDir, "LEIA-ME.txt");

const README_TEXT = `NEXUS 2FA
=========

COMO INSTALAR (Chrome / Edge / Brave)
1. Abra chrome://extensions
2. Ligue "Modo do desenvolvedor" (canto superior direito)
3. Clique em "Carregar sem compactação"
4. Selecione a pasta  dist  (esta pasta, onde está este arquivo)

NAO selecione a pasta do projeto: o manifest que o Chrome le está aqui em dist/.
(A raiz do projeto tambem funciona: o manifest de la aponta para dist/.)

COMO USAR
- Primeiro acesso: crie a senha mestra. Ela cifra tudo com AES-256-GCM.
- "novo": cole o link otpauth:// do site, leia um QR de imagem ou digite a chave.
- Clique na linha para copiar o codigo; o lapis abre a edicao.
- Atalhos: "/" busca, "N" novo token, Esc fecha.
- "janela" abre a visao ampla com todos os tokens em grade.

SEGURANCA
- Sem servidor, sem conta, sem telemetria. So as permissoes storage e clipboardWrite.
- A senha mestra nunca e gravada: so um token de verificacao cifrado.
- NAO existe recuperacao de senha. Exporte o backup em Ajustes.
`;

writeFileSync(readmePath, README_TEXT, "utf8");
ok("LEIA-ME.txt escrito em dist", existsSync(readmePath));

try {
  const { execFileSync } = await import("node:child_process");
  if (existsSync(zipPath)) rmSync(zipPath);
  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force`,
    ],
    { stdio: "ignore" }
  );
  ok("nexus-2fa.zip gerado", existsSync(zipPath), zipPath);
} catch (e) {
  ok("nexus-2fa.zip gerado", false, e.message.split("\n")[0]);
}

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} ok, ${fail} falhas\n`);
process.exit(fail === 0 ? 0 : 1);
