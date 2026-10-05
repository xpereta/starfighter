import type { MusicStatus } from '../audio/conductor';

/** The score's state in one line: "flying · battle bar 3/8 · intensity 0.62 (target 0.70) · heat 0.10 · 124 bpm". */
export function formatMusicStatus(s: MusicStatus): string {
  const scene = { menu: 'start screen', flight: 'flying', debrief: 'debrief', end: 'end' }[s.scene];
  return [
    `${scene}${s.forced ? ' (forced)' : ''}`,
    `${s.cue || '-'} bar ${s.bars ? s.bar + 1 : 0}/${s.bars}`,
    `intensity ${s.intensity.toFixed(2)} (target ${s.target.toFixed(2)})`,
    `heat ${s.heat.toFixed(2)}`,
    `${Math.round(s.bpm)} bpm`,
    s.sting ? `stinger ${s.sting}` : 'no stinger',
  ].join(' · ');
}

/** The layers that are audible, with their level: "on: pad 60%, bassCalm 70% | off: kick, snare". */
export function formatStems(stems: readonly { id: string; gain: number }[]): string {
  const on = stems
    .filter((s) => s.gain >= 0.005)
    .map((s) => `${s.id} ${Math.round(s.gain * 100)}%`);
  const off = stems.filter((s) => s.gain < 0.005).map((s) => s.id);
  return (
    `on: ${on.length ? on.join(', ') : 'none'}` + (off.length ? ` | off: ${off.join(', ')}` : '')
  );
}
