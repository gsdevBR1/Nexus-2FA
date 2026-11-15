// Gera segredos aleatórios em Base32 — para cadastrar uma conta nova
// ou testar o cofre. 20 bytes = 160 bits (padrão do Google Authenticator).

import { base32Encode } from "./base32.js";

export function generateSecret(bytes = 20) {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return base32Encode(buf);
}
