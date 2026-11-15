// Peças de interface compartilhadas: modal, campo, abas, botão de pânico.

import { useEffect, useRef } from "react";
import { IconX } from "./icons.jsx";

export function Sheet({ title, icon, onClose, children, footer, width }) {
  const ref = useRef(null);
  // onClose chega como arrow nova a cada render do pai. Se entrar no array de
  // dependências, o efeito re-roda a cada render — e o foco salta de volta para
  // o primeiro campo no meio da digitação. Guardamos numa ref e rodamos uma vez.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") closeRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    // foca o primeiro campo útil só na montagem do modal
    const first = ref.current?.querySelector(
      ".sheet__body input:not([type=file]), .sheet__body select, .sheet__body textarea"
    );
    first?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        style={width ? { maxWidth: width } : undefined}
      >
        <div className="sheet__head">
          {icon}
          <h2>{title}</h2>
          <span style={{ flex: 1 }} />
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Fechar">
            <IconX />
          </button>
        </div>
        <div className="sheet__body scroll">{children}</div>
        {footer ? <div className="sheet__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className="field">
      {label ? <label htmlFor={htmlFor}>{label}</label> : null}
      {children}
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Tabs({ items, value, onChange }) {
  return (
    <div className="seg" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={value === item.id}
          aria-pressed={value === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function SecretInput({ value, onChange, placeholder, id }) {
  return (
    <input
      id={id}
      className="input mono"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="characters"
      inputMode="text"
    />
  );
}
