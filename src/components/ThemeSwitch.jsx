import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

/** Light / Dark selector. */
export default function ThemeSwitch({ className = '' }) {
  const { theme, setTheme } = useTheme()
  const opt = (key, Icon, label) => (
    <button
      type="button"
      onClick={() => setTheme(key)}
      title={`${label} theme`}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${theme === key ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}
    >
      <Icon size={14} /> <span className="hidden sm:inline">{label}</span>
    </button>
  )
  return (
    <div className={`flex items-center gap-0.5 rounded-lg border border-ink-600 bg-ink-900/70 p-0.5 ${className}`}>
      {opt('light', Sun, 'Light')}
      {opt('dark', Moon, 'Dark')}
    </div>
  )
}
