// Auditoria de layout por medição do DOM. Sem olhos, régua:
// overflow horizontal, texto cortado, alvo de toque pequeno, contraste, colisão.

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
  ".json": "application/json",
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

const profile = resolve(root, ".tmp-profile-audit");
if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });

let fail = 0;
let pass = 0;
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
  args: ["--no-first-run", "--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--hide-scrollbars"],
});

// Monta o cofre com dados realistas uma vez.
const seed = await browser.newPage();
await seed.setViewport({ width: 420, height: 700, deviceScaleFactor: 2 });
await seed.goto(`${base}/popup.html`, { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 600));
await seed.type("#pw", "auditoria-layout-2026");
await seed.type("#pw2", "auditoria-layout-2026");
await seed.click(".btn--weld");
await new Promise((r) => setTimeout(r, 1500));

const SEEDS = [
  ["GitHub", "dev@exemplo.com", "JBSWY3DPEHPK3PXP"],
  ["Banco do Brasil", "1234-5 / conta-corrente", "GEZDGNBVGY3TQOJQ"],
  ["Cloudflare", "ops@nexus.dev.br", "KRSXG5AAMRQXI2LB"],
  ["Google Workspace", "administrador@empresa-com-nome-longo.com.br", "MFRGGZDFMZTWQ2LK"],
  ["Steam", "gamer_tag_1994", "ONSWG4TFOQ======".replace(/=/g, "2").slice(0, 16)],
];

let seededCount = 0;
for (const [issuer, account, secret] of SEEDS) {
  await seed.click(".bar__search .btn--primary");
  await seed.waitForSelector("#issuer", { visible: true, timeout: 5000 });
  await seed.type("#issuer", issuer);
  await seed.type("#account", account);
  await seed.type("#secret", secret);

  // Espera o botão habilitar em vez de dormir: React habilita quando o segredo
  // passa na validação, e um sleep fixo corre contra o re-render.
  await seed.waitForFunction(
    () => {
      const btn = document.querySelector(".sheet__foot .btn--primary");
      return btn && !btn.disabled;
    },
    { timeout: 5000 }
  );

  await seed.click(".sheet__foot .btn--primary");
  seededCount++;
  await seed.waitForFunction(
    (n) => document.querySelectorAll(".row").length >= n,
    { timeout: 6000 },
    seededCount
  );
  // garante que o modal fechou antes de abrir o próximo
  await seed.waitForFunction(() => !document.querySelector(".sheet"), { timeout: 5000 });
}
const seeded = await seed.$$eval(".row", (n) => n.length);
ok(`cofre semeado com ${SEEDS.length} tokens`, seeded === SEEDS.length, String(seeded));

