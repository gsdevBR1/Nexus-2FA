// Toasts efêmeros — um por ação, sem empilhar além de três.

import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck, IconAlert } from "./icons.jsx";

let seq = 0;

export function useToasts() {
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setItems((all) => all.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (text, tone = "ok") => {
      const id = ++seq;
      setItems((all) => [...all.slice(-2), { id, text, tone }]);
      const handle = setTimeout(() => dismiss(id), 2100);
      timers.current.set(id, handle);
    },
    [dismiss]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, []);

  return { toasts: items, push, dismiss };
}

export function Toasts({ items }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div className="toast" key={t.id}>
          {t.tone === "err" ? <IconAlert /> : <IconCheck />}
          <span dangerouslySetInnerHTML={{ __html: t.text }} />
        </div>
      ))}
    </div>
  );
}
