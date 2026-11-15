// Fundo do app: aurora do React Bits em WebGL + grade + grão.
// A aurora só aparece quando o WebGL2 existe; o resto do fundo segura sozinho.

import { useEffect, useState } from "react";
import Aurora from "./reactbits/Aurora.jsx";

function hasWebGL2() {
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}

export default function Ground() {
  const [gl, setGl] = useState(false);

  useEffect(() => {
    setGl(hasWebGL2());
  }, []);

  return (
    <>
      <div className="ground" aria-hidden="true">
        {gl && (
          <Aurora
            colorStops={["#5cf2c4", "#1f6f8b", "#0b2a35"]}
            amplitude={0.9}
            blend={0.62}
            speed={0.55}
            height={0.42}
            scale={1.15}
            glow={0.75}
            brightness={0.62}
            layers={2}
            mouseInteraction
            intro={false}
            opacity={0.55}
          />
        )}
      </div>
      <div className="grain" aria-hidden="true" />
    </>
  );
}