const AUDIT = () => {
  const out = { overflow: [], clipped: [], small: [], contrast: [], collide: [] };
  const docW = document.documentElement.clientWidth;

  const visible = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
  };

  // texto cortado: scrollWidth estoura o clientWidth do próprio elemento.
  // Ellipsis intencional (text-overflow) não conta — é o comportamento desejado.
  const textNodes = document.querySelectorAll(
    ".row__issuer, .row__account, .code, .vcard__issuer, .vcard__account, .vcard__code, .btn, .h1, .sub, .eyebrow, .foot__count, .set-row b, .set-row small"
  );
  for (const el of textNodes) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    if (s.textOverflow === "ellipsis") continue;
    if (s.webkitLineClamp && s.webkitLineClamp !== "none") continue;
    if (el.scrollWidth > el.clientWidth + 1 && s.overflow !== "visible") {
      out.clipped.push(`${el.className}: ${el.scrollWidth}>${el.clientWidth} "${el.textContent.trim().slice(0, 24)}"`);
    }
  }

  // overflow horizontal real da página
  if (document.documentElement.scrollWidth > docW + 1) {
    out.overflow.push(`documento ${document.documentElement.scrollWidth} > ${docW}`);
  }
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > docW + 1.5) {
      const cls = typeof el.className === "string" ? el.className.split(" ")[0] : el.tagName;
      if (!/scroll|toasts|ground|grain|aurora/i.test(cls)) {
        out.overflow.push(`${cls} right=${r.right.toFixed(1)} > ${docW}`);
      }
    }
  }

  // alvos de toque: ignora input de arquivo oculto (.sr) e elementos sem rótulo visível
  for (const el of document.querySelectorAll("button, a, input, select, .row, .vcard")) {
    if (!visible(el)) continue;
    if (el.classList.contains("sr")) continue;
    if (el.type === "file") continue;
    const r = el.getBoundingClientRect();
    if (r.height < 24 && !el.closest(".row__copy, .search__clear")) {
      out.small.push(`${el.className || el.tagName} h=${r.height.toFixed(1)}`);
    }
  }

  // contraste de texto (WCAG AA) sobre o fundo computado mais próximo
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
  };
  const bgOf = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const s = getComputedStyle(node);
      const p = parse(s.backgroundColor);
      if (p && p.a > 0.55) return p.rgb;
      node = node.parentElement;
    }
    return [5, 7, 10];
  };
  for (const el of document.querySelectorAll(".row__issuer, .row__account, .code, .sub, .hint, .foot__count, .eyebrow, .vcard__issuer, .vcard__code, .input, .btn")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const fg = parse(s.color);
    if (!fg || fg.a < 0.5) continue;
    // botão só-ícone não tem texto: a cor do glifo é avaliada pelo próprio contraste de forma
    if (!el.textContent.trim()) continue;
    const bg = bgOf(el);
    const l1 = lum(fg.rgb);
    const l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(s.fontSize);
    const bold = parseInt(s.fontWeight, 10) >= 600;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (ratio < need - 0.05) {
      out.contrast.push(
        `${(typeof el.className === "string" ? el.className : "").split(" ")[0]} ${ratio.toFixed(2)}:1 (${size}px) "${el.textContent.trim().slice(0, 18)}"`
      );
    }
  }
  return out;
};

// ---------- popup 380 ----------
console.log("\n[A] Popup 380x600");
await seed.setViewport({ width: 380, height: 600, deviceScaleFactor: 2 });
await new Promise((r) => setTimeout(r, 500));
await seed.screenshot({ path: resolve(shots, "audit-popup.png") });
const a = await seed.evaluate(AUDIT);
ok("sem overflow horizontal", a.overflow.length === 0, a.overflow.slice(0, 4).join(" | "));
ok("sem texto cortado", a.clipped.length === 0, a.clipped.slice(0, 4).join(" | "));
ok("sem alvo pequeno", a.small.length === 0, a.small.slice(0, 4).join(" | "));
ok("contraste AA", a.contrast.length === 0, a.contrast.slice(0, 5).join(" | "));

// modal aberto
await seed.click(".bar__search .btn--primary");
await new Promise((r) => setTimeout(r, 500));
const m = await seed.evaluate(AUDIT);
ok("modal sem overflow", m.overflow.length === 0, m.overflow.slice(0, 3).join(" | "));
ok("modal sem alvo pequeno", m.small.length === 0, m.small.slice(0, 3).join(" | "));
const sheetBox = await seed.$eval(".sheet", (n) => {
  const r = n.getBoundingClientRect();
  return { w: r.width, h: r.height, bottom: r.bottom };
});
ok("modal cabe na altura", sheetBox.h <= 600 && sheetBox.bottom <= 601, JSON.stringify(sheetBox));
await seed.screenshot({ path: resolve(shots, "audit-modal.png") });

// avançado aberto
await seed.click(".adv summary");
await new Promise((r) => setTimeout(r, 420));
const m2 = await seed.evaluate(AUDIT);
ok("avançado sem overflow", m2.overflow.length === 0, m2.overflow.slice(0, 3).join(" | "));
await seed.screenshot({ path: resolve(shots, "audit-modal-advanced.png") });
await seed.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 350));

// lista com scroll
const listGeom = await seed.evaluate(() => {
  const sc = document.querySelector(".shell__scroll");
  const rows = document.querySelectorAll(".row");
  return {
    scrollH: sc?.scrollHeight ?? 0,
    clientH: sc?.clientHeight ?? 0,
    rows: rows.length,
    lastRowBottom: rows.length ? rows[rows.length - 1].getBoundingClientRect().bottom : 0,
    footTop: document.querySelector(".foot")?.getBoundingClientRect().top ?? 0,
  };
});
ok("lista rola sem cobrir o rodapé", listGeom.lastRowBottom <= listGeom.footTop + 1, JSON.stringify(listGeom));

