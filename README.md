# Nexus 2FA

Extensão de Chrome para autenticação de dois fatores. Cofre local, cifrado com AES-256-GCM. Sem servidor, sem conta, sem telemetria.

> **Por que existe:** não confio em extensões de 2FA de terceiros. Se o código que guarda suas sementes TOTP não é seu, você não sabe o que ele faz com elas.

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
3. Clique em **Carregar sem compactação**
4. Selecione a pasta **`dist/`**

O `manifest.json` da raiz também funciona — ele aponta para `dist/`.

---

## Como usar

| Ação | Como |
|---|---|
| Cadastrar 2FA | **novo** → cole o link `otpauth://`, leia um QR de imagem, ou digite a chave |
| Copiar código | Clique na linha, ou no ícone de copiar à direita |
| Editar / excluir | Clique na linha → modal com os campos e o botão excluir |
| Buscar | Digite na barra, ou pressione `/` |
| Visão ampla | **janela** no rodapé — grade com todos os tokens |
| Backup | Ajustes → exportar `.json` (cifrado) ou `.txt` (links otpauth) |

**Atalhos:** `/` busca · `N` novo token · `Esc` fecha modal · `Alt+Shift+N` abre o popup

---

## Segurança

| Item | Implementação |
|---|---|
| Cifra | AES-256-GCM, IV aleatório de 12 bytes por gravação |
| Derivação | PBKDF2-SHA256, 310.000 iterações, salt de 16 bytes |
| Verificação de senha | Token cifrado conhecido — a senha nunca é armazenada |
| Sessão | `chrome.storage.session` (memória, nunca disco), expira por inatividade |
| Permissões | `storage` + `clipboardWrite`. Nada mais. |
| CSP | `script-src 'self'` — sem `eval`, sem script remoto |
| Rede | Zero. Nenhum `fetch`, nenhum `XMLHttpRequest` no código. |

**Não existe recuperação de senha.** Se esquecer a mestra, os códigos morrem com ela. Exporte o backup.

### O que a extensão não faz

- Não injeta script em página nenhuma (sem `content_scripts`)
- Não lê abas, histórico, cookies ou rede
- Não tem analytics, crash reporting ou qualquer chamada externa
- Não sincroniza entre dispositivos

---

## Motor TOTP

Implementação própria de RFC 6238 / RFC 4226, sem dependências.

```js
import { totp } from "./src/lib/totp.js";

const { code, remaining, progress } = await totp({
  secret: "JBSWY3DPEHPK3PXP", // Base32
  digits: 6,                  // 6 ou 8
  period: 30,                 // segundos
  algorithm: "SHA1",          // SHA1 | SHA256 | SHA512
});
```

Validado contra **todos** os vetores oficiais do RFC 6238 Apêndice B (SHA-1/256/512, seis instantes) e do RFC 4226 Apêndice D (dez contadores).

---

## Estrutura

```
nexus-2fa/
├── manifest.json          # raiz aponta para dist/
├── popup.html             # entrada do Vite
├── app.html               # janela ampla
├── vite.config.js
├── public/
│   ├── manifest.json      # manifest do pacote final
│   └── icons/             # PNGs gerados por tools/make-icons.mjs
├── src/
│   ├── lib/
│   │   ├── totp.js        # motor RFC 6238
│   │   ├── base32.js      # codec RFC 4648
│   │   ├── crypto.js      # PBKDF2 + AES-GCM
│   │   ├── vault.js       # persistência do cofre
│   │   ├── storage.js     # chrome.storage + fallback
│   │   ├── qr.js          # leitura de QR (jsQR, sob demanda)
│   │   └── secret.js      # gerador de chave Base32
│   ├── components/
│   │   ├── reactbits/     # componentes do React Bits (ver créditos)
│   │   ├── ScrambleText.jsx
│   │   ├── TokenRow.jsx
│   │   ├── Toasts.jsx
│   │   ├── Ground.jsx
│   │   ├── ui.jsx
│   │   └── icons.jsx
│   ├── popup/App.jsx
│   ├── app/VaultApp.jsx
│   ├── Screens.jsx
│   ├── TokenEditor.jsx
│   ├── SettingsSheet.jsx
│   ├── useVault.js
│   └── styles/
└── tools/
    ├── verify.mjs         # vetores RFC + crypto
    ├── geometry-test.mjs  # dimensões do popup
    ├── ui-test.mjs        # fluxos no Chrome real
    ├── storage-test.mjs   # caminho chrome.storage
    ├── layout-audit.mjs   # overflow, contraste, alvos
    ├── a11y-test.mjs      # teclado e leitores
    ├── package-check.mjs  # validação do pacote
    ├── all-tests.mjs      # roda tudo
    └── make-icons.mjs     # gera PNGs sem dependência
```

---

## Desenvolvimento

```bash
npm run dev            # Vite em modo dev (preview no navegador)
npm run build          # gera dist/
npm test               # 159 checagens em 6 suítes
npm run verify         # só o motor TOTP
npm run verify:package # valida manifest, CSP, ícones, zip
npm run icons          # regenera os PNGs
```

### Testes

| Suíte | Cobre |
|---|---|
| `verify.mjs` | RFC 6238, RFC 4226, Base32, parsing otpauth, round-trip AES |
| `geometry-test.mjs` | 380×600 sem colapso, viewport apertado, botão janela |
| `ui-test.mjs` | criar cofre, adicionar, copiar, editar, excluir, busca, reload |
| `storage-test.mjs` | `chrome.storage.local`/`session`, cifra em disco, auto-lock |
| `layout-audit.mjs` | overflow, texto cortado, contraste WCAG AA, grade em 4 larguras |
| `a11y-test.mjs` | rótulos, foco visível, atalhos, navegação sem mouse |

Os testes dirigem o Chrome de verdade via `puppeteer-core` — é preciso ter Chrome instalado.

---

## Créditos

Componentes de interface de [**React Bits**](https://reactbits.dev) por [David Haz](https://github.com/DavidHDev/react-bits), sob licença **MIT + Commons Clause**:

- `Aurora` — fundo WebGL
- `SpotlightCard` — cards da visão ampla
- `StarBorder` — borda viva do botão principal
- `ClickSpark` — faíscas no clique

O texto de licença está preservado em [`LICENSE-REACT-BITS.md`](./LICENSE-REACT-BITS.md). A Commons Clause restringe redistribuir os componentes em si; este projeto os usa dentro de uma aplicação, o que é permitido.

Direção visual orientada por [**Taste Skill**](https://www.tasteskill.dev).

Tipografia: [Geist e Geist Mono](https://vercel.com/font) (SIL Open Font License).

---

## Licença

MIT — veja [LICENSE](./LICENSE).
