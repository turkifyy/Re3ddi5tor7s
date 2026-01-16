interface ImportMetaEnv {
  readonly VITE_DEEPSEEK_API_KEY: string
  [key: string]: any
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
