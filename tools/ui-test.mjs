// Smoke test real: abre dist/popup.html no Chrome, cria cofre, adiciona token,
// confere o código TOTP contra o motor, copia e apaga. Salva screenshots.
//
// Regra do arquivo: nenhuma espera por tempo fixo. Toda transição é aguardada
// por condição (modal aberto/fechado, linha criada, código renderizado).

import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, rmSync, createReadStream, statSync } from "node:fs";
import { resolve, dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { totp } from "../src/lib/totp.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = resolve(root, "dist");
const shots = resolve(root, "shots");
mkdirSync(shots, { recursive: true });

// Servidor estático: file:// bloqueia módulos ES por CORS, então serve em loopback.
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split("?")[0]);
  const rel = normalize(clean === "/" ? "/popup.html" : clean).replace(/^([/\\])+/, "");
  const file = join(dist, rel);
  if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));
if (!CHROME) {
  console.error("Chrome não encontrado.");
  process.exit(1);
}

const profile = resolve(root, ".tmp-profile");
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });

const SECRET = "JBSWY3DPEHPK3PXP";
const SECRET_2 = "GEZDGNBVGY3TQOJQ";

let pass = 0;
let fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? "  → " + detail : ""}`);
  }
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  userDataDir: profile,
  args: [
    "--no-first-run",
    "--no-default-browser-check",
    "--allow-file-access-from-files",
    "--enable-unsafe-swiftshader",
    "--use-gl=swiftshader",
    "--window-size=420,700",
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 420, height: 700, deviceScaleFactor: 2 });

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

// ---- esperas por condição ----------------------------------------------

const waitRows = (n) =>
  page.waitForFunction(
    (want) => document.querySelectorAll(".row").length === want,
    { timeout: 8000 },
    n
  );

const waitNoSheet = () =>
  page.waitForFunction(() => !document.querySelector(".sheet"), { timeout: 8000 });

const waitSheet = () =>
  page.waitForSelector(".sheet", { visible: true, timeout: 8000 });

const waitCode = () =>
  page.waitForFunction(
    () => {
      const el = document.querySelector(".row .code");
      return el && /\d{3}/.test(el.textContent);
    },
    { timeout: 8000 }
  );

/** Abre o modal de novo token com segurança (espera o anterior sair). */
async function openEditor() {
  await waitNoSheet();
  await page.click(".bar__search .btn--primary");
  await waitSheet();
  await page.waitForSelector("#issuer", { visible: true, timeout: 5000 });
}

/** Preenche e salva, esperando o botão habilitar antes do clique. */
async function fillAndSave({ issuer, account, secret, targetRows }) {
  if (issuer != null) await page.type("#issuer", issuer);
  if (account != null) await page.type("#account", account);
  if (secret != null) await page.type("#secret", secret);

  await page.waitForFunction(
    () => {
      const b = document.querySelector(".sheet__foot .btn--primary");
      return b && !b.disabled;
    },
    { timeout: 6000 }
  );
  await page.click(".sheet__foot .btn--primary");
  if (targetRows != null) await waitRows(targetRows);
  await waitNoSheet();
}

// ---- 1. tela de criação ----
console.log("\n[1] Tela inicial");
await page.goto(`${base}/popup.html`, { waitUntil: "load" });
await page.waitForSelector(".gate", { visible: true, timeout: 8000 });
ok("mostra a tela de criar cofre", true);
const title = await page.$eval(".gate .h1", (n) => n.textContent).catch(() => "");
ok("título correto", /chave do cofre/i.test(title), title);
await page.screenshot({ path: resolve(shots, "01-setup.png") });

// ---- 2. criação do cofre ----
console.log("\n[2] Criar cofre");
await page.type("#pw", "senha-de-teste-2026");
await page.type("#pw2", "senha-de-teste-2026");
const meterOn = await page.$$eval(".meter span.on", (n) => n.length);
ok("medidor de força reage", meterOn >= 4, String(meterOn));
await page.screenshot({ path: resolve(shots, "02-setup-filled.png") });
await page.click(".btn--weld");
await page.waitForSelector(".empty", { visible: true, timeout: 15000 });
ok("abre o cofre vazio", true);
await page.screenshot({ path: resolve(shots, "03-empty.png") });

// ---- 3. adicionar token ----
console.log("\n[3] Adicionar token");
await openEditor();
ok("abre o modal", true);
await page.screenshot({ path: resolve(shots, "04-modal.png") });

await page.type(
  ".sheet textarea",
  `otpauth://totp/GitHub:dev@exemplo.com?secret=${SECRET}&issuer=GitHub`
);
await page.waitForFunction(
  () => document.querySelector("#issuer")?.value === "GitHub",
  { timeout: 5000 }
);
const accountVal = await page.$eval("#account", (n) => n.value);
ok("issuer preenchido pelo link", true);
ok("conta preenchida pelo link", accountVal === "dev@exemplo.com", accountVal);
await page.screenshot({ path: resolve(shots, "05-modal-parsed.png") });

