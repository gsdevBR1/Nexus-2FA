// Acessibilidade por teclado e leitor de tela: foco, rótulos, ordem de tab,
// anúncio do código, e navegação completa sem mouse.

import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, rmSync, createReadStream, statSync } from "node:fs";
import { resolve, dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = resolve(root, "dist");
const shots = resolve(root, "shots");
mkdirSync(shots, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
};
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^([/\\])+/, "");
  const file = join(dist, rel === "" ? "popup.html" : rel);
  if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end("404");
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

const profile = resolve(root, ".tmp-a11y-profile");
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });

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

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  userDataDir: profile,
  args: ["--no-first-run", "--enable-unsafe-swiftshader"],
});

const page = await browser.newPage();
await page.setViewport({ width: 380, height: 600, deviceScaleFactor: 2 });
await page.goto(`${base}/popup.html`, { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 700));

// ---- criação acessível por teclado ----
console.log("\n[1] Criar cofre só com teclado");
await page.evaluate(() => document.querySelector("#pw").focus());
await page.keyboard.type("senha-teclado-2026");
await page.keyboard.press("Tab");
await page.keyboard.type("senha-teclado-2026");
const formSubmits = await page.evaluate(() => !!document.querySelector("form"));
ok("formulário tem submit (Enter funciona)", formSubmits);
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 1800));
ok("cofre criado via teclado", !!(await page.$(".empty")));

// ---- rótulos de acessibilidade ----
console.log("\n[2] Rótulos e papéis");
const unlabeled = await page.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll("button")) {
    const name =
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      el.textContent.trim();
    if (!name) bad.push(el.className || "(sem classe)");
  }
  return bad;
});
ok("todo botão tem nome acessível", unlabeled.length === 0, unlabeled.join(" | "));

const iconOnly = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("button")) {
    const visibleText = el.textContent.trim();
    const hasIcon = !!el.querySelector("svg");
    if (hasIcon && !visibleText && !el.getAttribute("aria-label")) out.push(el.className);
  }
  return out;
});
ok("botão só-ícone tem aria-label", iconOnly.length === 0, iconOnly.join(" | "));

const inputLabels = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("input, select, textarea")) {
    if (el.type === "hidden" || el.classList.contains("sr")) continue;
    const id = el.id;
    const labelled =
      (id && document.querySelector(`label[for="${id}"]`)) ||
      el.getAttribute("aria-label") ||
      el.closest("label");
    if (!labelled) out.push(el.id || el.className || el.tagName);
  }
  return out;
});
ok("todo campo tem rótulo", inputLabels.length === 0, inputLabels.join(" | "));

// ---- adicionar token e validar leitura do código ----
console.log("\n[3] Código legível por leitor de tela");
await page.click(".bar__search .btn--primary");
await page.waitForSelector("#issuer");
await page.type("#issuer", "GitHub");
await page.type("#account", "dev@exemplo.com");
await page.type("#secret", "JBSWY3DPEHPK3PXP");
await new Promise((r) => setTimeout(r, 300));
await page.click(".sheet__foot .btn--primary");
await new Promise((r) => setTimeout(r, 1000));

const codeA11y = await page.evaluate(() => {
  const code = document.querySelector(".row .code");
  const row = document.querySelector(".row");
  return {
    codeText: code?.textContent.trim() || "",
    rowRole: row?.getAttribute("role"),
    rowTab: row?.getAttribute("tabindex"),
    rowLabel: row?.getAttribute("title") || row?.getAttribute("aria-label"),
    copyLabel: document.querySelector(".row__copy")?.getAttribute("aria-label"),
  };
});
ok("código tem texto real (não pseudo-elemento)", /\d/.test(codeA11y.codeText), codeA11y.codeText);
ok("linha é focável", codeA11y.rowTab === "0");
ok("linha tem papel de botão", codeA11y.rowRole === "button");
ok("linha tem nome acessível", !!codeA11y.rowLabel, String(codeA11y.rowLabel));
ok("botão copiar nomeia o serviço", /GitHub/.test(codeA11y.copyLabel || ""), String(codeA11y.copyLabel));

// ---- foco visível ----
console.log("\n[4] Foco visível");
await page.evaluate(() => document.querySelector(".row").focus());
const ring = await page.evaluate(() => {
  const el = document.querySelector(".row");
  const s = getComputedStyle(el);
  return { outline: s.outlineStyle, outlineW: s.outlineWidth, bg: s.backgroundColor };
});
ok("linha focada tem indicação visível", ring.outline !== "none" || ring.bg !== "rgba(0, 0, 0, 0)", JSON.stringify(ring));

await page.evaluate(() => document.querySelector(".bar__search input").focus());
await page.keyboard.press("Tab");
const focusedBtn = await page.evaluate(() => {
  const el = document.activeElement;
  const s = getComputedStyle(el);
  return { tag: el.tagName, cls: el.className, outline: s.outlineStyle, w: s.outlineWidth };
});
ok("tab move para o botão seguinte", focusedBtn.tag === "BUTTON", JSON.stringify(focusedBtn));

// ---- atalhos ----
console.log("\n[5] Atalhos de teclado");
await page.evaluate(() => document.body.focus());
await page.keyboard.press("/");
await new Promise((r) => setTimeout(r, 250));
const searchFocused = await page.evaluate(() => document.activeElement?.closest(".search") !== null);
ok("'/' foca a busca", searchFocused);
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 200));
await page.keyboard.press("n");
await new Promise((r) => setTimeout(r, 400));
ok("'n' abre o modal de novo token", !!(await page.$(".sheet")));
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 350));
ok("Esc fecha o modal", !(await page.$(".sheet")));

// ---- enter abre, teclado opera a linha ----
console.log("\n[6] Operar a linha sem mouse");
await page.evaluate(() => document.querySelector(".row").focus());
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 500));
ok("Enter abre a edição", !!(await page.$("#secret")));
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 350));

// ---- landmarks e títulos ----
console.log("\n[7] Estrutura semântica");
const structure = await page.evaluate(() => ({
  h1: document.querySelectorAll("h1").length,
  sheetsClean: document.querySelectorAll(".sheet").length,
  lang: document.documentElement.lang,
  live: !!document.querySelector('[aria-live]'),
}));
ok("lang definido", !!structure.lang, structure.lang);
ok("região aria-live para toasts", structure.live);
ok("sem modal aberto ao final", structure.sheetsClean === 0);

await page.screenshot({ path: resolve(shots, "a11y-final.png") });
await browser.close();
server.close();

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} ok, ${fail} falhas\n`);
process.exit(fail === 0 ? 0 : 1);
