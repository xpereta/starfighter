import type { EntityKind } from '../world/target';

/** Typed gameplay events. FX, audio, HUD and stats subscribe to these without touching gameplay code. */
export type GameEvent =
  | { type: 'ShotFired'; x: number; y: number; angle: number }
  | { type: 'Hit'; x: number; y: number; dirX: number; dirY: number; impulse: number }
  | {
      type: 'Killed';
      entityId: number;
      kind: EntityKind;
      x: number;
      y: number;
      radius: number;
    }
  | { type: 'EvadeStarted'; x: number; y: number; side: -1 | 1 }
  // Lock-on (Prototype 2). `targetId` is a lockable id, see core/world/lockable.ts.
  | { type: 'LockAcquiring'; targetId: number }
  | { type: 'LockAcquired'; targetId: number }
  | { type: 'LockLost'; targetId: number; reason: 'cone' | 'range' | 'dead' }
  // Missiles.
  | { type: 'SalvoFired'; count: number }
  | { type: 'MissileLaunched'; x: number; y: number; angle: number; targetId: number }
  // Squadron orders.
  | { type: 'OrderGiven'; order: 'attack' | 'tight' | 'spread' }
  // Run flow (Prototype 3).
  | { type: 'BattleStarted'; battle: number }
  | { type: 'WaveStarted'; battle: number; wave: number }
  | { type: 'BattleCleared'; battle: number }
  | { type: 'RunEnded'; result: 'victory' | 'defeat' }
  // Pilots and rescue pods.
  | { type: 'PilotJoined'; pilotId: number; how: 'rescue' | 'pick' | 'veteran' }
  | { type: 'PilotLost'; pilotId: number }
  | { type: 'PilotKill'; pilotId: number }
  | { type: 'PodSpawned'; x: number; y: number }
  | { type: 'PodRescued'; pilotId: number }
  | { type: 'PodLost' }
  // Sound-only additions (prototype 4). Events are not state: nothing reads them to change the world or the hash.
  // Enemy and wingman guns, kept apart from `ShotFired` (the player's) because the camera shakes on that one.
  | { type: 'EnemyShotFired'; x: number; y: number; angle: number; from: 'turret' | 'fighter' }
  | { type: 'WingmanShotFired'; x: number; y: number; angle: number }
  // An enemy bullet reached the player (`Hit` is emitted too, for sparks and shake), the player's hull is `hull` after it.
  | { type: 'PlayerDamaged'; x: number; y: number; hull: number }
  | { type: 'WingmanHit'; x: number; y: number }
  | { type: 'WingmanDown'; x: number; y: number }
  | { type: 'MissileImpact'; x: number; y: number }
  | { type: 'ArenaEdgeEntered' }
  | { type: 'ArenaEdgeLeft' }
  | { type: 'PlayerRespawned' }
  // Menus (run mode, outside a battle).
  | { type: 'MenuMove'; dir: -1 | 1 }
  | { type: 'MenuSelect' }
  | { type: 'MenuBack' }
  | { type: 'MenuTick'; checked: boolean }
  | { type: 'MenuPick' };

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
