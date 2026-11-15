// Checa geometria do shell do popup: altura real, ausência de colapso e de
// rolagem horizontal — inclusive simulando viewports apertados.

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

const profile = resolve(root, ".tmp-geom-profile");
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

const GEOM = () => {
  const q = (s) => document.querySelector(s);
  const box = (el) => (el ? el.getBoundingClientRect() : null);
  const shell = box(q(".shell"));
  const main = box(q(".shell__main"));
  const body = box(document.body);
  return {
    docH: document.documentElement.scrollHeight,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    bodyH: body?.height ?? 0,
    shellH: shell?.height ?? 0,
    mainH: main?.height ?? 0,
    gateH: box(q(".gate"))?.height ?? 0,
    innerH: window.innerHeight,
    innerW: window.innerWidth,
  };
};

// ---------- 1. tamanho real do popup ----------
console.log("\n[1] Popup 380x600 — sem colapso");
await page.setViewport({ width: 380, height: 600, deviceScaleFactor: 1 });
await page.goto(`${base}/popup.html`, { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 800));

const g1 = await page.evaluate(GEOM);
ok("body tem a altura cheia", Math.round(g1.bodyH) === 600, JSON.stringify(g1));
ok("shell ocupa a altura", Math.round(g1.shellH) === 600, String(g1.shellH));
ok("conteúdo não colapsou", g1.gateH > 200, String(g1.gateH));
ok("sem rolagem horizontal", g1.scrollW <= g1.clientW + 1, `${g1.scrollW} > ${g1.clientW}`);
ok("largura exata de 380", Math.round(g1.clientW) === 380, String(g1.clientW));
await page.screenshot({ path: resolve(shots, "geom-setup.png") });

// ---------- 2. viewport apertado (simula o colapso) ----------
console.log("\n[2] Viewport apertado — não deve colapsar");
await page.setViewport({ width: 380, height: 140, deviceScaleFactor: 1 });
await new Promise((r) => setTimeout(r, 400));
const g2 = await page.evaluate(GEOM);
ok("body mantém 600 mesmo com viewport baixo", Math.round(g2.bodyH) === 600, JSON.stringify(g2));
ok("conteúdo continua renderizado", g2.gateH > 200, String(g2.gateH));
await page.screenshot({ path: resolve(shots, "geom-tight.png") });

// ---------- 3. estado aberto com lista ----------
console.log("\n[3] Estado aberto");
await page.setViewport({ width: 380, height: 600, deviceScaleFactor: 1 });
await new Promise((r) => setTimeout(r, 300));
await page.type("#pw", "geometria-2026");
await page.type("#pw2", "geometria-2026");
await page.click(".btn--weld");
await new Promise((r) => setTimeout(r, 1600));

// adiciona dois tokens
for (const [iss, acc, sec] of [
  ["GitHub", "dev@exemplo.com", "JBSWY3DPEHPK3PXP"],
  ["Banco", "1234-5", "GEZDGNBVGY3TQOJQ"],
]) {
  await page.click(".bar__search .btn--primary");
  await page.waitForSelector("#issuer", { visible: true });
  await page.type("#issuer", iss);
  await page.type("#account", acc);
  await page.type("#secret", sec);
  await new Promise((r) => setTimeout(r, 250));
  await page.click(".sheet__foot .btn--primary");
  await new Promise((r) => setTimeout(r, 700));
}

const g3 = await page.evaluate(() => {
  const box = (s) => document.querySelector(s)?.getBoundingClientRect() ?? null;
  const bar = box(".bar");
  const search = box(".bar__search");
  const foot = box(".foot");
  const scroll = document.querySelector(".shell__scroll");
  return {
    shellH: box(".shell")?.height ?? 0,
    barH: bar?.height ?? 0,
    searchH: search?.height ?? 0,
    footH: foot?.height ?? 0,
    scrollH: scroll?.clientHeight ?? 0,
    rows: document.querySelectorAll(".row").length,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    bodyH: box("body")?.height ?? 0,
  };
});
ok("barra superior visível", g3.barH > 30, String(g3.barH));
ok("barra de busca visível", g3.searchH > 20, String(g3.searchH));
ok("rodapé visível", g3.footH > 20, String(g3.footH));
ok("área de lista tem altura útil", g3.scrollH > 300, JSON.stringify(g3));
ok("dois tokens listados", g3.rows === 2, String(g3.rows));
ok("soma das partes cabe em 600", g3.barH + g3.searchH + g3.scrollH + g3.footH <= 601, JSON.stringify(g3));
ok("aberto sem rolagem horizontal", g3.scrollW <= g3.clientW + 1, `${g3.scrollW} > ${g3.clientW}`);
await page.screenshot({ path: resolve(shots, "geom-open.png") });

// ---------- 4. botão "janela" resolve a URL certa ----------
console.log("\n[4] Botão janela");
const openHref = await page.evaluate(() => {
  // simula o ambiente de extensão e captura a chamada
  let called = null;
  const prev = window.chrome;
  window.chrome = {
    runtime: { id: "abc", getURL: (p) => `chrome-extension://abc/${p}` },
    tabs: {
      create: (o) => {
        called = o.url;
      },
    },
  };
  const btn = [...document.querySelectorAll(".foot .btn")].find((b) =>
    /janela/i.test(b.textContent)
  );
  btn?.click();
  window.chrome = prev;
  return called;
});
ok("'janela' abre app.html via chrome.tabs", /\/app\.html$/.test(openHref || ""), String(openHref));

await browser.close();
server.close();

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} ok, ${fail} falhas\n`);
process.exit(fail === 0 ? 0 : 1);
