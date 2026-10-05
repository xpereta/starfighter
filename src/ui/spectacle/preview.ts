import type { GameEvent } from '../../core/events/events';

/**
 * Previews for the dev panel: synthetic events fed to the presentation layer (never to the world),
 * so a designer can see a kill-cam, a hit or a title card on demand instead of waiting for one.
 */

const kill = (kind: 'drone' | 'fighter' | 'turret'): GameEvent => ({
  type: 'Killed',
  entityId: -1,
  kind,
  x: 0,
  y: 0,
  radius: 20,
});

export const PREVIEWS = {
  killcam: {
    label: 'Preview: salvo multi-kill',
    note: 'A missile salvo that kills three enemies: zoom punch, freeze frame, speed-line flash and the kill call-out.',
    events: (): GameEvent[] => [
      { type: 'SalvoFired', count: 3 },
      kill('fighter'),
      kill('drone'),
      kill('drone'),
    ],
  },
  bigkill: {
    label: 'Preview: big kill',
    note: 'A turret destroyed: zoom punch, shake and a tiny hit-stop.',
    events: (): GameEvent[] => [kill('turret')],
  },
  damage: {
    label: 'Preview: hull hit',
    note: 'The player is hit: hard shake, zoom punch and the red damage flash.',
    events: (): GameEvent[] => [{ type: 'PlayerDamaged', x: 0, y: 0, hull: 2 }],
  },
  battle: {
    label: 'Preview: battle title card',
    note: 'The BATTLE n title card.',
    events: (): GameEvent[] => [{ type: 'BattleStarted', battle: 2 }],
  },
  cleared: {
    label: 'Preview: battle cleared',
    note: 'The BATTLE CLEARED card with its flash.',
    events: (): GameEvent[] => [{ type: 'BattleCleared', battle: 2 }],
  },
  lost: {
    label: 'Preview: pilot lost',
    note: 'A pilot is shot down: the PILOT LOST banner, shake and freeze.',
    events: (): GameEvent[] => [{ type: 'PilotLost', pilotId: 1 }],
  },
} as const;
export type PreviewName = keyof typeof PREVIEWS;

type Inject = (events: readonly GameEvent[]) => void;
let target: Inject | null = null;

/** The controller registers itself here so the panel can reach it without importing the app. */
export function setPreviewTarget(inject: Inject | null): void {
  target = inject;
}

export function runPreview(name: PreviewName): boolean {
  if (!target) return false;
  target(PREVIEWS[name].events());
  return true;
}
