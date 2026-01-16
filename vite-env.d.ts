// Fix: Removed vite/client reference to resolve "Cannot find type definition" error.
// /// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEEPSEEK_API_KEY: string
  [key: string]: any
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
