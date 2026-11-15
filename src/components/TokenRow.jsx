// Linha de token: avatar, código, anel de contagem, copiar e menu de contexto.

import { useEffect, useRef, useState } from "react";
import { formatCode } from "../lib/totp.js";
import { IconCheck, IconCopy } from "./icons.jsx";

const TONES = [
  "linear-gradient(180deg,#123b33,#0a1f1c)",
  "linear-gradient(180deg,#132c40,#0a1622)",
  "linear-gradient(180deg,#1d2937,#0d141c)",
  "linear-gradient(180deg,#243026,#0e1a13)",
  "linear-gradient(180deg,#2b2135,#160f1d)",
];

function toneFor(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

function initials(token) {
  const source = (token.issuer || token.account || "?").trim();
  const words = source.split(/[\s._-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function Ring({ progress, warn }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg className={`ring${warn ? " is-warn" : ""}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="ring__track" cx="12" cy="12" r={r} />
      <circle
        className="ring__bar"
        cx="12"
        cy="12"
        r={r}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))}
      />
    </svg>
  );
}

export default function TokenRow({
  token,
  code,
  masked,
  copied,
  onCopy,
  onOpen,
}) {
  const [flash, setFlash] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = code?.code ?? "";
  const remaining = code?.remaining ?? 0;
  const warn = !!code && remaining <= 5000;
  const progress = code?.progress ?? 0;

  const handleCopy = (e) => {
    e.stopPropagation();
    if (!value) return;
    onCopy(value, token);
    setFlash(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(false), 1200);
  };

  return (
    <div
      className={`row${warn ? " row--warn" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(token)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(token);
        }
        if (e.key.toLowerCase() === "c" && (e.ctrlKey || e.metaKey) && value) {
          e.preventDefault();
          onCopy(value, token);
        }
      }}
      title={`${token.issuer}${token.account ? " — " + token.account : ""}`}
    >
      <div className="row__avatar" style={{ background: toneFor(token.issuer + token.account) }}>
        {initials(token)}
      </div>

      <div className="row__id">
        <span className="row__issuer">{token.issuer}</span>
        <span className="row__account">{token.account || "sem conta"}</span>
      </div>

      <div className="row__right">
        <span className={`code${masked ? " is-masked" : ""}`}>
          {value ? (masked ? "••• •••" : formatCode(value)) : "—— ——"}
        </span>
        <Ring progress={progress} warn={warn} />
        <button
          className={`row__copy${flash || copied ? " is-done" : ""}`}
          onClick={handleCopy}
          aria-label={`Copiar código de ${token.issuer}`}
          tabIndex={-1}
        >
          {flash || copied ? <IconCheck /> : <IconCopy />}
        </button>
      </div>
    </div>
  );
}
