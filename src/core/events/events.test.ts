import { expect, it } from 'vitest';
import { createEventQueue } from './events';

it('keeps events in emission order and clears them', () => {
  const q = createEventQueue();
  q.emit({ type: 'ShotFired', x: 0, y: 0, angle: 0 });
  q.emit({ type: 'Hit', x: 1, y: 2, dirX: 1, dirY: 0, impulse: 5 });
  q.emit({ type: 'Killed', entityId: 3, kind: 'drone', x: 1, y: 2, radius: 26 });
  expect(q.events.map((e) => e.type)).toEqual(['ShotFired', 'Hit', 'Killed']);
  q.clear();
  expect(q.events).toHaveLength(0);
});
