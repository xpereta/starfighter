import {
  devClearBattle,
  devClearEnemies,
  devJumpTo,
  devNextWave,
  devRestore,
  enemyCounts,
  jumpLabel,
  jumpTargets,
  nextBattleTarget,
} from '../core/run/dev-actions';
import type { World } from '../core/world/world';
import {
  buttonRow,
  choiceRow,
  statusLine,
  type Row,
  type Section,
  type UiContext,
} from './panel-ui';
import { SPAWN_COUNTS, SPAWN_REGISTRY, spawnAhead } from './spawn-registry';

export interface RunSpawnControls {
  /** Jump to the next battle (key N). */
  nextBattle(): void;
  /** Remove every enemy (key X). */
  clearEnemies(): void;
  /** Refresh the readouts; call about ten times a second. */
  update(world: World): void;
}

/**
 * The "Run phase" and "Spawn" sections: jump between phases, force waves, clear enemies, spawn any
 * enemy kind. The logic lives in `core/run/dev-actions.ts` and `spawn-registry.ts`; this is only the
 * buttons. `busy()` says why a world edit must be refused (a replay is recording or playing), or null.
 */
export function buildRunSpawnSections(
  ctx: UiContext,
  sections: { run: Section; spawn: Section },
  track: <T extends Row>(row: T, into: Section) => T,
  world: World,
  busy: () => string | null,
  refresh: () => void,
): RunSpawnControls {
  const runStatus = statusLine();
  const runReadout = statusLine();
  const spawnStatus = statusLine();
  const spawnReadout = statusLine();
  const counts = { n: SPAWN_COUNTS[0]! };

  /** Runs a world edit unless a replay is on; says what happened. */
  const act = (status: typeof runStatus, fn: () => string): void => {
    const why = busy();
    if (why) {
      status.set(
        `refused: a replay is ${why} and an edit would make it unreproducible (press Stop)`,
      );
      return;
    }
    try {
      status.set(fn());
      refresh();
      update(world);
    } catch (e) {
      status.set(`error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const button = (
    status: typeof runStatus,
    into: Section,
    label: string,
    note: string,
    fn: () => string,
  ): void => {
    track(
      buttonRow(ctx, label, () => act(status, fn), note),
      into,
    );
  };

  // Run phase ------------------------------------------------------------------------------------
  for (const target of jumpTargets(world.tuning.run.battleCount)) {
    const label = jumpLabel(target);
    button(
      runStatus,
      sections.run,
      `Jump: ${label}`,
      'Puts the run in this phase through the real run code: clears the field, pods and shots, sets the battle and wave, gives the squad a roster if it has none. Refused while a replay records or plays.',
      () => {
        devJumpTo(world, target);
        return `jumped to ${label}`;
      },
    );
  }
  button(
    runStatus,
    sections.run,
    'Next battle (N)',
    'Jumps to the battle after the current one (battle 1 from the start screen or practice).',
    () => {
      const target = nextBattleTarget(world);
      if (!target) throw new Error('this is the last battle');
      devJumpTo(world, target);
      return `jumped to ${jumpLabel(target)}`;
    },
  );
  button(
    runStatus,
    sections.run,
    'Next wave',
    'Starts the next wave now, without waiting for the current one to be cleared (capped at the battle’s last wave).',
    () => {
      devNextWave(world);
      return 'next wave started';
    },
  );
  button(
    runStatus,
    sections.run,
    'Clear battle',
    'Kills every enemy and skips the remaining waves, so the battle ends (debrief, or victory after the last battle). Not while enemies are frozen.',
    () => {
      devClearBattle(world);
      return world.tuning.arena.enemiesFrozen
        ? 'enemies killed; the battle will not end while enemies are frozen'
        : 'battle cleared';
    },
  );
  button(
    runStatus,
    sections.run,
    'Restore hull and squad',
    'Refills the hull and the living wingmen, and fills free squad slots with generated pilots up to the starting squad.',
    () => {
      devRestore(world);
      return 'hull and squad restored';
    },
  );
  sections.run.add(runStatus);
  sections.run.add(runReadout);

  // Spawn ----------------------------------------------------------------------------------------
  track(
    choiceRow<number>(ctx, {
      id: 'dev.spawnCount',
      label: 'Count per click',
      note: 'How many of a kind the buttons below spawn at once, in a row across your nose.',
      options: () => [...SPAWN_COUNTS],
      get: () => counts.n,
      set: (v) => (counts.n = v),
      trackChange: false,
    }),
    sections.spawn,
  );
  for (const entry of SPAWN_REGISTRY) {
    button(
      spawnStatus,
      sections.spawn,
      `Spawn ${entry.label}`,
      `Adds ${entry.label.toLowerCase()} in front of the ship, behaving like a normal one (same AI). Fighters stop a battle from ending until they are dead; other kinds do not count towards the objective.`,
      () => {
        const n = spawnAhead(world, entry, counts.n);
        return `spawned ${n} x ${entry.label}`;
      },
    );
  }
  button(
    spawnStatus,
    sections.spawn,
    'Clear all enemies (X)',
    'Removes every enemy: fighters are killed, drones, turrets and static dummies are deleted (practice: until R), shots and locks are dropped. In a battle the remaining waves still come.',
    () => {
      devClearEnemies(world);
      return 'all enemies cleared';
    },
  );
  sections.spawn.add(spawnStatus);
  sections.spawn.add(spawnReadout);

  function update(w: World): void {
    const { run } = w;
    const where =
      run.mode !== 'run'
        ? 'practice'
        : run.phase === 'battle'
          ? `battle ${run.battle}/${w.tuning.run.battleCount} wave ${run.wave}/${run.waveTotal} hull ${run.hull}`
          : run.phase === 'end'
            ? `end (${run.result})`
            : run.phase;
    runReadout.set(`now: ${where}`);
    const c = enemyCounts(w);
    spawnReadout.set(`enemies alive: ${c.fighters} fighters, ${c.targets} targets`);
  }
  update(world);

  return {
    nextBattle: () =>
      act(runStatus, () => {
        const target = nextBattleTarget(world);
        if (!target) throw new Error('this is the last battle');
        devJumpTo(world, target);
        return `jumped to ${jumpLabel(target)}`;
      }),
    clearEnemies: () =>
      act(spawnStatus, () => {
        devClearEnemies(world);
        return 'all enemies cleared';
      }),
    update,
  };
}
