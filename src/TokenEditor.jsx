// Modal de adicionar/editar token — cola otpauth://, chave manual ou QR de imagem.

import { useMemo, useRef, useState } from "react";
import { parseOtpAuth } from "./lib/totp.js";
import { generateSecret } from "./lib/secret.js";
import { isValidSecret } from "./lib/base32.js";
import { readQrFromFile } from "./lib/qr.js";
import { buildOtpAuthUri, totp } from "./lib/totp.js";
import { Field, SecretInput, Sheet } from "./components/ui.jsx";
import {
  IconCheck,
  IconKey,
  IconUpload,
  IconX,
  IconAlert,
} from "./components/icons.jsx";

const EMPTY = {
  issuer: "",
  account: "",
  secret: "",
  digits: 6,
  period: 30,
  algorithm: "SHA1",
  note: "",
};

export default function TokenEditor({ token, onClose, onSave, onDelete }) {
  const editing = !!token;
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...(token
      ? {
          issuer: token.issuer,
          account: token.account,
          secret: token.secret,
          digits: token.digits,
          period: token.period,
          algorithm: token.algorithm,
          note: token.note || "",
        }
      : {}),
  }));
  const [raw, setRaw] = useState("");
  const [mode, setMode] = useState("link");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const secretOk = useMemo(() => isValidSecret(form.secret), [form.secret]);

  // ------ importação por link / chave crua ------
  const applyRaw = (text) => {
    setRaw(text);
    setError("");
    if (!text.trim()) return;
    try {
      const parsed = parseOtpAuth(text);
      if (!isValidSecret(parsed.secret)) {
        setError("A chave tem poucos caracteres ou um caractere inválido.");
        return;
      }
      const isUri = /^otpauth:\/\//i.test(text.trim());
      let issuer = form.issuer;
      let account = form.account;
      if (isUri) {
        const url = new URL(text.trim().replace(/^otpauth:\/\/totp/i, "https://t"));
        const label = decodeURIComponent(url.pathname.replace(/^\//, ""));
        const [labelIssuer, labelAccount] = label.includes(":")
          ? [label.split(":")[0], label.split(":").slice(1).join(":")]
          : ["", label];
        issuer = url.searchParams.get("issuer") || labelIssuer || issuer;
        account = labelAccount || account;
      }
      set({ ...parsed, issuer, account });
      setPreview(parsed.secret);
    } catch (err) {
      setError(err.message);
    }
  };

  const generate = () => {
    const secret = generateSecret();
    set({ secret });
    setPreview(secret);
    setRaw("");
    setError("");
  };

  const loadQr = async (file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const text = await readQrFromFile(file);
      if (!/^otpauth:\/\//i.test(text)) {
        setError("O QR não é um link otpauth://.");
      } else {
        applyRaw(text);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ------ salvar ------
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!isValidSecret(form.secret)) {
      setError("Informe uma chave Base32 válida (mínimo 16 caracteres).");
      return;
    }
    setBusy(true);
    try {
      // confere se o segredo gera código antes de gravar
      await totp(form, Date.now());
    } catch {
      setError("Esse segredo não gera código. Confira a chave.");
      setBusy(false);
      return;
    }
    await onSave({
      issuer: form.issuer.trim() || "Sem nome",
      account: form.account.trim(),
      secret: form.secret.trim().toUpperCase(),
      digits: Number(form.digits),
      period: Number(form.period),
      algorithm: form.algorithm,
      note: form.note.trim(),
    });
    setBusy(false);
    onClose();
  };

  const deleteNow = async () => {
    setBusy(true);
    await onDelete(token.id);
    setBusy(false);
    onClose();
  };

  const uri = form.secret && isValidSecret(form.secret) ? buildOtpAuthUri(form) : "";

  return (
    <Sheet
      title={editing ? "Editar token" : "Adicionar 2FA"}
      icon={<IconKey style={{ width: 15, height: 15, color: "var(--acc)" }} />}
      onClose={onClose}
      footer={
        <>
          {editing ? (
            confirmDelete ? (
              <button className="btn btn--danger" onClick={deleteNow} disabled={busy}>
                <IconAlert /> confirmar exclusão
              </button>
            ) : (
              <button className="btn btn--danger" onClick={() => setConfirmDelete(true)}>
                excluir
              </button>
            )
          ) : null}
          <button
            className="btn btn--primary"
            onClick={submit}
            disabled={busy || !secretOk}
          >
            <IconCheck /> {editing ? "salvar" : "adicionar"}
          </button>
        </>
      }
    >
      {!editing ? (
        <div className="seg" role="tablist">
          <button aria-pressed={mode === "link"} onClick={() => setMode("link")}>
            link / texto
          </button>
          <button aria-pressed={mode === "manual"} onClick={() => setMode("manual")}>
            manual
          </button>
        </div>
      ) : null}

      {!editing && mode === "link" ? (
        <>
          <Field
            label="cole o otpauth:// ou a chave"
            hint="No site, escolha configurar autenticador e exiba a chave. Cole aqui."
          >
            <textarea
              className="input mono"
              style={{ height: 74, padding: "9px 11px", resize: "none", lineHeight: 1.4 }}
              value={raw}
              onChange={(e) => applyRaw(e.target.value)}
              placeholder="otpauth://totp/Banco:voce@email.com?secret=JBSWY3DP…"
              spellCheck={false}
            />
          </Field>

          <div className="picker">
            <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
              <IconUpload /> ler QR de imagem
            </button>
            <button type="button" className="btn" onClick={generate}>
              <IconKey /> gerar chave nova
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr"
              onChange={(e) => loadQr(e.target.files?.[0])}
            />
          </div>
        </>
      ) : null}

      <div className="cols-2">
        <Field label="serviço" htmlFor="issuer">
          <input
            id="issuer"
            className="input"
            value={form.issuer}
            onChange={(e) => set({ issuer: e.target.value })}
            placeholder="GitHub"
            autoComplete="off"
          />
        </Field>
        <Field label="conta" htmlFor="account">
          <input
            id="account"
            className="input"
            value={form.account}
            onChange={(e) => set({ account: e.target.value })}
            placeholder="voce@email.com"
            autoComplete="off"
          />
        </Field>
      </div>

      <Field
        label="chave secreta (base32)"
        htmlFor="secret"
        hint={secretOk ? "chave válida" : "A-Z e 2-7, sem espaços. Mínimo 16 caracteres."}
      >
        <SecretInput
          id="secret"
          value={form.secret}
          onChange={(v) => {
            set({ secret: v });
            setPreview(v);
          }}
          placeholder="JBSWY3DPEHPK3PXP"
        />
      </Field>

      <details className="adv">
        <summary>avançado</summary>
        <div className="adv__body">
          <div className="cols-3">
            <Field label="dígitos" htmlFor="digits">
              <select
                id="digits"
                className="select"
                value={form.digits}
                onChange={(e) => set({ digits: Number(e.target.value) })}
              >
                <option value={6}>6</option>
                <option value={8}>8</option>
              </select>
            </Field>
            <Field label="período" htmlFor="period">
              <select
                id="period"
                className="select"
                value={form.period}
                onChange={(e) => set({ period: Number(e.target.value) })}
              >
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={15}>15s</option>
              </select>
            </Field>
            <Field label="hash" htmlFor="algorithm">
              <select
                id="algorithm"
                className="select"
                value={form.algorithm}
                onChange={(e) => set({ algorithm: e.target.value })}
              >
                <option value="SHA1">SHA-1</option>
                <option value="SHA256">SHA-256</option>
                <option value="SHA512">SHA-512</option>
              </select>
            </Field>
          </div>
          <Field label="nota" htmlFor="note">
            <input
              id="note"
              className="input"
              value={form.note}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="opcional"
              autoComplete="off"
            />
          </Field>
        </div>
      </details>

      {uri && editing ? (
        <p className="hint mono" style={{ wordBreak: "break-all", fontSize: 10, lineHeight: 1.45 }}>
          {uri}
        </p>
      ) : null}

      {error ? (
        <p className="err" style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
          <IconX style={{ width: 13, height: 13, flex: "none", marginTop: 2 }} />
          {error}
        </p>
      ) : null}
    </Sheet>
  );
}
