import type { GameEvent } from '../../core/events/events';
import type { CardsDef } from '../spectacle-contract';

/**
 * Run-level drama: title cards drawn over the game in the style's voice (letterbox bars, a wiped
 * title, a gold sunburst for victory, a red strike when a pilot is lost). A render-only DOM layer:
 * it reads events, never takes input (`pointer-events: none`) and never touches menus or the HUD.
 */

export type CardKind = 'intro' | 'outro' | 'pilot' | 'victory' | 'defeat';

export interface CardSpec {
  kind: CardKind;
  /** Small line above the title ("BATTLE 2"), may be empty. */
  kicker: string;
  title: string;
  subtitle: string;
  seconds: number;
}

const pick = (list: readonly string[], i: number): string => list[Math.max(0, i) % list.length]!;

/** The card a game event asks for, or null. Pure. */
export function cardFor(e: GameEvent, def: CardsDef): CardSpec | null {
  switch (e.type) {
    case 'BattleStarted':
      return {
        kind: 'intro',
        kicker: `BATTLE ${e.battle}`,
        title: pick(def.battleTitles, e.battle - 1),
        subtitle: pick(def.subtitles, e.battle - 1),
        seconds: def.duration,
      };
    case 'BattleCleared':
      return {
        kind: 'outro',
        kicker: `BATTLE ${e.battle}`,
        title: def.cleared,
        subtitle: '',
        seconds: def.duration * 0.8,
      };
    case 'PilotLost':
      return {
        kind: 'pilot',
        kicker: '',
        title: def.pilotLost,
        subtitle: '',
        seconds: def.duration * 0.6,
      };
    case 'RunEnded':
      return e.result === 'victory'
        ? {
            kind: 'victory',
            kicker: '',
            title: def.victory,
            subtitle: '',
            seconds: def.duration * 1.6,
          }
        : {
            kind: 'defeat',
            kicker: '',
            title: def.defeat,
            subtitle: '',
            seconds: def.duration * 1.4,
          };
    default:
      return null;
  }
}

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
const STYLE_ID = 'sf-cards-style';

const CSS = `
#sf-cards { position: fixed; inset: 0; z-index: 4; pointer-events: none; overflow: hidden; font-family: ui-monospace, Menlo, Consolas, monospace; }
#sf-cards .bar { position: absolute; left: 0; right: 0; background: #000; transform: scaleY(0); }
#sf-cards .bar.top { top: 0; transform-origin: top; }
#sf-cards .bar.bottom { bottom: 0; transform-origin: bottom; }
#sf-cards .box { position: absolute; left: 0; right: 0; top: 26%; text-align: center; opacity: 0; }
#sf-cards .kicker { font-size: 15px; letter-spacing: 0.5em; opacity: 0.9; }
#sf-cards .title { font-size: clamp(28px, 6vw, 72px); font-weight: 800; letter-spacing: 0.16em; margin-top: 6px; text-shadow: 0 0 24px var(--accent), 0 2px 0 #000; clip-path: inset(0 100% 0 0); }
#sf-cards .rule { height: 3px; width: 0; margin: 10px auto; background: var(--accent); box-shadow: 0 0 14px var(--accent); }
#sf-cards .sub { font-size: 16px; letter-spacing: 0.3em; opacity: 0.85; }
#sf-cards .rays { position: absolute; left: 50%; top: 38%; width: 160vmax; height: 160vmax; margin: -80vmax 0 0 -80vmax; opacity: 0;
  background: repeating-conic-gradient(from 0deg, var(--accent) 0deg 4deg, transparent 4deg 16deg);
  -webkit-mask-image: radial-gradient(circle, #000 0%, transparent 55%); mask-image: radial-gradient(circle, #000 0%, transparent 55%); }
#sf-cards .wash { position: absolute; inset: 0; opacity: 0; background: radial-gradient(circle, transparent 35%, var(--accent) 140%); }
#sf-cards.on .bar { animation: sf-bar var(--dur) ease-in-out forwards; }
#sf-cards.on .box { animation: sf-box var(--dur) ease-in-out forwards; }
#sf-cards.on .title { animation: sf-wipe calc(var(--dur) * 0.28) cubic-bezier(.2,.8,.2,1) forwards; }
#sf-cards.on .rule { animation: sf-rule calc(var(--dur) * 0.35) ease-out 0.1s forwards; }
#sf-cards.victory .rays { animation: sf-rays var(--dur) linear forwards; }
#sf-cards.pilot .wash, #sf-cards.defeat .wash, #sf-cards.victory .wash { animation: sf-wash var(--dur) ease-out forwards; }
#sf-cards.pilot .box { top: 62%; }
#sf-cards.pilot .title { font-size: clamp(22px, 3.6vw, 44px); }
@keyframes sf-bar { 0% { transform: scaleY(0); } 14% { transform: scaleY(1); } 82% { transform: scaleY(1); } 100% { transform: scaleY(0); } }
@keyframes sf-box { 0% { opacity: 0; } 8% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
@keyframes sf-wipe { to { clip-path: inset(0 0 0 0); } }
@keyframes sf-rule { to { width: min(46vw, 520px); } }
@keyframes sf-rays { 0% { opacity: 0; transform: rotate(0deg) scale(.6); } 15% { opacity: .35; } 100% { opacity: 0; transform: rotate(40deg) scale(1.2); } }
@keyframes sf-wash { 0% { opacity: .8; } 100% { opacity: 0; } }
`;

export interface Cards {
  /** The card showing now (for tests and the readout), or null. */
  current(): CardSpec | null;
  consume(events: readonly GameEvent[], def: CardsDef): void;
  /** Ends the card that is showing. */
  clear(): void;
  dispose(): void;
}

export function createCards(container: HTMLElement): Cards {
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const root = document.createElement('div');
  root.id = 'sf-cards';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML =
    '<div class="wash"></div><div class="rays"></div><div class="bar top"></div><div class="bar bottom"></div>' +
    '<div class="box"><div class="kicker"></div><div class="title"></div><div class="rule"></div><div class="sub"></div></div>';
  container.appendChild(root);
  const q = (sel: string): HTMLElement => root.querySelector(sel) as HTMLElement;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let current: CardSpec | null = null;

  const clear = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
    current = null;
    root.className = '';
  };

  return {
    current: () => current,
    consume(events, def) {
      for (const e of events) {
        const spec = cardFor(e, def);
        if (!spec) continue;
        clear();
        current = spec;
        const accent =
          spec.kind === 'pilot' || spec.kind === 'defeat'
            ? 0xff3a4a
            : spec.kind === 'victory'
              ? 0xffd23f
              : def.accent;
        root.style.setProperty('--accent', hex(accent));
        root.style.setProperty('--dur', `${spec.seconds}s`);
        root.style.color = hex(def.text);
        const bar = `${def.letterbox * 100}vh`;
        const letterbox = spec.kind === 'pilot' ? '0' : bar;
        q('.bar.top').style.height = letterbox;
        q('.bar.bottom').style.height = letterbox;
        q('.kicker').textContent = spec.kicker;
        q('.title').textContent = spec.title;
        q('.sub').textContent = spec.subtitle;
        // Restart the CSS animations: drop the class, force a reflow, add it back.
        root.className = '';
        void root.offsetWidth;
        root.className = `on ${spec.kind}`;
        timer = setTimeout(clear, spec.seconds * 1000 + 50);
      }
    },
    clear,
    dispose() {
      clear();
      root.remove();
    },
  };
}
