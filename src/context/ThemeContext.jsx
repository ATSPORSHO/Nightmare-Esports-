import { createContext, useContext, useEffect, useState } from 'react'

const Ctx = createContext({ theme: 'light', setTheme: () => {} })
export const useTheme = () => useContext(Ctx)

/** Light is the default. The visitor's choice is remembered in their own browser. */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try { localStorage.setItem('theme', theme) } catch { /* private window */ }
  }, [theme])
  return <Ctx.Provider value={{ theme, setTheme: setThemeState }}>{children}</Ctx.Provider>
}
