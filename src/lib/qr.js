// Leitura de QR a partir de imagem (arquivo). O decodificador jsQR é carregado
// só quando o usuário escolhe uma imagem — o popup não paga o custo em repouso.

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não consegui abrir a imagem."));
    };
    img.src = url;
  });
}

/** @returns {Promise<string>} conteúdo textual do QR */
export async function readQrFromFile(file) {
  const { default: jsQR } = await import("jsqr");
  const img = await loadImage(file);

  // Redimensiona para no máximo 1024px: jsQR fica lento e impreciso em imagens gigantes.
  const max = 1024;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  const found = jsQR(data, w, h, { inversionAttempts: "attemptBoth" });
  if (!found?.data) {
    throw new Error("Nenhum QR legível nessa imagem. Recorte só o código e tente de novo.");
  }
  return found.data;
}
