// Base32 (RFC 4648) — alfabeto de segredo TOTP. Tolerante: ignora espaços,
// hífens e padding, aceita minúsculas. É a única "decodificação" do motor.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const LOOKUP = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) t[ALPHABET.charCodeAt(i)] = i;
  return t;
})();

/** @param {string} input @returns {Uint8Array} */
export function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/[\s\-_=]/g, "");
  if (!clean) return new Uint8Array(0);

  let bits = 0;
  let value = 0;
  const out = [];

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const idx = code < 128 ? LOOKUP[code] : -1;
    if (idx === -1) throw new Error(`Base32 inválido: caractere "${clean[i]}"`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Valida o comprimento útil de um segredo: precisa virar >= 10 bytes. */
export function isValidSecret(secret) {
  try {
    return base32Decode(secret).length >= 10;
  } catch {
    return false;
  }
}
