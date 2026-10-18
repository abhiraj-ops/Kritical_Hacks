/**
 * Converts the raw Playwright screencast into a captioned 1080p MKV.
 *
 *   node scripts/make-video.mjs
 *
 * Requires ffmpeg on PATH (or a path in .ffmpeg-path).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const RAW_DIR = resolve(ROOT, 'video/raw');
const OUT_DIR = resolve(ROOT, 'video');
const SRT = resolve(ROOT, 'scripts/captions.srt');

mkdirSync(OUT_DIR, { recursive: true });

// --- locate ffmpeg -----------------------------------------------------------
function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const marker = resolve(ROOT, '.ffmpeg-path');
  if (existsSync(marker)) return readFileSync(marker, 'utf8').trim();
  return 'ffmpeg';
}
const FFMPEG = findFfmpeg();

// --- locate raw recording ----------------------------------------------------
const raw = readdirSync(RAW_DIR)
  .filter((f) => f.endsWith('.webm'))
  .map((f) => resolve(RAW_DIR, f))
  .sort((a, b) => (existsSync(b) && a < b ? 1 : -1))[0];

if (!raw) {
  console.error('No raw recording found. Run: node scripts/record-demo.mjs');
  process.exit(1);
}

// --- convert the CSV caption track into SRT ---------------------------------
function toSrt(csv) {
  const fmt = (s) => {
    const ms = Math.round(s * 1000);
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
    const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    const milli = String(ms % 1000).padStart(3, '0');
    return `${h}:${m}:${sec},${milli}`;
  };
  return csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((line) => {
      const [start, dur, ...rest] = line.split(',');
      return `${fmt(Number(start))} --> ${fmt(Number(start) + Number(dur))}\n${rest.join(',')}`;
    })
    .join('\n\n');
}

const SRT_OUT = resolve(OUT_DIR, 'captions.srt');
writeFileSync(SRT_OUT, toSrt(readFileSync(SRT, 'utf8')), { encoding: 'utf8' });

// --- build a drawtext chain (libass is broken in some Windows ffmpeg builds) --
const FONT = 'C\\:/Windows/Fonts/arialbd.ttf';

/** Escape text for ffmpeg filter syntax. */
const esc = (s) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "’")
    .replace(/%/g, '\\%');

const cues = readFileSync(SRT, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((line) => {
    const [start, dur, ...rest] = line.split(',');
    return { start: Number(start), dur: Number(dur), text: rest.join(',') };
  });

const drawtextChain = cues
  .map(
    (c) =>
      `drawtext=fontfile='${FONT}':text='${esc(c.text)}':` +
      `x=(w-text_w)/2:y=h-text_h-64:fontsize=42:fontcolor=white:` +
      `box=1:boxcolor=black@0.62:boxborderw=20:` +
      `enable='between(t\\,${c.start}\\,${(c.start + c.dur).toFixed(2)})'`,
  )
  .join(',');

const outFile = resolve(OUT_DIR, 'EcoPulseAI-demo.mkv');
const args = [
  '-y',
  '-i', raw,
  '-vf', drawtextChain,
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '20',
  '-pix_fmt', 'yuv420p',
  '-r', '30',
  '-c:a', 'libopus',
  '-b:a', '128k',
  '-shortest',
  outFile,
];

console.log(`ffmpeg  : ${FFMPEG}`);
console.log(`input   : ${raw}`);
console.log(`captions: ${cues.length} cues via drawtext`);
console.log('building MKV...\n');

try {
  const out = execFileSync(FFMPEG, args, {
    stdio: ['ignore', 'ignore', 'pipe'],
    encoding: 'utf8',
  });
  if (out) console.log(out.slice(-600));
} catch (err) {
  console.error('FFMPEG FAILED:\n', (err.stderr ?? err.message).slice(-2500));
  process.exit(1);
}

console.log(`\nDone -> ${outFile}`);
console.log(`Sidecar SRT -> ${SRT_OUT}`);