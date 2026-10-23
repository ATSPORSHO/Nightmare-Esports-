import { useLineup } from '../context/LineupContext'

/** Dropdown of lineups. allowShared adds an "Organization (shared)" choice that stores no lineup. */
export default function LineupSelect({ value, onChange, allowShared = false, sharedLabel = 'Organization (shared)', required = false }) {
  const { lineups } = useLineup()
  const options = lineups.filter((l) => l.active || l.id === value)
  return (
    <select
      className="input"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      required={required && !allowShared}
    >
      {allowShared ? <option value="">{sharedLabel}</option> : <option value="" disabled>Choose lineup…</option>}
      {options.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
    </select>
  )
}
