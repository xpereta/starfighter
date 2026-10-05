import { describe, expect, it } from 'vitest';
import type { Pilot } from '../../core/pilots/pilots';
import { commSlide, commWindows, splitLine, splitName } from './comm';

const pilot = (id: number, name: string): Pilot => ({
  id,
  name,
  trait: 'steady',
  kills: 0,
  battles: 0,
  status: 'active',
  veteran: false,
});

describe('comm windows', () => {
  it('splits a chatter line into speaker and message', () => {
    expect(splitLine('Mara Vex: Splash one: nice.')).toEqual({
      speaker: 'Mara Vex',
      message: 'Splash one: nice.',
    });
    expect(splitLine('No speaker here')).toEqual({ speaker: '', message: 'No speaker here' });
  });

  it('splits a name into name and callsign', () => {
    expect(splitName('Mara Vex')).toEqual({ first: 'Mara', callsign: 'Vex' });
    expect(splitName('Solo')).toEqual({ first: 'Solo', callsign: '' });
  });

  it('builds a window per line with the speaker known from the roster', () => {
    const w = commWindows(
      [
        { text: 'Mara Vex: Got him.', trait: 'bold', age: 0.2 },
        { text: 'Joss Hale: Covering.', trait: 'guardian', age: 1 },
      ],
      [pilot(1, 'Mara Vex')],
    );
    expect(w).toHaveLength(2);
    expect(w[0]).toMatchObject({
      name: 'Mara Vex',
      first: 'Mara',
      callsign: 'Vex',
      message: 'Got him.',
    });
    expect(w[1]!.first).toBe('Joss');
  });

  it('slides in, holds and slides out at the end of its life', () => {
    expect(commSlide(0, 6, 0.3).off).toBe(1);
    expect(commSlide(0.3, 6, 0.3).off).toBe(0);
    expect(commSlide(3, 6, 0.3)).toMatchObject({ off: 0, alpha: 1 });
    expect(commSlide(5.9, 6, 0.3).phase).toBe('out');
    expect(commSlide(6.2, 6, 0.3).phase).toBe('done');
  });
});
