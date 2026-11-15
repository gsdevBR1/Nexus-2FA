// Cofre criptográfico — PBKDF2-SHA256 (310k iterações) + AES-256-GCM.
// A senha nunca sai do dispositivo; só o blob cifrado vai para o storage.

const KDF = {
  name: "PBKDF2",
  hash: "SHA-256",
  iterations: 310000,
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function subtle() {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("WebCrypto indisponível neste contexto.");
  return c.subtle;
}

export function randomBytes(length) {
  const buf = new Uint8Array(length);
  globalThis.crypto.getRandomValues(buf);
  return buf;
}

export function toBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function fromBase64(text) {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Deriva a chave AES a partir da senha. */
export async function deriveKey(password, saltB64, iterations = KDF.iterations) {
  const base = await subtle().importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return subtle().deriveKey(
    { name: "PBKDF2", salt: fromBase64(saltB64), iterations, hash: KDF.hash },
    base,
    { name: "AES-GCM", length: 256 },
    true, // extractable: precisa serializar para o storage.session
    ["encrypt", "decrypt"]
  );
}

export async function exportRawKey(key) {
  const raw = await subtle().exportKey("raw", key);
  return toBase64(new Uint8Array(raw));
}

export async function importRawKey(b64) {
  const raw = fromBase64(b64);
  return subtle().importKey("raw", raw, { name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptJSON(key, value) {
  const iv = randomBytes(12);
  const plaintext = encoder.encode(JSON.stringify(value));
  const ct = new Uint8Array(
    await subtle().encrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, plaintext)
  );
  return { iv: toBase64(iv), ct: toBase64(ct) };
}

export async function decryptJSON(key, payload) {
  const plain = await subtle().decrypt(
    { name: "AES-GCM", iv: fromBase64(payload.iv), tagLength: 128 },
    key,
    fromBase64(payload.ct)
  );
  return JSON.parse(decoder.decode(plain));
}

export const KDF_ITERATIONS = KDF.iterations;
