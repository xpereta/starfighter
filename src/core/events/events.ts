/** Typed gameplay events. FX, audio, HUD and stats subscribe to these without touching gameplay code. */
export type GameEvent =
  | { type: 'ShotFired'; x: number; y: number; angle: number }
  | { type: 'Hit'; x: number; y: number; dirX: number; dirY: number; impulse: number }
  | {
      type: 'Killed';
      entityId: number;
      kind: 'static' | 'drone' | 'turret';
      x: number;
      y: number;
      radius: number;
    }
  | { type: 'EvadeStarted'; x: number; y: number; side: -1 | 1 };

export interface EventQueue {
  /** Events emitted since the last `clear()`, in emission order. */
  readonly events: readonly GameEvent[];
  emit(event: GameEvent): void;
  clear(): void;
}

export function createEventQueue(): EventQueue {
  const events: GameEvent[] = [];
  return {
    events,
    emit: (event) => {
      events.push(event);
    },
    clear: () => {
      events.length = 0;
    },
  };
}