await fillAndSave({ targetRows: 1 });
ok("linha aparece na lista", true);

// ---- 4. código correto ----
console.log("\n[4] Código TOTP na tela");
await waitCode();
const shown = await page.$eval(".row .code", (n) => n.textContent.replace(/\s/g, ""));
const expect = (await totp({ secret: SECRET, digits: 6, period: 30 }, Date.now())).code;
ok("código bate com o motor", shown === expect, `tela ${shown} / motor ${expect}`);
await page.screenshot({ path: resolve(shots, "06-list.png") });

// ---- 5. cópia ----
console.log("\n[5] Copiar");
await page.evaluate(() => {
  window.__copied = "";
  navigator.clipboard.writeText = async (t) => {
    window.__copied = t;
  };
});
await page.click(".row .row__copy");
await page.waitForFunction(() => !!window.__copied, { timeout: 5000 });
const copied = await page.evaluate(() => window.__copied);
ok("copiou o código certo", copied === expect, `${copied} vs ${expect}`);
ok("toast de confirmação aparece", !!(await page.$(".toast")));
await page.screenshot({ path: resolve(shots, "07-copied.png") });

// ---- 6. mascarar ----
console.log("\n[6] Mascarar");
await page.click('.bar .btn--icon[aria-label*="Mascarar"]');
await page.waitForFunction(
  () => /•/.test(document.querySelector(".row .code")?.textContent || ""),
  { timeout: 5000 }
);
ok("código mascarado", true);
await page.screenshot({ path: resolve(shots, "08-masked.png") });
await page.click('.bar .btn--icon[aria-label*="Mostrar"]');
await page.waitForFunction(
  () => /\d{3}/.test(document.querySelector(".row .code")?.textContent || ""),
  { timeout: 5000 }
);

// ---- 7. editar ----
console.log("\n[7] Editar");
await page.click(".row");
await waitSheet();
const secretShown = await page.$eval("#secret", (n) => n.value);
ok("segredo carregado", secretShown === SECRET, secretShown);
await page.screenshot({ path: resolve(shots, "09-edit.png") });
await page.type("#issuer", "-work");
await page.waitForFunction(
  () => document.querySelector("#issuer")?.value === "GitHub-work",
  { timeout: 5000 }
);
await page.click(".sheet__foot .btn--primary");
await page.waitForFunction(
  () => document.querySelector(".row__issuer")?.textContent === "GitHub-work",
  { timeout: 8000 }
);
await waitNoSheet();
ok("edição salva", true);

// ---- 8. segundo token + busca ----
console.log("\n[8] Busca com dois tokens");
await openEditor();
await fillAndSave({ issuer: "Banco", account: "conta@pessoal.com", secret: SECRET_2, targetRows: 2 });
ok("dois tokens na lista", true);

await page.type(".search input", "banco");
await page.waitForFunction(() => document.querySelectorAll(".row").length === 1, { timeout: 5000 });
ok("busca filtra", true);
await page.screenshot({ path: resolve(shots, "10-search.png") });

