// Motor TOTP — RFC 6238 (HMAC-OTP do RFC 4226). Sem dependências externas.
// Suporta SHA-1/256/512, 6 e 8 dígitos, período configurável.

import { base32Decode } from "./base32.js";

const HASH_ALG = { SHA1: "SHA-1", SHA256: "SHA-256", SHA512: "SHA-512" };

function subtle() {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("WebCrypto indisponível neste contexto.");
  return c.subtle;
}

export function normalizeAlgorithm(alg) {
  const key = String(alg || "SHA1")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return HASH_ALG[key] ? key : "SHA1";
}

/** Contador de 8 bytes big-endian (RFC 4226 §5.2). */
function counterBytes(counter) {
  const buf = new Uint8Array(8);
  let n = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return buf;
}

/**
 * Código TOTP para um instante.
 * @param {object} token  { secret (base32), digits, period, algorithm }
 * @param {number} [nowMs] instante em ms
 */
export async function totp(token, nowMs = Date.now()) {
  const period = Number(token.period) || 30;
  const digits = Number(token.digits) || 6;
  const algorithm = HASH_ALG[normalizeAlgorithm(token.algorithm)];
  const secret = base32Decode(token.secret);
  if (!secret.length) throw new Error("Segredo vazio.");

  const counter = Math.floor(nowMs / 1000 / period);

  const key = await subtle().importKey(
    "raw",
    secret,
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"]
  );
  const mac = new Uint8Array(
    await subtle().sign("HMAC", key, counterBytes(counter))
  );

  // Truncamento dinâmico (RFC 4226 §5.4).
  const offset = mac[mac.length - 1] & 0x0f;
  const binary =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);

  const code = String(binary % 10 ** digits).padStart(digits, "0");
  const periodMs = period * 1000;
  const remaining = periodMs - (nowMs % periodMs);

  return { code, remaining, period, progress: remaining / periodMs };
}

/** Agrupa "123456" -> "123 456" para leitura. */
export function formatCode(code) {
  if (code.length === 8) return `${code.slice(0, 4)} ${code.slice(4)}`;
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

/** Importa otpauth:// ou URL do Google Authenticator (com parâmetro secret). */
export function parseOtpAuth(raw) {
  const text = String(raw || "").trim();
  if (!text) throw new Error("Cole o link otpauth:// ou a chave em Base32.");

  const isUri = /^otpauth:\/\//i.test(text);
  if (!isUri) {
    return {
      secret: text.toUpperCase().replace(/[\s\-=]/g, ""),
      digits: 6,
      period: 30,
      algorithm: "SHA1",
    };
  }

  const url = new URL(text.replace(/^otpauth:\/\/totp/i, "https://t"));
  const p = url.searchParams;
  const secret = p.get("secret");
  if (!secret) throw new Error("O link não tem parâmetro secret=.");

  return {
    secret: secret.toUpperCase().replace(/[\s\-=]/g, ""),
    digits: Number(p.get("digits") || 6),
    period: Number(p.get("period") || 30),
    algorithm: normalizeAlgorithm(p.get("algorithm") || "SHA1"),
  };
}

/** Converte token em URI otpauth:// (para exportar/QR). */
export function buildOtpAuthUri(entry, issuer) {
  const label = encodeURIComponent(
    `${entry.issuer || issuer || "Nexus"}:${entry.account || entry.name || "conta"}`
  );
  const params = new URLSearchParams({
    secret: entry.secret,
    digits: String(entry.digits || 6),
    period: String(entry.period || 30),
    algorithm: normalizeAlgorithm(entry.algorithm),
  });
  if (entry.issuer) params.set("issuer", entry.issuer);
  return `otpauth://totp/${label}?${params.toString()}`;
}
