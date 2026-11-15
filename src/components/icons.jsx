// Ícones inline (stroke 1.5, viewBox 24) — nenhum pacote externo, nenhum emoji.

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
};

export const IconPlus = (p) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconCopy = (p) => (
  <svg {...base} {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2.2" />
    <path d="M15 6.2A2.2 2.2 0 0 0 12.8 4H6.2A2.2 2.2 0 0 0 4 6.2v6.6A2.2 2.2 0 0 0 6.2 15" />
  </svg>
);

export const IconCheck = (p) => (
  <svg {...base} {...p}>
    <path d="M20 6.5 9.4 17.1 4 11.7" />
  </svg>
);

export const IconGear = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.88 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.88.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.88V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const IconTrash = (p) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M9.5 7V4.8A1.8 1.8 0 0 1 11.3 3h1.4a1.8 1.8 0 0 1 1.8 1.8V7" />
    <path d="M18 7v12.2A1.8 1.8 0 0 1 16.2 21H7.8A1.8 1.8 0 0 1 6 19.2V7" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const IconPencil = (p) => (
  <svg {...base} {...p}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
    <path d="M13.5 6.5l3 3" />
  </svg>
);

export const IconX = (p) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconSearch = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.4" />
    <path d="m20 20-4.3-4.3" />
  </svg>
);

export const IconEye = (p) => (
  <svg {...base} {...p}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.9" />
  </svg>
);

export const IconEyeOff = (p) => (
  <svg {...base} {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 6.1A9.5 9.5 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a17 17 0 0 1-2.4 3.2" />
    <path d="M6.5 7.7A17 17 0 0 0 2.5 12S6 18.2 12 18.2a9.4 9.4 0 0 0 3.6-.7" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

export const IconLock = (p) => (
  <svg {...base} {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
    <path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" />
    <path d="M12 15v2" />
  </svg>
);

export const IconShield = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3l7.5 3v6c0 4.2-3 7.6-7.5 9-4.5-1.4-7.5-4.8-7.5-9V6z" />
    <path d="m9 12 2.2 2.2L15.4 10" />
  </svg>
);

export const IconDownload = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3v11" />
    <path d="m7.5 10 4.5 4.5L16.5 10" />
    <path d="M4 20h16" />
  </svg>
);

export const IconUpload = (p) => (
  <svg {...base} {...p}>
    <path d="M12 16V5" />
    <path d="m7.5 9 4.5-4.5L16.5 9" />
    <path d="M4 20h16" />
  </svg>
);

export const IconKey = (p) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="8" r="4.2" />
    <path d="m11.2 11.2 8.3 8.3" />
    <path d="m16.6 16.6-1.8 1.8M19 14.2l-1.8 1.8" />
  </svg>
);

export const IconExpand = (p) => (
  <svg {...base} {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-7.5 7.5" />
    <path d="M10 20H4v-6" />
    <path d="M4 20l7.5-7.5" />
  </svg>
);

export const IconBack = (p) => (
  <svg {...base} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const IconAlert = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3.5 21 19.5H3z" />
    <path d="M12 9.4v4.4M12 17h.01" />
  </svg>
);

export const IconClock = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7.6V12l3 1.8" />
  </svg>
);

// Marca: anel aberto + ponto — o "carrier" do cofre.
export const Mark = ({ size = 26, className = "mark" }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="16" cy="16" r="11.4" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.5" />
    <path
      d="M16 4.6a11.4 11.4 0 0 1 0 22.8"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
    <circle cx="16" cy="16" r="3.1" fill="currentColor" />
  </svg>
);
