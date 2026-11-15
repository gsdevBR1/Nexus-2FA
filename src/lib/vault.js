// Persistência do cofre. Um blob cifrado, um MetaAuth para verificar senha,
// e uma chave de sessão para não pedir senha a cada popup aberto.

import {
  decryptJSON,
  deriveKey,
  encryptJSON,
  exportRawKey,
  importRawKey,
  KDF_ITERATIONS,
  randomBytes,
  toBase64,
} from "./crypto.js";
import { localStore, sessionStore } from "./storage.js";

const META_KEY = "nexus.meta";
const DATA_KEY = "nexus.vault";
const SESSION_KEY = "nexus.session";
const CHECK_TOKEN = "nexus-vault-ok";

export const VAULT_VERSION = 1;

const nowISO = () => new Date().toISOString();

export async function readMeta() {
  return (await localStore.get(META_KEY)) || null;
}

export async function vaultExists() {
  const meta = await readMeta();
  return !!meta?.salt;
}

/** Cria o cofre do zero. */
export async function createVault(password, entries = [], settings = {}) {
  const salt = toBase64(randomBytes(16));
  const key = await deriveKey(password, salt);
  const check = await encryptJSON(key, CHECK_TOKEN);
  const meta = {
    version: VAULT_VERSION,
    salt,
    iterations: KDF_ITERATIONS,
    check,
    createdAt: nowISO(),
    settings: { autoLockMinutes: 5, ...settings },
  };
  await localStore.set(META_KEY, meta);
  await writeEntries(key, entries);
  await writeSessionKey(key, meta.settings.autoLockMinutes);
  return { key, meta, entries };
}

/** Verifica a senha abrindo o token de checagem e depois os dados. */
export async function unlockVault(password) {
  const meta = await readMeta();
  if (!meta?.salt) throw new Error("Nenhum cofre encontrado.");
  const key = await deriveKey(password, meta.salt, meta.iterations || KDF_ITERATIONS);

  try {
    const token = await decryptJSON(key, meta.check);
    if (token !== CHECK_TOKEN) throw new Error("Senha incorreta.");
  } catch {
    throw new Error("Senha incorreta.");
  }

  const entries = await readEntries(key);
  await writeSessionKey(key, meta.settings?.autoLockMinutes ?? 5);
  return { key, meta, entries };
}

export async function readEntries(key) {
  const blob = await localStore.get(DATA_KEY);
  if (!blob) return [];
  try {
    const data = await decryptJSON(key, blob);
    return Array.isArray(data.entries) ? data.entries : [];
  } catch {
    throw new Error("Não foi possível decifrar o cofre com esta chave.");
  }
}

export async function writeEntries(key, entries) {
  const blob = await encryptJSON(key, { entries, updatedAt: nowISO() });
  await localStore.set(DATA_KEY, blob);
}

export async function updateSettings(meta, settings) {
  const next = { ...meta, settings: { ...meta.settings, ...settings } };
  await localStore.set(META_KEY, next);
  return next;
}

/** Troca de senha: re-deriva chave, re-cifra tudo com salt novo. */
export async function changePassword(currentKey, newPassword, entries) {
  const salt = toBase64(randomBytes(16));
  const key = await deriveKey(newPassword, salt);
  const check = await encryptJSON(key, CHECK_TOKEN);
  const prev = await readMeta();
  const meta = {
    ...prev,
    salt,
    iterations: KDF_ITERATIONS,
    check,
    updatedAt: nowISO(),
  };
  await writeEntries(key, entries);
  await localStore.set(META_KEY, meta);
  await writeSessionKey(key, meta.settings?.autoLockMinutes ?? 5);
  void currentKey;
  return { key, meta };
}

// --- sessão -------------------------------------------------------------

export async function writeSessionKey(key, minutes = 5) {
  try {
    const raw = await exportRawKey(key);
    await sessionStore.set(SESSION_KEY, {
      raw,
      expiresAt: Date.now() + Math.max(0, minutes) * 60_000,
    });
  } catch {
    /* key não-extractable: segue sem sessão */
  }
}

/** Recupera a chave da sessão se ainda estiver dentro da janela. */
export async function readSessionKey() {
  const data = await sessionStore.get(SESSION_KEY);
  if (!data?.raw) return null;
  if (data.expiresAt && Date.now() > data.expiresAt) {
    await sessionStore.remove(SESSION_KEY);
    return null;
  }
  try {
    return await importRawKey(data.raw);
  } catch {
    return null;
  }
}

export async function touchSession(minutes) {
  const data = await sessionStore.get(SESSION_KEY);
  if (!data?.raw) return;
  await sessionStore.set(SESSION_KEY, {
    raw: data.raw,
    expiresAt: Date.now() + Math.max(0, minutes) * 60_000,
  });
}

export async function clearSession() {
  await sessionStore.remove(SESSION_KEY);
}

/** Apaga tudo. Irreversível — usado em "zerar cofre". */
export async function wipeVault() {
  await localStore.remove(DATA_KEY);
  await localStore.remove(META_KEY);
  await clearSession();
}

// --- backup -------------------------------------------------------------

export async function exportEncryptedBackup(entries) {
  return JSON.stringify(
    {
      kind: "nexus-2fa-backup",
      version: VAULT_VERSION,
      exportedAt: nowISO(),
      entries,
    },
    null,
    2
  );
}

export function exportOtpAuthList(entries, buildUri) {
  return entries.map((entry) => buildUri(entry)).join("\n");
}
