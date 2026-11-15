// Janela do cofre — visão ampla, cards em grid, busca, filtro e painel lateral.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STATUS, useCodes, useVault } from "../useVault.js";
import { formatCode, totp } from "../lib/totp.js";
import { copyText } from "../lib/storage.js";
import { LockScreen, SetupScreen } from "../Screens.jsx";
import TokenEditor from "../TokenEditor.jsx";
import SettingsSheet from "../SettingsSheet.jsx";
import Ground from "../components/Ground.jsx";
import { Toasts, useToasts } from "../components/Toasts.jsx";
import SpotlightCard from "../components/reactbits/SpotlightCard.jsx";
import {
  IconCopy,
  IconEye,
  IconEyeOff,
  IconGear,
  IconLock,
  IconPlus,
  IconSearch,
  IconShield,
  IconCheck,
  IconX,
  Mark,
} from "../components/icons.jsx";

const MASK_KEY = "nexus.masked";

function Card({ token, code, masked, onCopy, onOpen, copied }) {
  const value = code?.code ?? "";
  const warn = code && code.remaining <= 5000;
  return (
    <SpotlightCard
      className={`vcard${warn ? " vcard--warn" : ""}`}
      spotlightColor="rgba(92,242,196,0.55)"
      intensity={0.14}
      spotlightSize={280}
      borderGlow={0.55}
      ambient
      grain={0.12}
      onClick={() => onOpen(token)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(token);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${token.issuer} ${token.account}`}
    >
      <div className="vcard__top">
        <span className="vcard__issuer">{token.issuer}</span>
        <span className={`vcard__code${masked ? " is-masked" : ""}`}>
          {value ? (masked ? "••• •••" : formatCode(value)) : "—— ——"}
        </span>
        <span className="vcard__account">{token.account || "sem conta"}</span>
      </div>

      <div className="vcard__bar">
        <span
          className="vcard__progress"
          style={{ transform: `scaleX(${code?.progress ?? 0})` }}
        />
      </div>

      <div className="vcard__foot">
        <span className="vcard__time mono">{code ? `${Math.ceil(code.remaining / 1000)}s` : "—"}</span>
        <span style={{ flex: 1 }} />
        <button
          className="btn btn--ghost vcard__copy"
          onClick={(e) => {
            e.stopPropagation();
            onCopy(value, token);
          }}
          disabled={!value}
        >
          {copied ? <IconCheck /> : <IconCopy />}
          {copied ? "copiado" : "copiar"}
        </button>
      </div>
    </SpotlightCard>
  );
}

export default function VaultApp() {
  const vault = useVault();
  const { toasts, push } = useToasts();
  const [query, setQuery] = useState("");
  const [masked, setMasked] = useState(() => localStorage.getItem(MASK_KEY) === "1");
  const [editor, setEditor] = useState(null);
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [detail, setDetail] = useState(null);
  const searchRef = useRef(null);

  const codes = useCodes(vault.status === STATUS.OPEN ? vault.entries : []);

  useEffect(() => {
    localStorage.setItem(MASK_KEY, masked ? "1" : "0");
  }, [masked]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vault.entries;
    return vault.entries.filter((t) =>
      `${t.issuer} ${t.account} ${t.note || ""}`.toLowerCase().includes(q)
    );
  }, [vault.entries, query]);

  const handleCopy = useCallback(
    async (code, token) => {
      if (!code) return;
      vault.markActivity();
      const ok = await copyText(code);
      if (ok) {
        setCopiedId(token.id);
        setTimeout(() => setCopiedId(""), 1300);
        push(`<b>${formatCode(code)}</b> copiado`);
      }
    },
    [push, vault]
  );

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key.toLowerCase() === "n" && !typing && !e.metaKey && !e.ctrlKey && vault.status === STATUS.OPEN) {
        e.preventDefault();
        setEditor({ key: crypto.randomUUID() });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vault.status]);

  if (vault.status === STATUS.LOADING) {
    return (
      <div className="vshell">
        <Ground />
        <div className="center" style={{ height: "100vh" }}>
          <Mark size={34} className="mark mark--lg" />
        </div>
      </div>
    );
  }

  if (vault.status !== STATUS.OPEN) {
    return (
      <div className="vshell">
        <Ground />
        <div className="vshell__gate scroll">
          {vault.status === STATUS.NEW ? (
            <SetupScreen
              busy={busy}
              onCreate={async (pw) => {
                setBusy(true);
                await vault.setup(pw);
                setBusy(false);
              }}
            />
          ) : (
            <LockScreen
              busy={busy}
              onUnlock={async (pw) => {
                setBusy(true);
                const ok = await vault.unlock(pw);
                setBusy(false);
                return ok;
              }}
              onReset={async () => {
                if (!confirm("Apagar o cofre e todos os tokens? Não há recuperação.")) return;
                const { wipeVault } = await import("../lib/vault.js");
                await wipeVault();
                location.reload();
              }}
            />
          )}
        </div>
        <Toasts items={toasts} />
      </div>
    );
  }

  return (
    <div className="vshell">
      <Ground />

      <header className="vbar">
        <div className="vbar__brand">
          <Mark size={22} />
          <div>
            <b>Nexus 2FA</b>
            <span>cofre local · aes-256-gcm</span>
          </div>
        </div>

        <div className="vbar__search">
          <IconSearch />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="buscar serviço, conta ou nota"
            spellCheck={false}
            aria-label="Buscar tokens"
            type="search"
          />
          {query ? (
            <button className="search__clear" onClick={() => setQuery("")} aria-label="Limpar">
              <IconX />
            </button>
          ) : null}
        </div>

        <button
          className="btn btn--ghost btn--icon"
          onClick={() => setMasked((m) => !m)}
          aria-label={masked ? "Mostrar códigos" : "Mascarar códigos"}
        >
          {masked ? <IconEyeOff /> : <IconEye />}
        </button>
        <button className="btn btn--ghost btn--icon" onClick={() => setSettings(true)} aria-label="Ajustes">
          <IconGear />
        </button>
        <button className="btn btn--ghost btn--icon" onClick={() => vault.lock()} aria-label="Bloquear">
          <IconLock />
        </button>
        <button className="btn btn--primary" onClick={() => setEditor({ key: crypto.randomUUID() })}>
          <IconPlus /> adicionar
        </button>
      </header>

      <main className="vmain scroll">
        {filtered.length === 0 ? (
          vault.entries.length === 0 ? (
            <div className="vempty">
              <div className="vempty__glyph">
                <IconShield size={26} />
              </div>
              <h2>Seu cofre está vazio</h2>
              <p>
                Cole um link <span className="mono">otpauth://</span> de qualquer serviço, leia um QR
                de imagem ou digite a chave manualmente. Tudo fica cifrado aqui.
              </p>
              <button className="btn btn--primary" onClick={() => setEditor({ key: crypto.randomUUID() })}>
                <IconPlus /> adicionar primeiro token
              </button>
            </div>
          ) : (
            <div className="noresult">
              nada com <b>{query}</b>
            </div>
          )
        ) : (
          <>
            <div className="vsection">
              <p className="eyebrow">{query ? "resultado" : "todos os tokens"}</p>
              <em>
                {filtered.length} de {vault.entries.length}
              </em>
            </div>
            <div className="vgrid">
              {filtered.map((token) => (
                <Card
                  key={token.id}
                  token={token}
                  code={codes[token.id]}
                  masked={masked}
                  copied={copiedId === token.id}
                  onCopy={handleCopy}
                  onOpen={(t) => setDetail(t)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="vfoot">
        <span className="status-dot" />
        <span className="foot__count">
          {vault.entries.length} {vault.entries.length === 1 ? "token" : "tokens"} ·{" "}
          {vault.meta?.settings?.autoLockMinutes
            ? `bloqueia em ${vault.meta.settings.autoLockMinutes} min`
            : "sem auto-bloqueio"}
        </span>
        <span style={{ flex: 1 }} />
        <span className="foot__count">atalhos: / buscar · N novo</span>
      </footer>

      {editor ? (
        <TokenEditor
          key={editor.key}
          token={editor.token}
          onClose={() => setEditor((cur) => (cur && cur.key === editor.key ? null : cur))}
          onSave={async (fields) => {
            if (editor.token) {
              await vault.updateToken(editor.token.id, fields);
              push(`<b>${fields.issuer}</b> atualizado`);
            } else {
              await vault.addToken(fields);
              push(`<b>${fields.issuer}</b> adicionado`);
            }
          }}
          onDelete={async (id) => {
            await vault.removeToken(id);
            push("<b>token</b> excluído");
          }}
        />
      ) : null}

      {detail ? (
        <DetailSheet
          token={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditor({ key: crypto.randomUUID(), token: detail });
            setDetail(null);
          }}
          onCopy={handleCopy}
        />
      ) : null}

      {settings ? (
        <SettingsSheet
          meta={vault.meta}
          entries={vault.entries}
          masked={masked}
          onToggleMask={() => setMasked((m) => !m)}
          onSaved={(next) => vault.saveSettings(next.settings)}
          onPassword={async ({ newPassword, importEntries }) => {
            if (newPassword) await vault.changePassword(newPassword);
            if (importEntries) {
              const merged = [...vault.entries];
              for (const incoming of importEntries) {
                if (!merged.some((m) => m.id === incoming.id)) merged.push(incoming);
              }
              await vault.replaceAll(merged);
              push(`<b>${importEntries.length}</b> tokens importados`);
            }
          }}
          onWiped={() => location.reload()}
          onClose={() => setSettings(false)}
          push={push}
        />
      ) : null}

      <Toasts items={toasts} />
    </div>
  );
}

function DetailSheet({ token, onClose, onEdit, onCopy }) {
  const [code, setCode] = useState(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const c = await totp(token, Date.now());
        if (alive) setCode(c);
      } catch {
        if (alive) setCode(null);
      }
    };
    run();
    const id = setInterval(run, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token]);

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={token.issuer} style={{ maxWidth: 380 }}>
        <div className="sheet__head">
          <IconShield style={{ width: 15, height: 15, color: "var(--acc)" }} />
          <h2>{token.issuer}</h2>
          <span style={{ flex: 1 }} />
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Fechar">
            <IconX />
          </button>
        </div>
        <div className="sheet__body">
          <div className="detail__code">{code ? formatCode(code.code) : "—— ——"}</div>
          <div className="detail__meta">
            <span>{token.account || "sem conta"}</span>
            <span className="mono">
              {token.algorithm} · {token.digits} díg · {token.period}s
            </span>
            {token.note ? <span>{token.note}</span> : null}
          </div>
        </div>
        <div className="sheet__foot">
          <button className="btn" onClick={onEdit}>
            editar
          </button>
          <button className="btn btn--primary" onClick={() => code && onCopy(code.code, token)}>
            <IconCopy /> copiar
          </button>
        </div>
      </div>
    </div>
  );
}
