import type { CSSProperties } from 'react';
import { ICONS, WORDMARK, AVATAR_ARJUN } from '../icons';

/** Thin line icon from the PeakX set (24×24, stroke only). Sizing and stroke come from peakx.css. */
export function Icon({ name, style }: { name: string; style?: CSSProperties }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" style={style} dangerouslySetInnerHTML={{ __html: ICONS[name] ?? '' }} />;
}

export function Wordmark({ style }: { style?: CSSProperties }) {
  const inner = WORDMARK.replace(/^<span[^>]*>/, '').replace(/<\/span>$/, '');
  return <span className="px-wordmark" role="img" aria-label="PeakX" style={style} dangerouslySetInnerHTML={{ __html: inner }} />;
}

/** Profile picture: the illustrated portrait for the demo account, initials for everyone else. */
export function Avatar({ style, name = '', demo = false }: { style?: CSSProperties; name?: string; demo?: boolean }) {
  if (demo) return <span className="px-avatar" role="img" aria-label="Arjun’s profile" style={style} dangerouslySetInnerHTML={{ __html: AVATAR_ARJUN }} />;
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  const size = parseFloat(String(style?.width ?? 32)) || 32;
  return (
    <span className="px-avatar px-avatar-initials" role="img" aria-label={name ? `${name}’s profile` : 'Your profile'} style={{ ...style, fontSize: `${Math.round(size * 0.4)}px` }}>
      {initials || <Icon name="user" style={{ width: '55%', height: '55%' }} />}
    </span>
  );
}
