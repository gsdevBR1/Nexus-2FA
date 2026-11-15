// Valida o caminho REAL de produção: chrome.storage.local + chrome.storage.session.
// Injeta um mock fiel dessas APIs (assíncronas, por área) antes do app carregar,
// para exercitar wrapLocal()/wrapSession() — não o fallback de localStorage.

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

const profile = resolve(root, ".tmp-storage-profile");
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
  args: ["--no-first-run", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"],
});

const page = await browser.newPage();
await page.setViewport({ width: 380, height: 600, deviceScaleFactor: 2 });

// Mock de chrome.storage com a mesma semântica: get(key) -> {key: value}, set({k:v}).
await page.evaluateOnNewDocument(() => {
  const makeArea = (backing) => {
    const state = {};
    // restaura de sessão anterior do mesmo teste (persistência entre reloads)
    Object.assign(state, backing);
    return {
      __state: state,
      async get(keys) {
        await new Promise((r) => setTimeout(r, 0));
        if (keys == null) return { ...state };
        if (typeof keys === "string") return keys in state ? { [keys]: state[keys] } : {};
        if (Array.isArray(keys)) {
          const out = {};
          for (const k of keys) if (k in state) out[k] = state[k];
          return out;
        }
        const out = {};
        for (const k of Object.keys(keys)) out[k] = k in state ? state[k] : keys[k];
        return out;
      },
      async set(obj) {
        await new Promise((r) => setTimeout(r, 0));
        Object.assign(state, obj);
        if (backing.__persist) backing.__persist(state);
      },
      async remove(key) {
        for (const k of [].concat(key)) delete state[k];
        if (backing.__persist) backing.__persist(state);
      },
    };
  };

  // localStorage guarda só os dois "discos" para sobreviver ao reload do teste
  const read = (k) => {
    try {
      return JSON.parse(localStorage.getItem("mock." + k) || "{}");
    } catch {
      return {};
    }
  };
  const write = (k) => (state) => localStorage.setItem("mock." + k, JSON.stringify(state));

  const localBacking = read("local");
  localBacking.__persist = write("local");
  const sessionBacking = read("session");
  sessionBacking.__persist = write("session");

  window.__mockCalls = { localGet: 0, localSet: 0, sessionSet: 0 };
  const local = makeArea(localBacking);
  const session = makeArea(sessionBacking);

  const wrapCount = (area, name) => {
    const get = area.get.bind(area);
    const set = area.set.bind(area);
    area.get = (k) => {
      window.__mockCalls[name + "Get"]++;
      return get(k);
    };
    area.set = (v) => {
      window.__mockCalls[name + "Set"]++;
      return set(v);
    };
    return area;
  };

  window.chrome = { storage: { local: wrapCount(local, "local"), session: wrapCount(session, "session") } };
});

const SECRET = "JBSWY3DPEHPK3PXP";

await page.goto(`${base}/popup.html`, { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 800));

console.log("\n[1] Caminho chrome.storage ativo");
ok("usa chrome.storage.local (não o fallback)", await page.evaluate(() => !!window.chrome?.storage?.local));
ok("usa chrome.storage.session", await page.evaluate(() => !!window.chrome?.storage?.session));
ok("tela de criação abriu", !!(await page.$("#pw")));

console.log("\n[2] Criar cofre grava nas áreas certas");
await page.type("#pw", "senha-storage-2026");
await page.type("#pw2", "senha-storage-2026");
await page.click(".btn--weld");
await new Promise((r) => setTimeout(r, 2000));
ok("cofre aberto", !!(await page.$(".empty")));

const localKeys = await page.evaluate(async () => Object.keys(await chrome.storage.local.get(null)));
ok("chave nexus.meta em local", localKeys.includes("nexus.meta"), localKeys.join(","));
ok("chave nexus.vault em local", localKeys.includes("nexus.vault"), localKeys.join(","));

const sessionKeys = await page.evaluate(async () => Object.keys(await chrome.storage.session.get(null)));
ok("chave de sessão em session (não em local)", sessionKeys.includes("nexus.session") && !localKeys.includes("nexus.session"), sessionKeys.join(","));

console.log("\n[3] Vault cifrado no disco");
const raw = await page.evaluate(async () => JSON.stringify(await chrome.storage.local.get(null)));
ok("segredo não aparece em texto claro", !raw.includes(SECRET));
ok("blob tem iv + ct (AES-GCM)", /"iv":"[A-Za-z0-9+/=]+"/.test(raw) && /"ct":"[A-Za-z0-9+/=]+"/.test(raw));
ok("meta guarda salt e iterations", /"salt":"/.test(raw) && /"iterations":310000/.test(raw));

console.log("\n[4] Token: código e re-cifragem");
await page.click(".bar__search .btn--primary");
await new Promise((r) => setTimeout(r, 400));
await page.type("#issuer", "GitHub");
await page.type("#account", "dev@exemplo.com");
await page.type("#secret", SECRET);
await new Promise((r) => setTimeout(r, 300));
await page.click(".sheet__foot .btn--primary");
await new Promise((r) => setTimeout(r, 1000));

const shown = await page.$eval(".row .code", (n) => n.textContent.replace(/\s/g, ""));
const expect = (await totp({ secret: SECRET }, Date.now())).code;
ok("código correto", shown === expect, `${shown} vs ${expect}`);
const raw2 = await page.evaluate(async () => JSON.stringify(await chrome.storage.local.get(null)));
ok("após gravar token, segredo continua cifrado", !raw2.includes(SECRET));
ok("ciphertext mudou (re-cifrado)", raw2 !== raw);

console.log("\n[5] Sessão sobrevive ao reload");
await page.reload({ waitUntil: "load" });
await new Promise((r) => setTimeout(r, 1400));
const rowsAfterReload = await page.$$eval(".row", (n) => n.length).catch(() => 0);
ok("relogou sem pedir senha (storage.session)", rowsAfterReload === 1, String(rowsAfterReload));
await page.screenshot({ path: resolve(shots, "storage-reload.png") });

console.log("\n[6] Bloquear apaga a chave da sessão");
await page.click('.bar .btn--icon[aria-label="Bloquear agora"]');
await new Promise((r) => setTimeout(r, 900));
ok("tela de desbloqueio", !!(await page.$("#unlock")));
const sessionAfterLock = await page.evaluate(async () => Object.keys(await chrome.storage.session.get(null)));
ok("nexus.session removida", !sessionAfterLock.includes("nexus.session"), sessionAfterLock.join(","));
const vaultAfterLock = await page.evaluate(async () => Object.keys(await chrome.storage.local.get(null)));
ok("dados seguem no disco (não apagados)", vaultAfterLock.includes("nexus.vault"));

await page.type("#unlock", "senha-storage-2026");
await page.click(".gate__submit");
await new Promise((r) => setTimeout(r, 1800));
ok("reabre e decifra do disco", !!(await page.$(".row")));

console.log("\n[7] Senha errada não decifra");
await page.click('.bar .btn--icon[aria-label="Bloquear agora"]');
await new Promise((r) => setTimeout(r, 800));
await page.type("#unlock", "senha-errada-2026");
await page.click(".gate__submit");
await new Promise((r) => setTimeout(r, 1500));
ok("continua bloqueado", !!(await page.$("#unlock")));
ok("nenhum token vazou", (await page.$$(".row")).length === 0);

await browser.close();
server.close();

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} ok, ${fail} falhas\n`);
process.exit(fail === 0 ? 0 : 1);
