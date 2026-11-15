// App do popup — shell, lista, busca, atalhos e modais.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STATUS, useCodes, useVault } from "../useVault.js";
import { formatCode } from "../lib/totp.js";
import { copyText } from "../lib/storage.js";
import { LockScreen, SetupScreen } from "../Screens.jsx";
import TokenRow from "../components/TokenRow.jsx";
import TokenEditor from "../TokenEditor.jsx";
import SettingsSheet from "../SettingsSheet.jsx";
import Ground from "../components/Ground.jsx";
import { Toasts, useToasts } from "../components/Toasts.jsx";
import {
  IconCopy,
  IconEye,
  IconEyeOff,
  IconGear,
  IconLock,
  IconPlus,
  IconSearch,
  IconShield,
  IconX,
  Mark,
} from "../components/icons.jsx";
import ClickSpark from "../components/reactbits/ClickSpark.jsx";

const MASK_KEY = "nexus.masked";

export default function PopupApp() {
  const vault = useVault();
  const { toasts, push } = useToasts();
  const [query, setQuery] = useState("");
  const [masked, setMasked] = useState(() => localStorage.getItem(MASK_KEY) === "1");
  const [editor, setEditor] = useState(null); // null | {token?}
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState("");
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
      vault.markActivity();
      const ok = await copyText(code);
      if (ok) {
        setCopiedId(token.id);
        setTimeout(() => setCopiedId(""), 1300);
        push(`<b>${formatCode(code)}</b> copiado`);
      } else {
        push("não consegui copiar", "err");
      }
    },
    [push, vault]
  );

  const doSetup = async (password) => {
    setBusy(true);
    await vault.setup(password);
    setBusy(false);
    push("<b>cofre</b> criado");
  };

  const doUnlock = async (password) => {
    setBusy(true);
    const ok = await vault.unlock(password);
    setBusy(false);
    return ok;
  };

  const doReset = async () => {
    if (!confirm("Apagar o cofre e todos os tokens? Não há recuperação.")) return;
    const { wipeVault } = await import("../lib/vault.js");
    await wipeVault();
    location.reload();
  };

  // atalhos: / foca busca, n abre novo, esc limpa busca
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
      if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vault.status]);

  // ---------- render ----------
  if (vault.status === STATUS.LOADING) {
    return (
      <div className="shell">
        <Ground />
        <div className="center" style={{ height: "100%" }}>
          <Mark size={30} className="mark mark--lg" />
        </div>
      </div>
    );
  }

  if (vault.status === STATUS.NEW) {
    return (
      <div className="shell">
        <Ground />
        <div className="shell__main scroll">
          <SetupScreen onCreate={doSetup} busy={busy} />
        </div>
      </div>
    );
  }

  if (vault.status === STATUS.LOCKED) {
    return (
      <div className="shell">
        <Ground />
        <div className="shell__main scroll">
          <LockScreen onUnlock={doUnlock} onReset={doReset} busy={busy} />
        </div>
        <Toasts items={toasts} />
      </div>
    );
  }

  // window.open é bloqueado no popup de extensão. chrome.tabs.create abre a
  // janela do cofre como aba real (não exige a permissão "tabs"); fora da
  // extensão, cai no window.open.
  const open = () => {
    const hasChrome = typeof chrome !== "undefined" && !!chrome?.runtime?.id;
    const url = hasChrome ? chrome.runtime.getURL("app.html") : "app.html";
    if (hasChrome && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, "_blank", "width=760,height=800");
    }
  };

  return (
    <ClickSpark
      sparkColor="#5cf2c4"
      sparkCount={7}
      sparkRadius={22}
      sparkSize={4}
      duration={320}
      easing="ease-out"
      extraScale={1}
    >
      <div className="shell">
        <Ground />

        <header className="bar">
          <Mark />
          <div className="bar__name">
            <b>Nexus</b>
            <span>cofre 2fa · local</span>
          </div>
          <span className="bar__spacer" />
          <button
            className="btn btn--ghost btn--icon"
            onClick={() => setMasked((m) => !m)}
            aria-label={masked ? "Mostrar códigos" : "Mascarar códigos"}
            title={masked ? "mostrar códigos" : "mascarar códigos"}
          >
            {masked ? <IconEyeOff /> : <IconEye />}
          </button>
          <button
            className="btn btn--ghost btn--icon"
            onClick={() => setSettings(true)}
            aria-label="Ajustes"
            title="ajustes"
          >
            <IconGear />
          </button>
          <button
            className="btn btn--ghost btn--icon"
            onClick={() => vault.lock()}
            aria-label="Bloquear agora"
            title="bloquear"
          >
            <IconLock />
          </button>
        </header>

        <div className="bar__search">
          <div className="search">
            <IconSearch />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="buscar serviço ou conta"
              spellCheck={false}
              aria-label="Buscar tokens"
              type="search"
            />
            {query ? (
              <button className="search__clear" onClick={() => setQuery("")} aria-label="Limpar busca">
                <IconX />
              </button>
            ) : null}
          </div>
          <button className="btn btn--primary" onClick={() => setEditor({ key: crypto.randomUUID() })} title="Adicionar (N)">
            <IconPlus /> novo
          </button>
        </div>

        <div className="shell__main">
          <div className="shell__scroll scroll">
            {filtered.length === 0 ? (
              vault.entries.length === 0 ? (
                <div className="empty">
                  <div className="empty__glyph">
                    <IconShield size={20} />
                  </div>
                  <b>Nenhum token ainda</b>
                  <p>Cole o link otpauth:// do site ou digite a chave de 16 caracteres.</p>
                  <button className="btn btn--primary" onClick={() => setEditor({ key: crypto.randomUUID() })} style={{ marginTop: 6 }}>
                    <IconPlus /> adicionar 2FA
                  </button>
                </div>
              ) : (
                <div className="noresult">
                  nada com <b>{query}</b>
                </div>
              )
            ) : (
              <>
                <div className="section-head">
                  <p className="eyebrow">{query ? "resultado" : "tokens"}</p>
                  <em>
                    {filtered.length}/{vault.entries.length}
                  </em>
                </div>
                <div className="list">
                  {filtered.map((token) => (
                    <TokenRow
                      key={token.id}
                      token={token}
                      code={codes[token.id]}
                      masked={masked}
                      copied={copiedId === token.id}
                      onCopy={handleCopy}
                      onOpen={(t) => setEditor({ key: crypto.randomUUID(), token: t })}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="foot">
          <span className="status-dot" />
          <span className="foot__count">
            {vault.entries.length} {vault.entries.length === 1 ? "token" : "tokens"}
          </span>
          <span style={{ flex: 1 }} />
          <button className="btn btn--ghost" onClick={() => setSettings(true)} style={{ fontSize: 11.5 }}>
            backup
          </button>
          <button className="btn btn--ghost" onClick={open} style={{ fontSize: 11.5 }}>
            janela
          </button>
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

        {settings ? (
          <SettingsSheet
            meta={vault.meta}
            entries={vault.entries}
            masked={masked}
            onToggleMask={() => setMasked((m) => !m)}
            onSaved={(next) => vault.saveSettings(next.settings)}
            onPassword={async ({ newPassword }) => {
              if (newPassword) await vault.changePassword(newPassword);
            }}
            onWiped={() => location.reload()}
            onClose={() => setSettings(false)}
            push={push}
          />
        ) : null}

        <Toasts items={toasts} />
      </div>
    </ClickSpark>
  );
}

// ícones usados indiretamente no JSX acima
void IconCopy;
