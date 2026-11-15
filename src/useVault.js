// Estado do cofre: criação, desbloqueio, CRUD de tokens, re-cifragem e auto-lock.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { totp } from "./lib/totp.js";
import {
  changePassword as changePasswordApi,
  clearSession,
  createVault,
  readEntries,
  readMeta,
  readSessionKey,
  touchSession,
  unlockVault,
  updateSettings,
  writeEntries,
  writeSessionKey,
} from "./lib/vault.js";

export const STATUS = {
  LOADING: "loading",
  NEW: "new",
  LOCKED: "locked",
  OPEN: "open",
};

const uid = () =>
  `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function newToken(fields = {}) {
  return {
    id: uid(),
    issuer: fields.issuer?.trim() || "Sem nome",
    account: fields.account?.trim() || "",
    secret: fields.secret,
    digits: fields.digits || 6,
    period: fields.period || 30,
    algorithm: fields.algorithm || "SHA1",
    note: fields.note?.trim() || "",
    createdAt: new Date().toISOString(),
  };
}

export function useVault() {
  const [status, setStatus] = useState(STATUS.LOADING);
  const [entries, setEntries] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const keyRef = useRef(null);
  const lastActivity = useRef(Date.now());

  // --- boot -------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await readMeta();
      if (!alive) return;
      if (!stored?.salt) {
        setStatus(STATUS.NEW);
        return;
      }
      setMeta(stored);
      const sessionKey = await readSessionKey();
      if (!alive) return;
      if (sessionKey) {
        try {
          const list = await readEntries(sessionKey);
          if (!alive) return;
          keyRef.current = sessionKey;
          setEntries(list);
          setStatus(STATUS.OPEN);
          return;
        } catch {
          await clearSession();
        }
      }
      setStatus(STATUS.LOCKED);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // --- persistência -----------------------------------------------------
  const persist = useCallback(async (next) => {
    setEntries(next);
    if (keyRef.current) await writeEntries(keyRef.current, next);
    return next;
  }, []);

  // --- sessão -----------------------------------------------------------
  const markActivity = useCallback(() => {
    lastActivity.current = Date.now();
    const minutes = meta?.settings?.autoLockMinutes ?? 5;
    void touchSession(minutes);
  }, [meta]);

  const lock = useCallback(async () => {
    keyRef.current = null;
    await clearSession();
    setEntries([]);
    setStatus(STATUS.LOCKED);
  }, []);

  // auto-lock por inatividade (só dentro desta página)
  useEffect(() => {
    if (status !== STATUS.OPEN) return undefined;
    const minutes = Number(meta?.settings?.autoLockMinutes ?? 5);
    if (!minutes) return undefined;
    const id = setInterval(() => {
      if (Date.now() - lastActivity.current > minutes * 60_000) void lock();
    }, 5000);
    return () => clearInterval(id);
  }, [status, meta, lock]);

  // --- ações ------------------------------------------------------------
  const setup = useCallback(async (password, seedTokens = []) => {
    const made = await createVault(password, seedTokens);
    keyRef.current = made.key;
    setMeta(made.meta);
    setEntries(made.entries);
    setStatus(STATUS.OPEN);
    lastActivity.current = Date.now();
  }, []);

  const unlock = useCallback(async (password) => {
    setError("");
    try {
      const opened = await unlockVault(password);
      keyRef.current = opened.key;
      setMeta(opened.meta);
      setEntries(opened.entries);
      setStatus(STATUS.OPEN);
      lastActivity.current = Date.now();
      return true;
    } catch (err) {
      setError(err?.message || "Falha ao abrir.");
      return false;
    }
  }, []);

  const addToken = useCallback(
    async (fields) => {
      const token = newToken(fields);
      await persist([...entries, token]);
      markActivity();
      return token;
    },
    [entries, persist, markActivity]
  );

  const updateToken = useCallback(
    async (id, fields) => {
      const next = entries.map((t) => (t.id === id ? { ...t, ...fields, id } : t));
      await persist(next);
      markActivity();
    },
    [entries, persist, markActivity]
  );

  const removeToken = useCallback(
    async (id) => {
      await persist(entries.filter((t) => t.id !== id));
      markActivity();
    },
    [entries, persist, markActivity]
  );

  const reorder = useCallback(
    async (fromId, toId) => {
      if (fromId === toId) return;
      const list = [...entries];
      const from = list.findIndex((t) => t.id === fromId);
      const to = list.findIndex((t) => t.id === toId);
      if (from < 0 || to < 0) return;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      await persist(list);
    },
    [entries, persist]
  );

  const saveSettings = useCallback(
    async (patch) => {
      const base = meta || (await readMeta());
      const next = await updateSettings(base, patch);
      setMeta(next);
      if (keyRef.current && patch.autoLockMinutes != null) {
        await writeSessionKey(keyRef.current, patch.autoLockMinutes);
      }
      return next;
    },
    [meta]
  );

  const changePassword = useCallback(
    async (newPassword) => {
      if (!keyRef.current) throw new Error("Cofre bloqueado.");
      const res = await changePasswordApi(keyRef.current, newPassword, entries);
      keyRef.current = res.key;
      setMeta(res.meta);
      return true;
    },
    [entries]
  );

  const replaceAll = useCallback(
    async (list) => {
      await persist(list);
      markActivity();
    },
    [persist, markActivity]
  );

  return {
    status,
    entries,
    meta,
    error,
    setError,
    setup,
    unlock,
    lock,
    addToken,
    updateToken,
    removeToken,
    reorder,
    saveSettings,
    changePassword,
    replaceAll,
    markActivity,
  };
}

/** Hook que mantém códigos TOTP atualizados a cada segundo. */
export function useCodes(entries) {
  const [tick, setTick] = useState(() => Date.now());
  const [codes, setCodes] = useState({});

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const signature = useMemo(
    () => entries.map((t) => `${t.id}:${t.secret}:${t.digits}:${t.period}:${t.algorithm}`).join("|"),
    [entries]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const next = {};
      await Promise.all(
        entries.map(async (token) => {
          try {
            next[token.id] = await totp(token, tick);
          } catch {
            next[token.id] = null;
          }
        })
      );
      if (alive) setCodes(next);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, tick]);

  return codes;
}
