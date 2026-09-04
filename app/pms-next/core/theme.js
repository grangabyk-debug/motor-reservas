export const THEME_STORAGE_KEY="habitacion-llena:pms-next-theme"

export function readTheme(){
  if(typeof window==="undefined")return"light"
  try{
    const saved=window.localStorage.getItem(THEME_STORAGE_KEY)
    if(saved==="light"||saved==="dark")return saved
  }catch{}
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches?"dark":"light"
}

export function persistTheme(theme){
  if(typeof window==="undefined")return
  try{window.localStorage.setItem(THEME_STORAGE_KEY,theme)}catch{}
}
