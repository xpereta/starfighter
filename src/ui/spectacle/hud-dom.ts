import { bannerSlide, type Banner } from './banners';
import { feedAlpha, type Combo, type FeedEntry } from './combo';
import { commSlide, type CommWindow } from './comm';
import {
  applyColors,
  createPortraits,
  el,
  pipRow,
  setClass,
  setHidden,
  setStyle,
  setText,
} from './dom';
import { SEGMENT_WEIGHT } from '../../render/hud/capital-bar';
import type { CapitalModel, HudModel, RosterCard } from './hud-model';
import type { PresentationDef } from './presentation';

/**
 * The spectacle HUD: angled panels with glowing readouts, the squad roster with portraits, comm
 * windows, title cards, the score, the streak and the kill feed. A DOM overlay drawn from a plain
 * `HudModel` (see hud-model.ts); it builds its elements once and touches them only when a value changes.
 */

export interface HudDrawInput {
  model: HudModel;
  combo: Combo;
  banner: Banner | null;
  comms: readonly CommWindow[];
  /** Seconds a chatter line lives (the comm window slides out at the end of it). */
  chatterLife: number;
  flags: {
    hud: boolean;
    portraits: boolean;
    comms: boolean;
    banners: boolean;
    feed: boolean;
    combo: boolean;
  };
}

export interface SpectacleHud {
  /** Mounted root, for tests. */
  readonly root: HTMLElement;
  draw(input: HudDrawInput): void;
  dispose(): void;
}

const rosterKey = (cards: readonly RosterCard[], portraits: boolean): string =>
  `${portraits}|${cards.map((c) => `${c.name}:${c.trait}:${c.hull.join('')}:${c.fallen}`).join('|')}`;

