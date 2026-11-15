// Efeito de decifragem no título, sem dependência.
// O React Bits entrega isso via DecryptedText — bonito, mas puxa o `motion`
// inteiro (+142 kB no bundle). Para um popup de extensão, 40 linhas fazem o
// mesmo com zero peso, e respeitam prefers-reduced-motion.

import { useEffect, useRef, useState } from "react";

const GLYPHS = "ABCDEF0123456789#%&@$*<>/\\";

/**
 * @param {string} text       texto final
 * @param {number} speed      ms por quadro de embaralhamento
 * @param {number} reveals    quantas letras revelar por passo
 */
export default function ScrambleText({ text, speed = 40, reveals = 1, className = "" }) {
  const [output, setOutput] = useState(text);
  const [done, setDone] = useState(true);
  const frameRef = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !text) {
      setOutput(text);
      setDone(true);
      return undefined;
    }

    let revealed = 0;
    setDone(false);
    frameRef.current = 0;

    const tick = setInterval(() => {
      frameRef.current++;
      revealed = Math.min(text.length, revealed + reveals);

      const next = text
        .split("")
        .map((char, index) => {
          if (char === " ") return " ";
          if (index < revealed) return char;
          return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        })
        .join("");

      setOutput(next);

      if (revealed >= text.length) {
        clearInterval(tick);
        setOutput(text);
        setDone(true);
      }
    }, speed);

    return () => clearInterval(tick);
  }, [text, speed, reveals]);

  return (
    <span className={className} data-done={done ? "true" : "false"}>
      {output}
    </span>
  );
}
