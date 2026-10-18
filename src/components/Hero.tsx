import { Bot, Map as MapIcon, Radio } from 'lucide-react';

interface Props {
  onRunAgent: () => void;
  agentRunning: boolean;
  onLaunchMap: () => void;
}

export function Hero({ onRunAgent, agentRunning, onLaunchMap }: Props) {
  return (
    <section id="top" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-8 h-96 w-96 rounded-full"
        style={{ background: 'var(--glow-1)', filter: 'blur(120px)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full"
        style={{ background: 'var(--glow-2)', filter: 'blur(110px)' }}
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-14 text-center sm:px-6 sm:pt-20">
        <p className="eyebrow inline-flex items-center gap-2">
          <Radio className="h-3.5 w-3.5" />
          Real-time hazard intelligence · TinyFish live agents
        </p>

        <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-extrabold leading-[1.06] sm:text-6xl">
          See Environmental Risks{' '}
          <span
            style={{
              background: 'linear-gradient(100deg, var(--accent) 10%, var(--accent-strong) 90%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Before They Become Disasters.
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 sm:text-lg" style={{ color: 'var(--text-muted)' }}>
          Monitor real-time environmental threats, coordinate emergency response, and triage ground-level
          crisis data with TinyFish live web scraping agents.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button type="button" onClick={onLaunchMap} className="btn btn-primary w-full !px-7 !py-3.5 sm:w-auto">
            <MapIcon className="h-4 w-4" />
            Launch Live Map
          </button>
          <button
            type="button"
            onClick={onRunAgent}
            disabled={agentRunning}
            className="btn btn-ghost w-full !px-7 !py-3.5 sm:w-auto"
          >
            <Bot className="h-4 w-4" />
            {agentRunning ? 'Agent running…' : 'Run TinyFish Agent Demo'}
          </button>
        </div>

        <ul className="mx-auto mt-9 flex max-w-3xl flex-wrap items-center justify-center gap-2 text-xs">
          {[
            'USGS earthquakes · live',
            'GDACS global alerts · live',
            'Open-Meteo weather · live',
            'OpenAQ air quality · key needed',
            'NASA FIRMS fires · key needed',
          ].map((t) => (
            <li
              key={t}
              className="rounded-full border px-3 py-1.5"
              style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text-subtle)' }}
            >
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}