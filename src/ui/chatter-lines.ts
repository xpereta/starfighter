import { TRAIT_IDS, type TraitId } from '../../data/content/traits';

/**
 * Radio line templates: three per trait and event kind, so a pilot sounds like their trait.
 * `{name}` is the pilot the line is about; `{self}` is the speaker (the same pilot for their own events).
 * Kept short: a line must fit one row of the feed.
 */
export const CHATTER_KINDS = [
  'joined',
  'rescued',
  'kill',
  'hurt',
  'lost',
  'cleared',
  'won',
] as const;
export type ChatterKind = (typeof CHATTER_KINDS)[number];

type Lines = readonly [string, string, string];

export const CHATTER_LINES: Record<TraitId, Record<ChatterKind, Lines>> = {
  sharpshooter: {
    joined: [
      '{self} here. Lining up shots.',
      'Sharpshooter {self} reporting.',
      '{self} on your wing.',
    ],
    rescued: [
      'Pod pickup, thanks. {self} here.',
      '{self}, alive. I owe you one.',
      'Good flying. {self} joining up.',
    ],
    kill: ['Clean shot.', 'One down.', 'Target down.'],
    hurt: ['{self} hit, hull low!', 'Took a hit. Hull low.', 'I am hurt. Cover me.'],
    lost: ['{name} is down.', 'We lost {name}.', '{name}... gone.'],
    cleared: ['Sector clear.', 'All targets down.', 'That is the last of them.'],
    won: ['Mission complete.', 'Every target accounted for.', 'We did it.'],
  },
  steady: {
    joined: ['{self} here. Holding formation.', 'Steady {self}, ready.', '{self} on your wing.'],
    rescued: ['Thank you. {self} here.', '{self}, safe. Ready to fly.', 'Back in the fight.'],
    kill: ['Splash one.', 'Got him.', 'Down he goes.'],
    hurt: ['Taking damage, hull low.', '{self} here, hull is low.', 'Still flying, barely.'],
    lost: ['{name} is gone.', 'Lost {name}. Stay together.', 'No chute for {name}.'],
    cleared: ['Clear. Regroup.', 'That is all of them.', 'Battle cleared.'],
    won: ['We held. Well done.', 'Run complete.', 'All of us, home.'],
  },
  bold: {
    joined: ['{self} here. Where are they?', 'Let me at them!', '{self}, ready to burn.'],
    rescued: [
      'Out of the pod! {self} is back!',
      'Thanks! Now let me fight.',
      '{self} is in. Point me at them.',
    ],
    kill: ['Too slow!', 'Got another!', 'Boom!'],
    hurt: ['Hull low, still going!', 'That stung. Hull low.', 'I am hit, but not out.'],
    lost: ['{name}! No!', '{name} is down!', 'Damn. {name}.'],
    cleared: ['Is that all?', 'Easy.', 'Send more!'],
    won: ['Hah! We won!', 'Told you!', 'That is how it is done!'],
  },
  guardian: {
    joined: [
      '{self} here. I have your back.',
      'Guardian {self} on you.',
      '{self} watching your six.',
    ],
    rescued: [
      'Thank you. I have your back now.',
      '{self}, back on guard.',
      'I will watch your six.',
    ],
    kill: ['Off your tail.', 'Cleared your six.', 'Threat down.'],
    hurt: ['Hull low. Still on you.', 'Hit. Hull low.', 'I am hurt, keep moving.'],
    lost: ['{name} is down!', 'We lost {name}.', 'Not {name}...'],
    cleared: ['All clear. Check your hull.', 'Nothing behind us.', 'Six is clear.'],
    won: ['We all made it out.', 'Safe skies.', 'Done. Stay sharp.'],
  },
  hunter: {
    joined: ['{self} here. Hunting.', 'Hunter {self}, missiles ready.', '{self} on your wing.'],
    rescued: [
      'Pod open. {self} hunts again.',
      'Thanks. Missiles hot.',
      '{self} is back in the hunt.',
    ],
    kill: ['Splash!', 'Missile hit!', 'Hunted down.'],
    hurt: ['I am hit, hull low!', 'Hull low. Still hunting.', 'Taking fire, hull low.'],
    lost: ['{name} is down.', '{name} did not make it.', 'We lost {name}.'],
    cleared: ['The hunt is over.', 'Nothing left to hunt.', 'Clear.'],
    won: ['Good hunting.', 'Run is ours.', 'Hunt complete.'],
  },
};

/** Throws on a missing or empty template; run at load so a typo cannot reach the screen. */
export function validateChatterLines(
  lines: Record<TraitId, Record<ChatterKind, Lines>> = CHATTER_LINES,
): void {
  for (const trait of TRAIT_IDS) {
    for (const kind of CHATTER_KINDS) {
      const set = lines[trait]?.[kind];
      if (!set || set.length !== 3 || set.some((l) => l.trim() === '')) {
        throw new Error(`Chatter "${trait}.${kind}" needs three non-empty lines`);
      }
    }
  }
}

validateChatterLines();
