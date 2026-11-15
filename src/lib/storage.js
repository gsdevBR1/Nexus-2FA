// Camada de storage: chrome.storage.local/session na extensão.
// Fora dela (preview/dev), localStorage — mesmo contrato assíncrono.

const hasChrome = () =>
  typeof chrome !== "undefined" && !!chrome.storage && !!chrome.storage.local;

function wrapLocal() {
  return {
    async get(key) {
      const res = await chrome.storage.local.get(key);
      return res[key];
    },
    async set(key, value) {
      await chrome.storage.local.set({ [key]: value });
    },
    async remove(key) {
      await chrome.storage.local.remove(key);
    },
  };
}

function wrapSession() {
  const sessionAvailable =
    typeof chrome !== "undefined" && !!chrome.storage && !!chrome.storage.session;
  if (sessionAvailable) {
    return {
      async get(key) {
        const res = await chrome.storage.session.get(key);
        return res[key];
      },
      async set(key, value) {
        await chrome.storage.session.set({ [key]: value });
      },
      async remove(key) {
        await chrome.storage.session.remove(key);
      },
    };
  }
  // Sem storage.session: memória desta página. O cofre re-pede a senha ao reabrir.
  const memory = new Map();
  return {
    async get(key) {
      return memory.get(key);
    },
    async set(key, value) {
      memory.set(key, value);
    },
    async remove(key) {
      memory.delete(key);
    },
  };
}

/** Fallback fora da extensão: localStorage com o mesmo contrato. */
function wrapLocalStorage() {
  const prefix = "nexus.fallback.";
  return {
    async get(key) {
      const raw = localStorage.getItem(prefix + key);
      if (raw == null) return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    },
    async set(key, value) {
      localStorage.setItem(prefix + key, JSON.stringify(value));
    },
    async remove(key) {
      localStorage.removeItem(prefix + key);
    },
  };
}

export const isExtension = hasChrome();
export const localStore = isExtension ? wrapLocal() : wrapLocalStorage();
export const sessionStore = wrapSession();

/** Copia para a área de transferência com fallback para navegadores antigos. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-1000px";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
