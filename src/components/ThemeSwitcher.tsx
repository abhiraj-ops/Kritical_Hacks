import { useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { THEMES, THEME_META, type Theme } from '@/hooks/useTheme';

interface Props {
  theme: Theme;
  onChange: (t: Theme) => void;
}

/**
 * Theme switcher: a compact trigger that expands into a keyboard-navigable
 * radiogroup. Arrow keys move between options, Escape closes.
 */
export function ThemeSwitcher({ theme, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setFocused(THEMES.indexOf(theme));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocused((i) => (i + 1) % THEMES.length);
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocused((i) => (i - 1 + THEMES.length) % THEMES.length);
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onChange(THEMES[focused]);
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, focused, theme, onChange]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className="btn btn-ghost !px-3 !py-2"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Theme: ${THEME_META[theme].label}. Change theme`}
        onClick={() => setOpen((v) => !v)}
      >
        <Palette className="h-4 w-4" />
        <span className="hidden sm:inline">{THEME_META[theme].label}</span>
      </button>

      {open && (
        <div
          role="radiogroup"
          aria-label="Colour theme"
          className="glass absolute right-0 z-50 mt-2 w-60 overflow-hidden p-1.5"
        >
          {THEMES.map((t, i) => (
            <button
              key={t}
              role="radio"
              aria-checked={theme === t}
              tabIndex={i === focused ? 0 : -1}
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
              onMouseEnter={() => setFocused(i)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition"
              style={{
                background: theme === t ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'transparent',
              }}
            >
              <ThemeSwatch theme={t} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {THEME_META[t].label}
                </span>
                <span className="block text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                  {THEME_META[t].hint}
                </span>
              </span>
              {theme === t && <Check className="h-4 w-4" style={{ color: 'var(--accent)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SWATCH_COLORS: Record<Theme, [string, string, string]> = {
  midnight: ['#0a0f1d', '#0284c7', '#38bdf8'],
  aurora: ['#060b16', '#0d9488', '#8b5cf6'],
  frost: ['#eef4fb', '#0369a1', '#93c5fd'],
  graphite: ['#050607', '#525252', '#fafafa'],
};

function ThemeSwatch({ theme }: { theme: Theme }) {
  const [bg, mid, hi] = SWATCH_COLORS[theme];
  return (
    <span
      aria-hidden="true"
      className="h-7 w-7 shrink-0 rounded-lg border"
      style={{ background: `linear-gradient(135deg, ${bg} 0%, ${mid} 55%, ${hi} 100%)`, borderColor: 'var(--border-strong)' }}
    />
  );
}