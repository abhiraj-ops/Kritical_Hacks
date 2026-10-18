import { useEffect, useState } from 'react';
import { Globe2, Menu, X } from 'lucide-react';
import { ThemeSwitcher } from './ThemeSwitcher';
import type { Theme } from '@/hooks/useTheme';

export const NAV_LINKS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Active Map', href: '#live-map' },
  { label: 'AI Triage Log', href: '#triage-log' },
  { label: 'Data Sources', href: '#sources' },
  { label: 'Future Scope', href: '#future' },
] as const;

interface Props {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  /** Reflects the real fetch state of the alerts endpoint. */
  live: boolean;
  lastUpdated: Date | null;
  status: 'ok' | 'degraded' | 'unavailable';
}

export function Navbar({ theme, onThemeChange, live, lastUpdated, status }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const badgeStyle =
    status === 'ok'
      ? { borderColor: 'rgba(52,211,153,0.35)', background: 'rgba(52,211,153,0.12)', color: '#6ee7b7' }
      : status === 'degraded'
      ? { borderColor: 'rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.12)', color: '#fcd34d' }
      : { borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.12)', color: '#fca5a5' };

  return (
    <header
      className="sticky top-0 z-[500] border-b transition"
      style={{
        background: scrolled ? 'color-mix(in srgb, var(--bg) 82%, transparent)' : 'transparent',
        borderColor: 'var(--border)',
        backdropFilter: scrolled ? 'blur(14px) saturate(140%)' : undefined,
        WebkitBackdropFilter: scrolled ? 'blur(14px) saturate(140%)' : undefined,
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href="#top" className="flex shrink-0 items-center gap-2.5">
          <span
            className="relative flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, var(--accent-strong), var(--accent))',
              boxShadow: '0 0 22px color-mix(in srgb, var(--accent) 45%, transparent)',
            }}
          >
            <Globe2 className="h-5 w-5" style={{ color: 'var(--accent-contrast)' }} />
            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
              {live && (
                <span
                  className="absolute h-full w-full animate-ping rounded-full opacity-75"
                  style={{ background: 'var(--accent)' }}
                />
              )}
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--accent)' }} />
            </span>
          </span>
          <span className="text-base font-extrabold tracking-tight sm:text-lg" style={{ color: 'var(--text)' }}>
            EcoPulse <span style={{ color: 'var(--accent)' }}>AI</span>
          </span>
        </a>

        <nav className="hidden items-center gap-7 text-sm font-medium lg:flex" aria-label="Main">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="transition-colors hover:opacity-100"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span
            className="hidden items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider sm:inline-flex"
            style={badgeStyle}
            title={lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : 'Waiting for first fetch'}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
            {status === 'ok' ? 'LIVE' : status === 'degraded' ? 'DEGRADED' : 'OFFLINE'}
          </span>

          <ThemeSwitcher theme={theme} onChange={onThemeChange} />

          <a href="#live-map" className="btn btn-primary hidden !py-2 sm:inline-flex">
            Live Command Center
          </a>

          <button
            type="button"
            className="btn btn-ghost !px-2.5 !py-2 lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          id="mobile-nav"
          className="border-t px-4 pb-4 pt-2 lg:hidden"
          style={{
            borderColor: 'var(--border)',
            background: 'color-mix(in srgb, var(--bg) 94%, transparent)',
            backdropFilter: 'blur(14px)',
          }}
        >
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-lg px-3 py-3 text-sm font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              {l.label}
            </a>
          ))}
          <a href="#live-map" onClick={() => setMenuOpen(false)} className="btn btn-primary mt-2 w-full">
            Live Command Center
          </a>
        </div>
      )}
    </header>
  );
}