export default function Logo({ size = 'md', showText = true, dark = false }) {
  const sizes = {
    sm: { text: 22, letterW: 14, letterH: 14, gap: 2 },
    md: { text: 28, letterW: 18, letterH: 18, gap: 3 },
    lg: { text: 40, letterW: 26, letterH: 26, gap: 4 }
  }
  const s = sizes[size]
  const green = '#86efac'
  const fg = dark ? '#0a0a0a' : '#ffffff'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none' }}>
      {/* Two O rings — the logo mark */}
      <div style={{ display: 'flex', gap: s.gap, alignItems: 'center' }}>
        {[0, 1].map(i => (
          <div key={i} style={{
            width: s.letterW,
            height: s.letterH,
            borderRadius: '50%',
            border: `2.5px solid ${green}`,
            background: 'transparent',
            flexShrink: 0
          }} />
        ))}
      </div>

      {showText && (
        <span style={{
          fontSize: s.text,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: fg,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'baseline'
        }}>
          <span style={{ color: fg }}>l</span>
          <span style={{ color: green }}>oo</span>
          <span style={{ color: fg }}>ped</span>
        </span>
      )}
    </div>
  )
}
