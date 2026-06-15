export default function Button({
  children, onClick, type = 'button', variant = 'primary',
  size = 'md', disabled = false, loading = false, fullWidth = false, style = {}
}) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
    border: 'none', cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
    whiteSpace: 'nowrap', letterSpacing: '-0.01em',
    opacity: disabled ? 0.4 : 1,
    width: fullWidth ? '100%' : 'auto',
    position: 'relative', overflow: 'hidden'
  }

  const sizes = {
    sm: { padding: '7px 14px', fontSize: 13, borderRadius: 8 },
    md: { padding: '10px 20px', fontSize: 14, borderRadius: 10 },
    lg: { padding: '13px 28px', fontSize: 15, borderRadius: 12 },
    xl: { padding: '16px 36px', fontSize: 16, borderRadius: 14 }
  }

  const variants = {
    primary: {
      background: '#86efac', color: '#0a0a0a', fontWeight: 600,
      boxShadow: '0 0 0 0 rgba(134,239,172,0)'
    },
    secondary: {
      background: 'rgba(255,255,255,0.06)', color: '#ffffff',
      border: '1px solid rgba(255,255,255,0.1)'
    },
    ghost: {
      background: 'transparent', color: 'rgba(255,255,255,0.6)',
      border: '1px solid rgba(255,255,255,0.08)'
    },
    danger: {
      background: 'rgba(248,113,113,0.1)', color: '#f87171',
      border: '1px solid rgba(248,113,113,0.2)'
    }
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
      onMouseEnter={e => {
        if (disabled || loading) return
        if (variant === 'primary') {
          e.currentTarget.style.background = '#a7f3d0'
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(134,239,172,0.3)'
        } else {
          e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = variants[variant].background
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = variant === 'primary' ? '0 0 0 0 rgba(134,239,172,0)' : 'none'
      }}
    >
      {loading ? (
        <>
          <span style={{
            width: 14, height: 14, borderRadius: '50%',
            border: '2px solid rgba(0,0,0,0.2)',
            borderTopColor: variant === 'primary' ? '#0a0a0a' : '#86efac',
            animation: 'spin 0.7s linear infinite', flexShrink: 0
          }} />
          {children}
        </>
      ) : children}
    </button>
  )
}
