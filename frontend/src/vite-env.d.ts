/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Worker origin to call in production (e.g. https://arp-society-elections-worker.<account>.workers.dev). Unset in local dev — requests stay relative and go through the Vite proxy. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
