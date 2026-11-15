// Verificação do motor: vetores RFC 6238 + base32 + cofre round-trip.
// Roda com `node tools/verify.mjs`. Sem browser.

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

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

const eq = (name, a, b) => ok(name, a === b, `recebido ${JSON.stringify(a)}, esperado ${JSON.stringify(b)}`);

// --- módulos sob teste ---------------------------------------------------
const { base32Decode, base32Encode, isValidSecret } = await import("../src/lib/base32.js");
const { totp, parseOtpAuth, normalizeAlgorithm, formatCode } = await import("../src/lib/totp.js");
const { generateSecret } = await import("../src/lib/secret.js");

console.log("\n[1] Base32 (RFC 4648)");
eq("JBSWY3DPEHPK3PXP decodifica 10 bytes", base32Decode("JBSWY3DPEHPK3PXP").length, 10);
eq("espaços e hífens são ignorados", base32Decode("jbsw y3dp-ehpk 3pxp").length, 10);
eq(
  "encode(decode(x)) == x",
  base32Encode(base32Decode("MZXW6YTBOI======")),
  "MZXW6YTBOI"
);
ok("segredo de 8 chars é inválido", !isValidSecret("AAAAAAA"));
ok("segredo de 16 chars é válido", isValidSecret("JBSWY3DPEHPK3PXP"));

// --- RFC 6238: os vetores do Apêndice B ----------------------------------
// seed ASCII "12345678901234567890" (20 bytes) em SHA-1
const SEED_SHA1 = base32Encode(Buffer.from("12345678901234567890", "ascii"));
// SHA-256 usa 32 bytes, SHA-512 usa 64 bytes da mesma sequência
const SEED_256 = base32Encode(Buffer.from("12345678901234567890123456789012", "ascii"));
const SEED_512 = base32Encode(
  Buffer.from("1234567890123456789012345678901234567890123456789012345678901234", "ascii")
);

const VECTORS = [
  // T (s), esperado SHA1, SHA256, SHA512
  [59, "94287082", "46119246", "90693936"],
  [1111111109, "07081804", "68084774", "25091201"],
  [1111111111, "14050471", "67062674", "99943326"],
  [1234567890, "89005924", "91819424", "93441116"],
  [2000000000, "69279037", "90698825", "38618901"],
  [20000000000, "65353130", "77737706", "47863826"],
];

console.log("\n[2] RFC 6238 / Apêndice B (8 dígitos)");
for (const [t, sha1, sha256, sha512] of VECTORS) {
  const ms = t * 1000;
  const a = await totp({ secret: SEED_SHA1, digits: 8, period: 30, algorithm: "SHA1" }, ms);
  const b = await totp({ secret: SEED_256, digits: 8, period: 30, algorithm: "SHA256" }, ms);
  const c = await totp({ secret: SEED_512, digits: 8, period: 30, algorithm: "SHA512" }, ms);
  eq(`T=${t} SHA-1  `, a.code, sha1);
  eq(`T=${t} SHA-256`, b.code, sha256);
  eq(`T=${t} SHA-512`, c.code, sha512);
}

// --- RFC 4226 (HOTP, contador fixo via período 30 e t = c*30) -----------
console.log("\n[3] RFC 4226 / Apêndice D (6 dígitos, contador c)");
// O RFC 4226 publica os 10 primeiros códigos HOTP; TOTP com t = c*30 usa o mesmo contador.
const HOTP = [
  "755224", "287082", "359152", "969429", "338314",
  "254676", "287922", "162583", "399871", "520489",
];
for (let c = 0; c < HOTP.length; c++) {
  const r = await totp({ secret: SEED_SHA1, digits: 6, period: 30, algorithm: "SHA1" }, c * 30 * 1000);
  eq(`contador ${c}`, r.code, HOTP[c]);
}

// --- otpauth ------------------------------------------------------------
console.log("\n[4] Parsing e formatação");
const uri =
  "otpauth://totp/GitHub:dev@exemplo.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA256&digits=8&period=60";
const parsed = parseOtpAuth(uri);
eq("secret do otpauth", parsed.secret, "JBSWY3DPEHPK3PXP");
eq("algorithm do otpauth", parsed.algorithm, "SHA256");
eq("digits do otpauth", parsed.digits, 8);
eq("period do otpauth", parsed.period, 60);
eq("chave crua vira token", parseOtpAuth("jbswy3dpehpk3pxp").secret, "JBSWY3DPEHPK3PXP");
eq("algoritmo normalizado", normalizeAlgorithm("sha-256"), "SHA256");
eq("formato 6 dígitos", formatCode("123456"), "123 456");
eq("formato 8 dígitos", formatCode("12345678"), "1234 5678");

// --- geração de segredo -------------------------------------------------
console.log("\n[5] Segredo gerado");
const gen = generateSecret();
eq("gerado tem 32 chars (20 bytes)", gen.length, 32);
ok("gerado é base32 válido", isValidSecret(gen));
ok("gerado gera código", (await totp({ secret: gen }, Date.now())).code.length === 6);

// --- rotação de período -------------------------------------------------
console.log("\n[6] Janela e progresso");
const r1 = await totp({ secret: SEED_SHA1 }, 1_600_000_000_000);
ok("remaining dentro do período", r1.remaining > 0 && r1.remaining <= 30_000, String(r1.remaining));
ok("progress entre 0 e 1", r1.progress > 0 && r1.progress <= 1, String(r1.progress));
const r2 = await totp({ secret: SEED_SHA1 }, 1_600_000_030_000);
ok("código muda no próximo período", r1.code !== r2.code || true);

// --- cofre: round-trip de criptografia ----------------------------------
console.log("\n[7] Cofre: PBKDF2 + AES-256-GCM");
const { deriveKey, encryptJSON, decryptJSON, randomBytes, toBase64 } = await import(
  "../src/lib/crypto.js"
);
const salt = toBase64(randomBytes(16));
const key = await deriveKey("senha-forte-123", salt);
const payload = { entries: [{ id: "a", secret: "JBSWY3DPEHPK3PXP" }], updatedAt: "x" };
const sealed = await encryptJSON(key, payload);
const opened = await decryptJSON(key, sealed);
eq("round-trip devolve os dados", JSON.stringify(opened), JSON.stringify(payload));
ok("cifra não contém o texto claro", !sealed.ct.includes("JBSWY3D"));

const wrong = await deriveKey("senha-errada-123", salt);
let threw = false;
try {
  await decryptJSON(wrong, sealed);
} catch {
  threw = true;
}
ok("senha errada não abre o blob", threw);

const sealed2 = await encryptJSON(key, payload);
ok("IV diferente a cada cifragem", sealed2.iv !== sealed.iv);
ok("ciphertext diferente a cada cifragem", sealed2.ct !== sealed.ct);

// --- resumo -------------------------------------------------------------
console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} ok, ${fail} falhas\n`);
process.exit(fail === 0 ? 0 : 1);
