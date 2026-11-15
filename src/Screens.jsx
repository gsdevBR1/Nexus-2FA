// Tela de criação do cofre / desbloqueio.

import { useState } from "react";
import { IconLock, IconShield, Mark } from "./components/icons.jsx";
import { Field } from "./components/ui.jsx";
import StarBorder from "./components/reactbits/StarBorder.jsx";
import ScrambleText from "./components/ScrambleText.jsx";

export function SetupScreen({ onCreate, busy }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 10) s++;
    if (password.length >= 14) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const labels = ["", "frágil", "fraca", "ok", "boa", "forte"];

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use pelo menos 8 caracteres. Essa senha é a única chave do cofre.");
      return;
    }
    if (password !== confirm) {
      setError("As duas senhas não batem.");
      return;
    }
    await onCreate(password);
  };

  return (
    <div className="gate">
      <div className="gate__mark">
        <Mark size={40} className="mark mark--lg" />
      </div>
      <div className="gate__head">
        <p className="eyebrow">primeiro acesso</p>
        <h1 className="h1">Crie a chave do cofre</h1>
        <p className="sub">
          Tudo fica neste computador, cifrado com AES-256. Não existe servidor, não existe conta,
          não existe recuperação.
        </p>
      </div>

      <form className="gate__form" onSubmit={submit}>
        <Field label="senha mestra" htmlFor="pw">
          <input
            id="pw"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mínimo 8 caracteres"
            autoComplete="new-password"
          />
        </Field>

        {password ? (
          <div className="meter" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={i <= strength ? "on" : ""} />
            ))}
            <em>{labels[strength]}</em>
          </div>
        ) : null}

        <Field label="repita a senha" htmlFor="pw2">
          <input
            id="pw2"
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="confirmação"
            autoComplete="new-password"
          />
        </Field>

        {error ? <p className="err">{error}</p> : null}

        <StarBorder
          as="button"
          type="submit"
          disabled={busy}
          color="#5cf2c4"
          trailColor="#5cf2c4"
          backgroundColor="#5cf2c4"
          textColor="#04211a"
          borderColor="rgba(92,242,196,0.5)"
          radius={7}
          thickness={1}
          duration={3.2}
          glow={0.9}
          className="btn--weld"
        >
          <IconShield />
          {busy ? "criando…" : "criar cofre"}
        </StarBorder>

        <p className="hint hint--center">
          Se esquecer essa senha, os códigos são perdidos. Guarde-a num gerenciador de senhas.
        </p>
      </form>
    </div>
  );
}

export function LockScreen({ onUnlock, onReset, busy }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const ok = await onUnlock(password);
    if (!ok) {
      setError("Senha incorreta.");
      setPassword("");
    }
  };

  return (
    <div className="gate">
      <div className="gate__mark">
        <div className="padlock">
          <IconLock size={18} />
        </div>
      </div>
      <div className="gate__head">
        <p className="eyebrow">cofre selado</p>
        <h1 className="h1">
          <ScrambleText text="Nexus 2FA" speed={38} reveals={1} className="decrypt" />
        </h1>
        <p className="sub">Informe a senha mestra para liberar os códigos.</p>
      </div>

      <form className="gate__form" onSubmit={submit}>
        <Field label="senha mestra" htmlFor="unlock">
          <input
            id="unlock"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            autoFocus
          />
        </Field>
        {error ? <p className="err">{error}</p> : null}

        <button className="btn btn--primary gate__submit" type="submit" disabled={busy || !password}>
          {busy ? "abrindo…" : "desbloquear"}
        </button>

        <button type="button" className="btn btn--ghost gate__reset" onClick={onReset}>
          esqueci a senha — apagar cofre
        </button>
      </form>
    </div>
  );
}