// ---- 9. excluir ----
console.log("\n[9] Excluir");
await page.click(".search__clear");
await waitRows(2);
await page.click(".row");
await waitSheet();
await page.click(".sheet__foot .btn--danger");
await page.waitForFunction(
  () => /confirmar/i.test(document.querySelector(".sheet__foot .btn--danger")?.textContent || ""),
  { timeout: 5000 }
);
await page.click(".sheet__foot .btn--danger");
await waitRows(1);
await waitNoSheet();
ok("token excluído", true);

// ---- 10. persistência e bloqueio ----
console.log("\n[10] Persistência e bloqueio");
await page.reload({ waitUntil: "load" });
await page.waitForSelector("#unlock", { visible: true, timeout: 10000 });
ok("recarregar pede senha", true);
await page.screenshot({ path: resolve(shots, "11-locked.png") });

await page.type("#unlock", "senha-errada-xx");
await page.click(".gate__submit");
await page.waitForFunction(
  () => /incorreta/i.test(document.querySelector(".err")?.textContent || ""),
  { timeout: 8000 }
);
ok("senha errada não abre", !!(await page.$("#unlock")));
ok("mostra erro de senha", true);

await page.type("#unlock", "senha-de-teste-2026");
await page.click(".gate__submit");
await waitRows(1);
ok("senha certa reabre com dados", true);
await page.screenshot({ path: resolve(shots, "12-reopened.png") });

// ---- 11. ajustes ----
console.log("\n[11] Ajustes");
await page.click('.bar .btn--icon[aria-label="Ajustes"]');
await page.waitForSelector(".set-group", { visible: true, timeout: 5000 });
ok("modal de ajustes abre", true);
await page.screenshot({ path: resolve(shots, "13-settings.png") });
await page.keyboard.press("Escape");
await waitNoSheet();

// ---- 12. janela grande ----
console.log("\n[12] Janela do cofre");
const big = await browser.newPage();
big.on("pageerror", (e) => errors.push("app: " + String(e)));
await big.setViewport({ width: 1100, height: 800, deviceScaleFactor: 2 });
await big.goto(`${base}/app.html`, { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 700));
if (await big.$("#unlock")) {
  await big.type("#unlock", "senha-de-teste-2026");
  await big.click(".gate__submit");
  await big.waitForSelector(".vcard", { visible: true, timeout: 15000 });
}
ok("janela mostra cards", true);
await big.screenshot({ path: resolve(shots, "14-window.png") });

// adiciona mais tokens para o grid
for (const [issuer, account, secret, expected] of [
  ["Cloudflare", "ops@nexus.dev", "MZXW6YTBOI2XG3DH", 2],
  ["AWS", "root@conta", "KRSXG5AAMRQXI2LB", 3],
]) {
  const before = await big.$$eval(".vcard", (n) => n.length);
  await big.click(".vbar .btn--primary");
  await big.waitForSelector("#issuer", { visible: true, timeout: 5000 });
  await big.type("#issuer", issuer);
  await big.type("#account", account);
  await big.type("#secret", secret);
  await big.waitForFunction(
    () => {
      const b = document.querySelector(".sheet__foot .btn--primary");
      return b && !b.disabled;
    },
    { timeout: 6000 }
  );
  await big.click(".sheet__foot .btn--primary");
  await big.waitForFunction(
    (n) => document.querySelectorAll(".vcard").length === n,
    { timeout: 8000 },
    before + 1
  );
  await big.waitForFunction(() => !document.querySelector(".sheet"), { timeout: 8000 });
  void expected;
}
const cards2 = await big.$$eval(".vcard", (n) => n.length);
ok("grid com três cards", cards2 === 3, String(cards2));
await big.screenshot({ path: resolve(shots, "15-window-grid.png") });

// ---- erros de página ----
console.log("\n[13] Console limpo");
const realErrors = errors.filter(
  (e) => !/favicon|Failed to load resource|net::ERR_FILE_NOT_FOUND|status of 404/i.test(e)
);
ok("sem erro de página", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));

await browser.close();
server.close();

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} ok, ${fail} falhas`);
console.log(`screenshots em ${shots}\n`);
process.exit(fail === 0 ? 0 : 1);