// ajustes
await seed.click('.bar .btn--icon[aria-label="Ajustes"]');
await new Promise((r) => setTimeout(r, 500));
const s2 = await seed.evaluate(AUDIT);
ok("ajustes sem overflow", s2.overflow.length === 0, s2.overflow.slice(0, 3).join(" | "));
ok("ajustes sem alvo pequeno", s2.small.length === 0, s2.small.slice(0, 3).join(" | "));
await seed.screenshot({ path: resolve(shots, "audit-settings.png") });
await seed.keyboard.press("Escape");

// ---------- janela 1100 / 760 / 420 ----------
console.log("\n[B] Janela do cofre");
const wide = await browser.newPage();
await wide.goto(`${base}/app.html`, { waitUntil: "load" });
await wide.setViewport({ width: 1100, height: 800, deviceScaleFactor: 2 });
await new Promise((r) => setTimeout(r, 700));
if (await wide.$("#unlock")) {
  await wide.type("#unlock", "auditoria-layout-2026");
  await wide.click(".gate__submit");
  await new Promise((r) => setTimeout(r, 1600));
}

for (const [w, h, label] of [
  [1100, 800, "1100"],
  [760, 720, "760"],
  [420, 780, "420"],
]) {
  await wide.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 550));
  const r = await wide.evaluate(AUDIT);
  const cards = await wide.$$eval(".vcard", (n) => n.length);
  ok(`janela ${label}: ${cards} cards`, cards === SEEDS.length, String(cards));
  ok(`janela ${label}: sem overflow`, r.overflow.length === 0, r.overflow.slice(0, 3).join(" | "));
  ok(`janela ${label}: sem texto cortado`, r.clipped.length === 0, r.clipped.slice(0, 3).join(" | "));
  ok(`janela ${label}: contraste AA`, r.contrast.length === 0, r.contrast.slice(0, 4).join(" | "));
  await wide.screenshot({ path: resolve(shots, `audit-window-${label}.png`) });
}

// grade: as colunas devem alinhar (mesma largura e mesma linha de base)
await wide.setViewport({ width: 1100, height: 800, deviceScaleFactor: 1 });
await new Promise((r) => setTimeout(r, 500));
const grid = await wide.evaluate(() => {
  const cards = [...document.querySelectorAll(".vcard")].map((n) => n.getBoundingClientRect());
  const tops = new Set(cards.map((r) => Math.round(r.top)));
  const widths = new Set(cards.map((r) => Math.round(r.width)));
  return { rows: tops.size, widths: [...widths] };
});
ok("grade tem 2 fileiras", grid.rows === 2, JSON.stringify(grid));
ok("cards com largura uniforme", grid.widths.length === 1, JSON.stringify(grid.widths));

// detalhe
await wide.click(".vcard");
await new Promise((r) => setTimeout(r, 500));
const d = await wide.evaluate(AUDIT);
ok("detalhe sem overflow", d.overflow.length === 0, d.overflow.slice(0, 3).join(" | "));
await wide.screenshot({ path: resolve(shots, "audit-detail.png") });

// ---------- reduced motion ----------
console.log("\n[C] prefers-reduced-motion");
await wide.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await wide.reload({ waitUntil: "load" });
await new Promise((r) => setTimeout(r, 1200));
if (await wide.$("#unlock")) {
  await wide.type("#unlock", "auditoria-layout-2026");
  await wide.click(".gate__submit");
  await new Promise((r) => setTimeout(r, 1500));
}
const rm = await wide.evaluate(() => {
  const btn = document.querySelector(".btn--primary");
  if (!btn) return "none";
  const s = getComputedStyle(btn);
  // a regra neutraliza a duração; 1e-06s é o piso efetivo do Chrome
  return `${s.transitionDuration}|${s.animationDuration}`;
});
ok("reduced-motion neutraliza animação", /^\d+(\.\d+)?e-0(6|7)s\|/.test(rm) || /0\.001ms|^0s\|0s/.test(rm), rm);

await browser.close();
server.close();

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} ok, ${fail} falhas\n`);
process.exit(fail === 0 ? 0 : 1);