export function createSpectacleHud(
  container: HTMLElement,
  def: PresentationDef,
  slideTime: number,
): SpectacleHud {
  const root = el('div', 'sx-root');
  root.id = 'sx-hud';
  applyColors(root, def.colors);
  const portrait = createPortraits(def.portraits);

  // Top left: hull, status, squad line, roster.
  const tl = el('div', 'sx-tl');
  const hullWrap = el('div', 'sx-glow');
  const hull = el('div', 'sx-panel sx-hull');
  const hullRow = el('div', 'sx-hull-row');
  const hullLabel = el('span', 'sx-label', 'HULL');
  const hullText = el('span', 'sx-num', '');
  hullRow.append(hullLabel, hullText);
  const segs = el('div', 'sx-segs');
  const status = el('div', 'sx-status');
  const killsText = el('span');
  const hitsText = el('span');
  status.append(killsText, hitsText);
  const squadLine = el('div', 'sx-squadline');
  hull.append(hullRow, segs, status, squadLine);
  hullWrap.append(hull);
  const roster = el('div', 'sx-roster');
  tl.append(hullWrap, roster);

  // Top centre: objective.
  const top = el('div', 'sx-top');
  const objectiveWrap = el('div', 'sx-glow gold');
  const objective = el('div', 'sx-objective');
  const objTitle = el('div', 't');
  const objSub = el('div', 's');
  objective.append(objTitle, objSub);
  objectiveWrap.append(objective);
  const trial = el('div', 'sx-trial');
  const warning = el('div', 'sx-warning', 'RETURN TO ARENA');
  // Prototype 5 enemy cues: the capital ship's bar of parts, the MISSILE warning and the wing banner.
  const capitalWrap = el('div', 'sx-capital');
  const capitalGlow = el('div', 'sx-glow hot');
  const capitalBox = el('div', 'sx-capbox');
  const capitalHead = el('div', 'head');
  const capitalLabel = el('span', 'name');
  const capitalCaption = el('span', 'caption');
  capitalHead.append(capitalLabel, capitalCaption);
  const capitalSegs = el('div', 'segs');
  capitalBox.append(capitalHead, capitalSegs);
  capitalGlow.append(capitalBox);
  const coreCall = el('div', 'sx-corecall');
  coreCall.append(el('span', 'tri', '\u25B6'), el('span', 'txt'), el('span', 'tri', '\u25C0'));
  capitalWrap.append(capitalGlow, coreCall);
  const alertWrap = el('div', 'sx-glow hot sx-alertwrap');
  const alert = el('div', 'sx-alert');
  const alertArrow = el('span', 'arrow', '\u25B6\u25B6');
  const alertText = el('span', 'txt');
  alert.append(alertArrow, alertText);
  alertWrap.append(alert);
  const cueWrap = el('div', 'sx-glow gold sx-cuewrap');
  const cueEl = el('div', 'sx-cue');
  cueWrap.append(cueEl);
  top.append(objectiveWrap, trial, warning, capitalWrap, alertWrap, cueWrap);

  // Top right: score, streak, feed.
  const tr = el('div', 'sx-tr');
  const scoreWrap = el('div', 'sx-glow');
  const score = el('div', 'sx-panel mirror');
  const scoreLabel = el('div', 'sx-label', 'SCORE');
  const scoreValue = el('div', 'sx-scorevalue sx-num');
  const streak = el('div', 'sx-streak');
  const streakRow = el('div', 'row');
  const streakTier = el('span', 'tier');
  const streakMult = el('span', 'm');
  const streakCount = el('span', 'n');
  streakRow.append(streakTier, streakMult, streakCount);
  const streakBar = el('div', 'bar');
  const streakFill = el('i');
  streakBar.append(streakFill);
  streak.append(streakRow, streakBar);
  score.append(scoreLabel, scoreValue, streak);
  scoreWrap.append(score);
  const feed = el('div', 'sx-feed');
  tr.append(scoreWrap, feed);
  const call = el('div', 'sx-call');
  call.hidden = true;

  // Bottom left: flight and locks.
  const bl = el('div', 'sx-bl');
  const flightWrap = el('div', 'sx-glow');
  const flight = el('div', 'sx-panel');
  const speed = el('div', 'sx-speed');
  const speedLeft = el('div');
  const speedValue = el('span', 'v sx-num');
  speedLeft.append(speedValue, el('span', 'u', 'U/S'));
  const speedState = el('span', 'st');
  speed.append(speedLeft, speedState);
  const meter = el('div', 'sx-meter');
  const meterFill = el('i');
  const markCorner = el('b');
  const markCruise = el('b');
  meter.append(meterFill, markCorner, markCruise);
  const evade = el('div', 'sx-evade');
  const evadeText = el('span', 't sx-label');
  const evadeMeter = el('div', 'sx-meter meter');
  const evadeFill = el('i');
  evadeMeter.append(evadeFill);
  evade.append(el('span', 'sx-label', 'EVADE'), evadeMeter, evadeText);
  flight.append(speed, meter, evade);
  flightWrap.append(flight);
  const locksWrap = el('div', 'sx-glow gold');
  const locksPanel = el('div', 'sx-panel');
  const locksRow = el('div', 'sx-locks');
  const diamonds = el('div', 'sx-diamonds');
  const salvo = el('div', 'sx-salvo');
  const salvoText = el('div', 't');
  const salvoMeter = el('div', 'sx-meter meter');
  const salvoFill = el('i');
  salvoMeter.append(salvoFill);
  salvo.append(salvoText, salvoMeter);
  locksRow.append(el('span', 'sx-label', 'LOCKS'), diamonds, salvo);
  locksPanel.append(locksRow);
  locksWrap.append(locksPanel);
  bl.append(locksWrap, flightWrap);

  // Bottom right: comm windows.
  const commsBox = el('div', 'sx-comms');

  // Banner slot.
  const bannerSlot = el('div', 'sx-banner-slot');

  root.append(tl, top, tr, call, bl, commsBox, bannerSlot);
  container.append(root);

  let lastRoster = '';
  let lastHullKey = '';
  let lastLocksKey = '';
  const feedEls = new Map<FeedEntry, HTMLElement>();
  const commEls = new Map<string, HTMLElement>();
  let shownBanner: Banner | null = null;
  let bannerEl: HTMLElement | null = null;
  let lastCall = '';
  let lastCapitalKey = '';
  const capitalCells: { cell: HTMLElement; fill: HTMLElement }[] = [];

  function drawRoster(cards: readonly RosterCard[], portraits: boolean): void {
    const key = rosterKey(cards, portraits);
    if (key === lastRoster) return;
    lastRoster = key;
    roster.replaceChildren(
      ...cards.map((c) => {
        const card = el('div', `sx-card${c.fallen ? ' fallen' : ''}${portraits ? '' : ' nop'}`);
        if (portraits) card.append(portrait(c.name));
        const info = el('div');
        info.append(el('div', 'who', c.first));
        info.append(el('div', 'cs', `${c.callsign || c.trait} · ${c.trait}`.toUpperCase()));
        if (c.fallen) info.append(el('div', 'lost', 'LOST'));
        else info.append(pipRow('pips', 'pip', c.hull));
        card.append(info);
        return card;
      }),
    );
  }

  function drawBanner(banner: Banner | null, on: boolean, portraits: boolean): void {
    const wanted = on ? banner : null;
    if (wanted !== shownBanner) {
      shownBanner = wanted;
      bannerEl?.remove();
      bannerEl = null;
      if (wanted) {
        const b = el('div', `sx-banner ${wanted.kind} ${wanted.big ? 'big' : 'small'}`);
        const band = el('div', 'band');
        if (wanted.who && portraits) {
          b.classList.add('who');
          band.append(portrait(wanted.who));
        }
        const text = el('div');
        if (wanted.big) text.append(el('div', 'kicker', def.words.tagline));
        text.append(el('div', 'title', wanted.title));
        if (wanted.sub) text.append(el('div', 'sub', wanted.sub));
        band.append(text);
        b.append(band);
        bannerEl = b;
        bannerSlot.append(b);
      }
    }
    if (wanted && bannerEl) {
      const s = bannerSlide(wanted, def);
      const dir = s.phase === 'out' ? 1 : -1;
      const travel = wanted.big ? 70 : 0;
      const y = wanted.big ? 0 : -s.off * 90;
      bannerEl.style.transform = `translate(${(dir * s.off * travel).toFixed(1)}vw, ${y.toFixed(1)}px)`;
      bannerEl.style.opacity = s.alpha.toFixed(2);
    }
  }

  /** The capital ship's bar: one cell per part, wide for the core, a gold underline on the plates that still shield it. */
  function drawCapital(m: CapitalModel | null): void {
    setHidden(capitalWrap, m === null);
    if (!m) return;
    const key = m.segments.map((g) => g.role).join('|');
    if (key !== lastCapitalKey) {
      lastCapitalKey = key;
      capitalCells.length = 0;
      capitalSegs.replaceChildren(
        ...m.segments.map((g, i) => {
          const cell = el('i', `cell ${g.role}`);
          const fill = el('b');
          cell.append(fill);
          cell.style.flexGrow = String(SEGMENT_WEIGHT[g.role]);
          // A little extra space where the role changes.
          if (i > 0 && m.segments[i - 1]!.role !== g.role) cell.style.marginLeft = '8px';
          capitalCells.push({ cell, fill });
          return cell;
        }),
      );
    }
    m.segments.forEach((g, i) => {
      const c = capitalCells[i];
      if (!c) return;
      setClass(c.cell, 'dead', !g.alive);
      setClass(c.cell, 'covered', g.covered);
      setClass(c.cell, 'core', g.isCore);
      setClass(c.cell, 'shield', g.coversCore && g.alive);
      setStyle(c.fill, 'width', `${(g.fraction * 100).toFixed(1)}%`);
    });
    setText(capitalLabel, m.label);
    setText(capitalCaption, m.caption);
    setClass(capitalBox, 'exposed', m.exposed);
    setClass(capitalBox, 'dying', m.dying);
    setHidden(coreCall, !m.exposed);
    if (m.exposed) setText(coreCall.children[1] as HTMLElement, m.caption);
  }

  function drawComms(
    comms: readonly CommWindow[],
    life: number,
    on: boolean,
    portraits: boolean,
  ): void {
    const seen = new Set<string>();
    if (on) {
      for (const c of comms) {
        const key = `${c.name}|${c.message}`;
        seen.add(key);
        let e = commEls.get(key);
        if (!e) {
          e = el('div', `sx-comm sx-glow${portraits ? '' : ' nop'}`);
          if (portraits) e.append(portrait(c.name));
          const body = el('div');
          const plate = el('div', 'nameplate');
          plate.append(
            el('span', 'nm', c.first),
            el('span', 'cs', (c.callsign || '').toUpperCase()),
          );
          plate.append(el('span', 'tr', c.trait.toUpperCase()));
          body.append(plate, el('div', 'msg', c.message));
          e.append(body);
          commEls.set(key, e);
          commsBox.append(e);
        }
        const s = commSlide(c.age, life, slideTime);
        e.style.transform = `translateX(${(s.off * 110).toFixed(1)}%)`;
        e.style.opacity = s.alpha.toFixed(2);
      }
    }
    for (const [key, e] of commEls) {
      if (!seen.has(key)) {
        e.remove();
        commEls.delete(key);
      }
    }
  }

  return {
    root,
    draw(input) {
      const { model: m, flags } = input;
      setHidden(tl, !flags.hud);
      setHidden(top, !flags.hud);
      setHidden(bl, !flags.hud);
      setHidden(tr, !(flags.hud || flags.feed || flags.combo));
      setHidden(scoreWrap, !flags.hud);

      if (flags.hud) {
        // Hull.
        const hullKey = `${m.hull.pips.join('')}|${m.hull.low}|${m.hull.critical}`;
        if (hullKey !== lastHullKey) {
          lastHullKey = hullKey;
          segs.replaceChildren(...m.hull.pips.map((p) => el('i', `sx-seg ${p}`)));
          setClass(hull, 'low', m.hull.low);
          setClass(hull, 'crit', m.hull.critical);
        }
        setText(hullText, m.hull.text);
        setText(killsText, `KILLS ${m.kills}`);
        setText(hitsText, m.inRun ? '' : 'PRACTICE');
        setHidden(squadLine, m.squad === null);
        if (m.squad) {
          const parts = [m.squad.wingmen && `WINGMEN ${m.squad.wingmen}`, m.squad.formation];
          const line = parts.filter(Boolean).join(' · ');
          const tail = m.squad.order ?? m.squad.cue ?? '';
          const text = tail ? `${line}${line ? ' · ' : ''}${tail}` : line;
          setText(squadLine, text);
        }
        drawRoster(m.roster, flags.portraits);

        // Objective, trial, warning.
        setHidden(objectiveWrap, m.objective === null);
        if (m.objective) {
          setText(objTitle, m.objective.battle);
          setText(objSub, `${m.objective.wave} · HOSTILES ${m.objective.hostiles}`);
        }
        setHidden(trial, m.trial === null);
        if (m.trial) setText(trial, m.trial);
        setHidden(warning, m.warning === null);

        // Enemy cues: the capital ship's bar, the MISSILE warning and the wing banner.
        drawCapital(m.capital);
        setHidden(alertWrap, m.missile === null);
        if (m.missile) {
          setText(alertText, m.missile.text);
          setClass(alert, 'urgent', m.missile.urgent);
        }
        setHidden(cueWrap, m.cue === null);
        if (m.cue) setText(cueEl, m.cue);

        // Score.
        setText(scoreValue, m.score);

        // Flight.
        setText(speedValue, String(m.speed.value));
        setText(speedState, m.speed.state);
        setStyle(meterFill, 'width', `${(m.speed.fill * 100).toFixed(1)}%`);
        setStyle(markCorner, 'left', `${(m.speed.corner * 100).toFixed(1)}%`);
        setStyle(markCruise, 'left', `${(m.speed.cruise * 100).toFixed(1)}%`);
        setClass(evade, 'ready', m.evade.ready);
        setStyle(evadeFill, 'width', `${(m.evade.fill * 100).toFixed(1)}%`);
        setText(evadeText, m.evade.ready ? 'READY' : '...');

        // Locks and salvo.
        const acq = m.locks.acquiring > 0 ? Math.min(m.locks.pips.length - 1, m.locks.count) : -1;
        const locksKey = `${m.locks.pips.join('')}|${acq}`;
        if (locksKey !== lastLocksKey) {
          lastLocksKey = locksKey;
          diamonds.replaceChildren(
            ...m.locks.pips.map((p, i) => el('i', `sx-diamond ${p}${i === acq ? ' acq' : ''}`)),
          );
        }
        setText(salvoText, m.locks.salvoText);
        setClass(salvo, 'ready', m.locks.salvoReady);
        setStyle(salvoFill, 'width', `${(m.locks.salvoFill * 100).toFixed(1)}%`);
      }

      // Streak and the tier call.
      const showCombo = flags.combo && m.combo.active;
      setClass(streak, 'on', showCombo && flags.hud);
      if (showCombo) {
        setText(streakCount, String(m.combo.count));
        setText(streakMult, m.combo.multiplier);
        setText(streakTier, m.combo.tier ?? 'STREAK');
        setStyle(streakFill, 'width', `${(m.combo.fill * 100).toFixed(1)}%`);
        streakCount.style.transform = `scale(${(1 + 0.45 * m.combo.pop).toFixed(3)})`;
      }
      const callText = flags.combo ? m.combo.call : '';
      if (callText !== lastCall) {
        lastCall = callText;
        call.textContent = callText;
        // Restart the pop animation for a new call.
        call.style.animation = 'none';
        void call.offsetWidth;
        call.style.animation = '';
      }
      setHidden(call, callText === '');

      // Kill feed.
      const live = new Set<FeedEntry>();
      if (flags.feed) {
        for (const f of input.combo.feed) {
          live.add(f);
          let e = feedEls.get(f);
          if (!e) {
            e = el('div', 'sx-feedline');
            e.append(
              el('span', 'by', f.by.toUpperCase()),
              el('span', 'what', f.text),
              el('span', 'pts', `+${f.points}`),
            );
            feedEls.set(f, e);
            feed.append(e);
          }
          e.style.opacity = feedAlpha(f, def).toFixed(2);
        }
      }
      for (const [f, e] of feedEls) {
        if (!live.has(f)) {
          e.remove();
          feedEls.delete(f);
        }
      }

      drawComms(input.comms, input.chatterLife, flags.comms, flags.portraits);
      drawBanner(input.banner, flags.banners, flags.portraits);
    },
    dispose() {
      root.remove();
    },
  };
}
