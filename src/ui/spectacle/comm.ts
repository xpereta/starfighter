import type { Pilot } from '../../core/pilots/pilots';
import type { ChatterLine } from '../chatter';
import { slide, type Slide } from './anim';

/**
 * Radio chatter as comm windows. The chatter feed (`ui/chatter.ts`) queues and rations the lines;
 * this turns each visible line into a window with the pilot's name, callsign and portrait seed. Pure.
 */

export interface CommWindow {
  /** The speaker's full name (the portrait seed). */
  name: string;
  /** First name and callsign, for the two lines of the nameplate. */
  first: string;
  callsign: string;
  message: string;
  trait: ChatterLine['trait'];
  age: number;
}

/** Splits `Mara Vex: Nice shot.` into the speaker and the message. The speaker is the text up to the first colon. */
export function splitLine(text: string): { speaker: string; message: string } {
  const i = text.indexOf(': ');
  return i < 0
    ? { speaker: '', message: text }
    : { speaker: text.slice(0, i), message: text.slice(i + 2) };
}

/** A pilot name is "First Callsign"; one word is a name with no callsign. */
export function splitName(name: string): { first: string; callsign: string } {
  const i = name.indexOf(' ');
  return i < 0
    ? { first: name, callsign: '' }
    : { first: name.slice(0, i), callsign: name.slice(i + 1) };
}

/** A window per visible chatter line, oldest first. `roster` is only used to confirm the speaker is a known pilot. */
export function commWindows(lines: readonly ChatterLine[], roster: readonly Pilot[]): CommWindow[] {
  return lines.map((l) => {
    const { speaker, message } = splitLine(l.text);
    const known = roster.find((p) => p.name === speaker);
    const name = known ? known.name : speaker;
    const { first, callsign } = splitName(name);
    return { name, first, callsign, message, trait: l.trait, age: l.age };
  });
}

/** The slide of a window: it slides in from the right edge, holds, and slides out for the last `slideTime` of its `life`. */
export function commSlide(age: number, life: number, slideTime: number): Slide {
  return slide(age, slideTime, Math.max(0, life - 2 * slideTime), slideTime);
}
