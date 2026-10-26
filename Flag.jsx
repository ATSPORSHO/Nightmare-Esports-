/** Country flag image (flagcdn.com). Renders nothing when the team has no country. */
export default function Flag({ code, h = '4mm', style, className = '' }) {
  if (!code) return null
  const c = String(code).toLowerCase()
  return (
    <img src={`https://flagcdn.com/w80/${c}.png`} alt={String(code).toUpperCase()} title={String(code).toUpperCase()} className={className}
      style={{ height: h, width: 'auto', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: '0.5mm', flexShrink: 0, boxShadow: '0 0 0 0.2mm rgba(0,0,0,.35)', ...style }} />
  )
}
