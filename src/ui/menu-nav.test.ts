import { describe, expect, it } from 'vitest';
import { createActions } from '../core/world/actions';
import { maskFlightActions } from './menu-nav';

const flags = (over: Partial<ReturnType<typeof createActions>> = {}) => ({
  ...createActions(),
  ...over,
});

describe('maskFlightActions', () => {
  it('clears every flight control and keeps the menu buttons', () => {
    const a = flags({
      steerX: 1,
      steerY: -1,
      rotate: 1,
      throttle: 1,
      fire: true,
      evade: true,
      respawn: true,
      startTrial: true,
      launch: true,
      attackOrder: true,
      cycleFormation: true,
      menuUp: true,
      menuDown: true,
      menuSelect: true,
      menuBack: true,
    });
    maskFlightActions(a);
    expect(a).toEqual({
      ...createActions(),
      menuUp: true,
      menuDown: true,
      menuSelect: true,
      menuBack: true,
    });
  });
});
