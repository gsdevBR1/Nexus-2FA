# Nexus 2FA

ExtensÃ£o de Chrome para autenticaÃ§Ã£o de dois fatores. Cofre local, cifrado com AES-256-GCM. Sem servidor, sem conta, sem telemetria.

> **Por que existe:** nÃ£o confio em extensÃµes de 2FA de terceiros. Se o cÃ³digo que guarda suas sementes TOTP nÃ£o Ã© seu, vocÃª nÃ£o sabe o que ele faz com elas.

![Chrome](https://img.shields.io/badge/Chrome-116%2B-5cf2c4?style=flat-square)
![Manifest](https://img.shields.io/badge/Manifest-V3-5cf2c4?style=flat-square)
![Tests](https://img.shields.io/badge/tests-159%20passing-5cf2c4?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-5cf2c4?style=flat-square)

---

## Instalar

```bash
git clone https://github.com/gsdevBR1/Nexus-2FA.git
cd Nexus-2FA
npm install
npm run build
```

1. Abra `chrome://extensions`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactaÃ§Ã£o**
4. Selecione a pasta **`dist/`**

O `manifest.json` da raiz tambÃ©m funciona â€” ele aponta para `dist/`.

---

## Como usar

| AÃ§Ã£o | Como |
|---|---|
| Cadastrar 2FA | **novo** â†’ cole o link `otpauth://`, leia um QR de imagem, ou digite a chave |
| Copiar cÃ³digo | Clique na linha, ou no Ã­cone de copiar Ã  direita |
| Editar / excluir | Clique na linha â†’ modal com os campos e o botÃ£o excluir |
| Buscar | Digite na barra, ou pressione `/` |
| VisÃ£o ampla | **janela** no rodapÃ© â€” grade com todos os tokens |
| Backup | Ajustes â†’ exportar `.json` (cifrado) ou `.txt` (links otpauth) |

**Atalhos:** `/` busca Â· `N` novo token Â· `Esc` fecha modal Â· `Alt+Shift+N` abre o popup

---

## SeguranÃ§a

| Item | ImplementaÃ§Ã£o |
|---|---|
| Cifra | AES-256-GCM, IV aleatÃ³rio de 12 bytes por gravaÃ§Ã£o |
| DerivaÃ§Ã£o | PBKDF2-SHA256, 310.000 iteraÃ§Ãµes, salt de 16 bytes |
| VerificaÃ§Ã£o de senha | Token cifrado conhecido â€” a senha nunca Ã© armazenada |
| SessÃ£o | `chrome.storage.session` (memÃ³ria, nunca disco), expira por inatividade |
| PermissÃµes | `storage` + `clipboardWrite`. Nada mais. |
| CSP | `script-src 'self'` â€” sem `eval`, sem script remoto |
| Rede | Zero. Nenhum `fetch`, nenhum `XMLHttpRequest` no cÃ³digo. |

**NÃ£o existe recuperaÃ§Ã£o de senha.** Se esquecer a mestra, os cÃ³digos morrem com ela. Exporte o backup.

### O que a extensÃ£o nÃ£o faz

- NÃ£o injeta script em pÃ¡gina nenhuma (sem `content_scripts`)
- NÃ£o lÃª abas, histÃ³rico, cookies ou rede
- NÃ£o tem analytics, crash reporting ou qualquer chamada externa
- NÃ£o sincroniza entre dispositivos

---

## Motor TOTP

ImplementaÃ§Ã£o prÃ³pria de RFC 6238 / RFC 4226, sem dependÃªncias.

```js
import { totp } from "./src/lib/totp.js";

const { code, remaining, progress } = await totp({
  secret: "JBSWY3DPEHPK3PXP", // Base32
  digits: 6,                  // 6 ou 8
  period: 30,                 // segundos
  algorithm: "SHA1",          // SHA1 | SHA256 | SHA512
});
```

Validado contra **todos** os vetores oficiais do RFC 6238 ApÃªndice B (SHA-1/256/512, seis instantes) e do RFC 4226 ApÃªndice D (dez contadores).

---

## Estrutura

```
nexus-2fa/
â”œâ”€â”€ manifest.json          # raiz aponta para dist/
â”œâ”€â”€ popup.html             # entrada do Vite
â”œâ”€â”€ app.html               # janela ampla
â”œâ”€â”€ vite.config.js
â”œâ”€â”€ public/
â”‚   â”œâ”€â”€ manifest.json      # manifest do pacote final
â”‚   â””â”€â”€ icons/             # PNGs gerados por tools/make-icons.mjs
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”œâ”€â”€ totp.js        # motor RFC 6238
â”‚   â”‚   â”œâ”€â”€ base32.js      # codec RFC 4648
â”‚   â”‚   â”œâ”€â”€ crypto.js      # PBKDF2 + AES-GCM
â”‚   â”‚   â”œâ”€â”€ vault.js       # persistÃªncia do cofre
â”‚   â”‚   â”œâ”€â”€ storage.js     # chrome.storage + fallback
â”‚   â”‚   â”œâ”€â”€ qr.js          # leitura de QR (jsQR, sob demanda)
â”‚   â”‚   â””â”€â”€ secret.js      # gerador de chave Base32
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ reactbits/     # componentes do React Bits (ver crÃ©ditos)
â”‚   â”‚   â”œâ”€â”€ ScrambleText.jsx
â”‚   â”‚   â”œâ”€â”€ TokenRow.jsx
â”‚   â”‚   â”œâ”€â”€ Toasts.jsx
â”‚   â”‚   â”œâ”€â”€ Ground.jsx
â”‚   â”‚   â”œâ”€â”€ ui.jsx
â”‚   â”‚   â””â”€â”€ icons.jsx
â”‚   â”œâ”€â”€ popup/App.jsx
â”‚   â”œâ”€â”€ app/VaultApp.jsx
â”‚   â”œâ”€â”€ Screens.jsx
â”‚   â”œâ”€â”€ TokenEditor.jsx
â”‚   â”œâ”€â”€ SettingsSheet.jsx
â”‚   â”œâ”€â”€ useVault.js
â”‚   â””â”€â”€ styles/
â””â”€â”€ tools/
    â”œâ”€â”€ verify.mjs         # vetores RFC + crypto
    â”œâ”€â”€ geometry-test.mjs  # dimensÃµes do popup
    â”œâ”€â”€ ui-test.mjs        # fluxos no Chrome real
    â”œâ”€â”€ storage-test.mjs   # caminho chrome.storage
    â”œâ”€â”€ layout-audit.mjs   # overflow, contraste, alvos
    â”œâ”€â”€ a11y-test.mjs      # teclado e leitores
    â”œâ”€â”€ package-check.mjs  # validaÃ§Ã£o do pacote
    â”œâ”€â”€ all-tests.mjs      # roda tudo
    â””â”€â”€ make-icons.mjs     # gera PNGs sem dependÃªncia
```

---

## Desenvolvimento

```bash
npm run dev            # Vite em modo dev (preview no navegador)
npm run build          # gera dist/
npm test               # 159 checagens em 6 suÃ­tes
npm run verify         # sÃ³ o motor TOTP
npm run verify:package # valida manifest, CSP, Ã­cones, zip
npm run icons          # regenera os PNGs
```

### Testes

| SuÃ­te | Cobre |
|---|---|
| `verify.mjs` | RFC 6238, RFC 4226, Base32, parsing otpauth, round-trip AES |
| `geometry-test.mjs` | 380Ã—600 sem colapso, viewport apertado, botÃ£o janela |
| `ui-test.mjs` | criar cofre, adicionar, copiar, editar, excluir, busca, reload |
| `storage-test.mjs` | `chrome.storage.local`/`session`, cifra em disco, auto-lock |
| `layout-audit.mjs` | overflow, texto cortado, contraste WCAG AA, grade em 4 larguras |
| `a11y-test.mjs` | rÃ³tulos, foco visÃ­vel, atalhos, navegaÃ§Ã£o sem mouse |

Os testes dirigem o Chrome de verdade via `puppeteer-core` â€” Ã© preciso ter Chrome instalado.

---

## CrÃ©ditos

Componentes de interface de [**React Bits**](https://reactbits.dev) por [David Haz](https://github.com/DavidHDev/react-bits), sob licenÃ§a **MIT + Commons Clause**:

- `Aurora` â€” fundo WebGL
- `SpotlightCard` â€” cards da visÃ£o ampla
- `StarBorder` â€” borda viva do botÃ£o principal
- `ClickSpark` â€” faÃ­scas no clique

O texto de licenÃ§a estÃ¡ preservado em [`LICENSE-REACT-BITS.md`](./LICENSE-REACT-BITS.md). A Commons Clause restringe redistribuir os componentes em si; este projeto os usa dentro de uma aplicaÃ§Ã£o, o que Ã© permitido.

DireÃ§Ã£o visual orientada por [**Taste Skill**](https://www.tasteskill.dev).

Tipografia: [Geist e Geist Mono](https://vercel.com/font) (SIL Open Font License).

---

## LicenÃ§a

MIT â€” veja [LICENSE](./LICENSE).
