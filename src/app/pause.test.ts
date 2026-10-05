import { describe, expect, it } from 'vitest';
import { canPause, createPause } from './pause';

describe('createPause', () => {
  it('toggles on the press, not while held', () => {
    const p = createPause();
    p.update(true, true);
    expect(p.paused).toBe(true);
    p.update(true, true); // still held
    expect(p.paused).toBe(true);
    p.update(false, true);
    p.update(true, true);
    expect(p.paused).toBe(false);
  });

  it('does nothing where pausing is not allowed', () => {
    const p = createPause();
    p.update(true, false);
    expect(p.paused).toBe(false);
  });
});

describe('canPause', () => {
  it('is true in practice and in a battle, false on the menus', () => {
    expect(canPause({ run: { mode: 'practice', phase: 'battle' } } as never)).toBe(true);
    expect(canPause({ run: { mode: 'run', phase: 'battle' } } as never)).toBe(true);
    for (const phase of ['start', 'debrief', 'end'])
      expect(canPause({ run: { mode: 'run', phase } } as never)).toBe(false);
  });
});
