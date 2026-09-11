/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_CRM_INTAKE_APPROVED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
