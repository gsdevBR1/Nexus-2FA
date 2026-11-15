// Ajustes: auto-lock, mascarar códigos, backup, troca de senha, zerar cofre.

import { useRef, useState } from "react";
import {
  exportEncryptedBackup,
  exportOtpAuthList,
  updateSettings,
  wipeVault,
} from "./lib/vault.js";
import { buildOtpAuthUri } from "./lib/totp.js";
import { copyText } from "./lib/storage.js";
import { Field, Sheet } from "./components/ui.jsx";
import { IconAlert, IconCheck, IconDownload, IconGear, IconTrash } from "./components/icons.jsx";

function download(name, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function SettingsSheet({
  meta,
  entries,
  masked,
  onToggleMask,
  onSaved,
  onPassword,
  onWiped,
  onClose,
  push,
}) {
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [wipeArmed, setWipeArmed] = useState(false);
  const importRef = useRef(null);

  const autoLock = meta?.settings?.autoLockMinutes ?? 5;

  const saveLock = async (minutes) => {
    await updateSettings(meta, { autoLockMinutes: minutes });
    onSaved({ ...meta, settings: { ...meta.settings, autoLockMinutes: minutes } });
    push(`<b>auto-bloqueio</b> em ${minutes || "∞"} min`);
  };

  const backupJson = async () => {
    const text = await exportEncryptedBackup(entries);
    download(`nexus-2fa-backup-${new Date().toISOString().slice(0, 10)}.json`, text);
    push(`<b>backup</b> exportado`);
  };

  const backupUris = async () => {
    const text = exportOtpAuthList(entries, (e) => buildOtpAuthUri(e));
    download(`nexus-2fa-otpauth-${new Date().toISOString().slice(0, 10)}.txt`, text, "text/plain");
    push(`<b>${entries.length}</b> links otpauth exportados`);
  };

  const importJson = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data?.kind !== "nexus-2fa-backup" || !Array.isArray(data.entries)) {
        throw new Error("Arquivo não é um backup do Nexus 2FA.");
      }
      await onPassword({ importEntries: data.entries });
    } catch (err) {
      push(err.message, "err");
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwErr("");
    if (pw.length < 8) {
      setPwErr("Mínimo 8 caracteres.");
      return;
    }
    if (pw !== pw2) {
      setPwErr("As senhas não batem.");
      return;
    }
    setBusy(true);
    try {
      await onPassword({ newPassword: pw });
      push(`<b>senha</b> atualizada`);
      setPw("");
      setPw2("");
      setPwOpen(false);
    } catch (err) {
      setPwErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  const wipe = async () => {
    setBusy(true);
    await wipeVault();
    setBusy(false);
    onWiped();
  };

  return (
    <Sheet
      title="Ajustes"
      icon={<IconGear style={{ width: 15, height: 15, color: "var(--text-3)" }} />}
      onClose={onClose}
    >
      <div className="set-group">
        <p className="eyebrow">segurança</p>

        <div className="set-row">
          <div>
            <b>Mascarar códigos</b>
            <small>Só mostra o código ao clicar no olho</small>
          </div>
          <button
            className={`switch${masked ? " is-on" : ""}`}
            role="switch"
            aria-checked={masked}
            onClick={onToggleMask}
            aria-label="Mascarar códigos"
          >
            <span />
          </button>
        </div>

        <div className="set-row">
          <div>
            <b>Auto-bloqueio</b>
            <small>Sela o cofre após inatividade</small>
          </div>
          <select
            className="select set-select"
            value={autoLock}
            onChange={(e) => saveLock(Number(e.target.value))}
            aria-label="Tempo de auto-bloqueio"
          >
            <option value={1}>1 min</option>
            <option value={5}>5 min</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={0}>nunca</option>
          </select>
        </div>

        {!pwOpen ? (
          <button className="btn set-wide" onClick={() => setPwOpen(true)}>
            trocar senha mestra
          </button>
        ) : (
          <form className="set-pw" onSubmit={submitPassword}>
            <Field label="nova senha" htmlFor="npw">
              <input
                id="npw"
                className="input"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="new-password"
                autoFocus
              />
            </Field>
            <Field label="confirmar" htmlFor="npw2">
              <input
                id="npw2"
                className="input"
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            {pwErr ? <p className="err">{pwErr}</p> : null}
            <div className="set-pw__actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPwOpen(false);
                  setPwErr("");
                }}
              >
                cancelar
              </button>
              <button className="btn btn--primary" type="submit" disabled={busy}>
                <IconCheck /> trocar
              </button>
            </div>
          </form>
        )}
      </div>

      <hr className="hr" />

      <div className="set-group">
        <p className="eyebrow">backup · {entries.length} tokens</p>
        <button className="btn set-wide" onClick={backupJson}>
          <IconDownload /> exportar backup (.json)
        </button>
        <button className="btn set-wide" onClick={backupUris}>
          <IconDownload /> exportar otpauth (.txt)
        </button>
        <button className="btn set-wide" onClick={() => importRef.current?.click()}>
          <IconDownload style={{ transform: "rotate(180deg)" }} /> importar backup
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="sr"
          onChange={(e) => importJson(e.target.files?.[0])}
        />
        <button
          className="btn set-wide"
          onClick={async () => {
            const text = await exportEncryptedBackup(entries);
            const ok = await copyText(text);
            push(ok ? `<b>backup</b> copiado` : "não foi possível copiar", ok ? "ok" : "err");
          }}
        >
          copiar backup para a área de transferência
        </button>
      </div>

      <hr className="hr" />

      <div className="set-group">
        <p className="eyebrow">zona de risco</p>
        {!wipeArmed ? (
          <button className="btn btn--danger set-wide" onClick={() => setWipeArmed(true)}>
            <IconTrash /> apagar todos os tokens
          </button>
        ) : (
          <>
            <p className="hint" style={{ color: "var(--danger)" }}>
              Isso apaga o cofre inteiro deste navegador. Sem volta.
            </p>
            <div className="cols-2">
              <button className="btn" onClick={() => setWipeArmed(false)}>
                cancelar
              </button>
              <button className="btn btn--danger" onClick={wipe} disabled={busy}>
                <IconAlert /> apagar tudo
              </button>
            </div>
          </>
        )}
      </div>

      <p className="set-about">
        <b>Nexus 2FA</b> · AES-256-GCM · PBKDF2 310k
        <br />
        Chaves ficam só neste dispositivo. Faça backup.
      </p>
    </Sheet>
  );
}
