// Small shared UI helpers used by every screen.
import { fonts } from './theme.js';

export function styles(T) {
  return {
    card: {
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: '12px',
      padding: '18px',
      transition: 'border-color 0.15s, transform 0.15s',
    },
    input: {
      width: '100%',
      padding: '10px 12px',
      background: T.bg,
      color: T.text,
      border: `1px solid ${T.border}`,
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: fonts.body,
      outline: 'none',
    },
    label: {
      display: 'block',
      fontSize: '11px',
      fontWeight: 600,
      color: T.textDim,
      textTransform: 'uppercase',
      letterSpacing: '0.6px',
      marginBottom: '6px',
      fontFamily: fonts.mono,
    },
    btn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '9px 14px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: 500,
      cursor: 'pointer',
      border: '1px solid transparent',
      fontFamily: fonts.body,
      transition: 'all 0.15s',
    },
    btnPrimary: { background: T.accent, color: T.accentText, borderColor: T.accent },
    btnSecondary: { background: T.surface, color: T.text, borderColor: T.border },
    btnGhost: { background: 'transparent', color: T.textDim, borderColor: 'transparent' },
    btnDanger: { background: T.redDim, color: T.red, borderColor: T.redBorder },
    pill: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 8px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 500,
      fontFamily: fonts.mono,
      letterSpacing: '0.3px',
    },
  };
}

export function formatRelativeDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / (24 * 3600 * 1000));
  if (days < 0) {
    const ahead = -days;
    if (ahead === 0) return 'today';
    if (ahead === 1) return 'tomorrow';
    if (ahead < 30) return `in ${ahead}d`;
    if (ahead < 365) return `in ${Math.round(ahead / 30)}mo`;
    return `in ${Math.round(ahead / 365)}y`;
  }
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export function formatShortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
