/**
 * The stylesheet of the spectacle HUD and menus: angled panels, bold italic type, glowing readouts.
 * Colours come from CSS variables set on the roots from the style's presentation (`colors`), sizes are
 * CSS pixels / viewport units so everything wraps instead of clipping at any window size.
 * `body.sxb-calm` (the calm preset) and `prefers-reduced-motion` turn the decorative animation off.
 */

export const SX_CSS = `
.sx-root {
  --accent: #4ee1ff; --hot: #ff3d6e; --gold: #ffd23f; --mint: #7cf0c8;
  --ink: #070a1c; --panel: rgba(8, 12, 38, 0.78); --text: #f2f6ff; --dim: #8fa3d6;
  --display: "Arial Black", "Helvetica Neue", Impact, system-ui, sans-serif;
  --mono: ui-monospace, Menlo, Consolas, monospace;
  position: fixed; inset: 0; pointer-events: none; color: var(--text);
  font: 700 13px/1.25 var(--mono); box-sizing: border-box; overflow: hidden;
}
.sx-root *, .sx-root *::before, .sx-root *::after { box-sizing: border-box; }
.sx-root[hidden], .sx-root [hidden] { display: none !important; }
#sx-hud { z-index: 5; }
#sx-menu { z-index: 10; }

/* ---- angled panels ---- */
.sx-glow { filter: drop-shadow(0 0 7px color-mix(in srgb, var(--accent) 55%, transparent)); }
.sx-glow.hot { filter: drop-shadow(0 0 8px color-mix(in srgb, var(--hot) 70%, transparent)); }
.sx-glow.gold { filter: drop-shadow(0 0 8px color-mix(in srgb, var(--gold) 65%, transparent)); }
.sx-glow.mint { filter: drop-shadow(0 0 8px color-mix(in srgb, var(--mint) 60%, transparent)); }
.sx-panel {
  background: var(--panel); border-left: 4px solid var(--accent);
  clip-path: polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%);
  padding: 7px 30px 7px 12px;
}
.sx-panel.mirror {
  border-left: 0; border-right: 4px solid var(--accent); text-align: right;
  clip-path: polygon(16px 0, 100% 0, 100% 100%, 0 100%); padding: 7px 12px 7px 30px;
}
.sx-label { font: 800 10px/1 var(--display); letter-spacing: 0.22em; color: var(--dim); font-style: italic; }
.sx-big { font: 900 italic 26px/1 var(--display); letter-spacing: 0.02em; text-transform: uppercase; }
.sx-num { font-family: var(--mono); font-weight: 800; font-variant-numeric: tabular-nums; }

/* ---- top left: hull, status, roster ---- */
.sx-tl, .sx-tr, .sx-bl, .sx-comms { zoom: var(--sx-ui-scale, 1); }
.sx-tl { position: absolute; left: 22px; top: 16px; display: grid; gap: 8px; width: min(300px, 44vw); }
.sx-hull-row { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 5px; }
.sx-segs { display: flex; gap: 3px; }
.sx-seg {
  flex: 1; height: 11px; max-width: 34px; transform: skewX(-22deg);
  background: rgba(143, 163, 214, 0.22); transition: background 0.2s, box-shadow 0.2s;
}
.sx-seg.on { background: var(--accent); box-shadow: 0 0 8px var(--accent); }
.sx-hull.low .sx-seg.on { background: var(--gold); box-shadow: 0 0 8px var(--gold); }
.sx-hull.crit .sx-seg.on { background: var(--hot); box-shadow: 0 0 10px var(--hot); animation: sx-blink 0.5s steps(2) infinite; }
.sx-status { display: flex; justify-content: space-between; gap: 10px; margin-top: 7px; color: var(--dim); font-size: 11px; }
.sx-status b { color: var(--text); }
.sx-squadline { margin-top: 5px; font-size: 11px; color: var(--mint); letter-spacing: 0.06em; }
.sx-squadline .order { color: var(--gold); }
.sx-roster { display: grid; gap: 6px; }
.sx-card {
  display: grid; grid-template-columns: 42px 1fr; gap: 9px; align-items: center;
  background: var(--panel); padding: 4px 24px 4px 4px; border-left: 3px solid var(--accent);
  clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
  animation: sx-slide-left 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}
.sx-card.fallen { border-left-color: var(--hot); filter: grayscale(1); opacity: 0.55; }
.sx-card .who { font: 800 13px/1.1 var(--display); font-style: italic; text-transform: uppercase; }
.sx-card .cs { color: var(--accent); font: 700 10px/1.2 var(--mono); letter-spacing: 0.14em; }
.sx-card .pips { display: flex; gap: 2px; margin-top: 4px; }
.sx-card .pip { width: 14px; height: 5px; transform: skewX(-22deg); background: rgba(143, 163, 214, 0.25); }
.sx-card .pip.on { background: var(--mint); box-shadow: 0 0 5px var(--mint); }
.sx-card .lost { color: var(--hot); font: 900 italic 11px var(--display); letter-spacing: 0.2em; }
.sx-portrait { display: block; width: 100%; aspect-ratio: 1; overflow: hidden; clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%); background: #11162e; }
.sx-portrait svg { display: block; width: 100%; height: 100%; }

.sx-card.nop { grid-template-columns: 1fr; padding-left: 12px; }
.sx-comm.nop { grid-template-columns: 1fr; padding-left: 14px; }

/* ---- top centre: objective ---- */
.sx-top { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); text-align: center; }
.sx-objective { padding: 6px 38px; clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 100%, 0 100%); border: 0; background: var(--panel); border-top: 3px solid var(--gold); }
.sx-objective .t { font: 900 italic 20px/1 var(--display); letter-spacing: 0.04em; }
.sx-objective .s { margin-top: 4px; color: var(--dim); font-size: 11px; letter-spacing: 0.14em; }
.sx-objective .s b { color: var(--hot); font-size: 13px; }
.sx-trial { margin-top: 6px; color: var(--dim); font-size: 11px; letter-spacing: 0.12em; }
.sx-warning {
  margin-top: 8px; display: inline-block; padding: 5px 20px; background: var(--hot); color: #fff;
  font: 900 italic 16px/1 var(--display); letter-spacing: 0.12em; animation: sx-blink 0.6s steps(2) infinite;
  clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
}
.sx-warning[hidden] { display: none; }

/* ---- enemy cues: capital ship bar, MISSILE warning, wing banner (prototype 5) ---- */
.sx-capital, .sx-alertwrap, .sx-cuewrap { zoom: var(--sx-ui-scale, 1); }
.sx-capital { margin-top: 10px; width: min(560px, 62vw); }
.sx-capbox {
  background: var(--panel); border-top: 3px solid var(--hot); padding: 6px 22px 9px;
  clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 100%, 0 100%);
}
.sx-capbox.exposed { border-top-color: var(--gold); }
.sx-capbox .head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 6px; }
.sx-capbox .name { font: 900 italic 13px/1 var(--display); letter-spacing: 0.14em; color: var(--hot); }
.sx-capbox .caption { font: 800 10px/1 var(--display); letter-spacing: 0.2em; font-style: italic; color: var(--gold); }
.sx-capbox.dying .caption { color: var(--hot); animation: sx-blink 0.5s steps(2) infinite; }
.sx-capbox .segs { display: flex; align-items: stretch; height: 13px; transform: skewX(-22deg); }
.sx-capbox .cell { position: relative; flex-basis: 0; margin-left: 3px; background: rgba(143, 163, 214, 0.2); }
.sx-capbox .cell:first-child { margin-left: 0; }
.sx-capbox .cell b { position: absolute; inset: 0 auto 0 0; background: var(--hot); box-shadow: 0 0 7px var(--hot); }
.sx-capbox .cell.turret b { background: #b06cff; box-shadow: 0 0 7px #b06cff; }
.sx-capbox .cell.armour b { background: #9aa4b8; box-shadow: 0 0 6px #9aa4b8; }
.sx-capbox .cell.engine b, .sx-capbox .cell.bridge b { background: #ff7a5a; box-shadow: 0 0 7px #ff7a5a; }
.sx-capbox .cell.core b { background: var(--gold); box-shadow: 0 0 10px var(--gold); }
.sx-capbox .cell.covered b { opacity: 0.5; }
.sx-capbox .cell.dead { background: repeating-linear-gradient(45deg, rgba(143, 163, 214, 0.25) 0 3px, transparent 3px 6px); }
.sx-capbox .cell.dead b { display: none; }
.sx-capbox .cell.core { outline: 2px solid var(--gold); outline-offset: 1px; }
.sx-capbox .cell.shield::after { content: ''; position: absolute; left: 0; right: 0; bottom: -6px; height: 3px; background: var(--gold); }
.sx-corecall {
  margin-top: 8px; display: inline-flex; gap: 12px; align-items: center; padding: 5px 22px; background: var(--gold); color: #1a1200;
  font: 900 italic 17px/1 var(--display); letter-spacing: 0.16em; animation: sx-blink 0.45s steps(2) infinite;
  clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
}
.sx-corecall .tri { font-size: 11px; }
.sx-alertwrap { margin-top: 10px; display: block; }
.sx-alert {
  display: inline-flex; gap: 12px; align-items: center; padding: 6px 24px; background: var(--panel); border-top: 3px solid var(--hot); color: var(--hot);
  font: 900 italic 18px/1 var(--display); letter-spacing: 0.16em; animation: sx-blink 0.7s steps(2) infinite;
  clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 100%, 0 100%);
}
.sx-alert .arrow { font-size: 12px; letter-spacing: -0.2em; }
.sx-alert.urgent { background: var(--hot); color: #fff; animation-duration: 0.28s; }
.sx-cuewrap { margin-top: 10px; display: block; }
.sx-cue {
  display: inline-block; padding: 5px 30px; background: var(--panel); border-top: 3px solid var(--gold); color: var(--gold);
  font: 900 italic 16px/1 var(--display); letter-spacing: 0.22em; animation: sx-slide-right 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
  clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 100%, 0 100%);
}

/* ---- top right: score, streak, kill feed ---- */
.sx-tr { position: absolute; right: 22px; top: 16px; display: grid; gap: 8px; justify-items: end; width: min(280px, 42vw); }
.sx-tr .sx-panel { width: 100%; }
.sx-scorevalue { font: 900 italic 28px/1 var(--display); letter-spacing: 0.04em; }
.sx-streak { display: none; margin-top: 6px; }
.sx-streak.on { display: block; }
.sx-streak .row { display: flex; align-items: baseline; justify-content: flex-end; gap: 8px; }
.sx-streak .n { font: 900 italic 30px/1 var(--display); color: var(--gold); transform-origin: right center; text-shadow: 0 0 10px rgba(255, 210, 63, 0.6); }
.sx-streak .m { font: 800 15px var(--mono); color: var(--accent); }
.sx-streak .bar { height: 4px; margin-top: 5px; background: rgba(143, 163, 214, 0.25); transform: skewX(-22deg); }
.sx-streak .bar i { display: block; height: 100%; background: var(--gold); }
.sx-streak .tier { color: var(--text); font: 800 10px var(--display); letter-spacing: 0.22em; font-style: italic; }
.sx-feed { display: grid; gap: 4px; justify-items: end; width: 100%; }
.sx-feedline {
  display: flex; gap: 10px; align-items: baseline; padding: 4px 12px 4px 20px; background: var(--panel);
  border-right: 3px solid var(--hot); clip-path: polygon(10px 0, 100% 0, 100% 100%, 0 100%);
  animation: sx-slide-right 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.1) both; font-size: 11px;
}
.sx-feedline .by { color: var(--accent); letter-spacing: 0.08em; }
.sx-feedline .pts { color: var(--gold); }
.sx-call {
  position: absolute; right: 8vw; top: 34vh; font: 900 italic clamp(34px, 6vw, 72px)/1 var(--display); color: #fff;
  -webkit-text-stroke: 2px var(--gold); text-shadow: 0 0 22px var(--gold); transform: skewX(-12deg);
  animation: sx-call 1.6s ease-out both;
}
.sx-call[hidden] { display: none; }

/* ---- bottom left: flight, locks ---- */
.sx-bl { position: absolute; left: 22px; bottom: 20px; width: min(310px, 46vw); display: grid; gap: 8px; }
.sx-speed { display: flex; align-items: baseline; justify-content: space-between; }
.sx-speed .v { font: 900 italic 34px/1 var(--display); }
.sx-speed .u { color: var(--dim); font-size: 11px; margin-left: 4px; }
.sx-speed .st { color: var(--accent); letter-spacing: 0.2em; font: 800 11px var(--display); font-style: italic; }
.sx-meter { position: relative; height: 9px; margin-top: 6px; background: rgba(143, 163, 214, 0.2); transform: skewX(-22deg); }
.sx-meter i { position: absolute; inset: 0 auto 0 0; background: var(--accent); box-shadow: 0 0 9px var(--accent); }
.sx-meter b { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--text); opacity: 0.7; }
.sx-evade { display: flex; align-items: center; gap: 10px; margin-top: 7px; font-size: 11px; }
.sx-evade .meter { flex: 1; height: 6px; margin: 0; }
.sx-evade .meter i { background: var(--gold); box-shadow: 0 0 7px var(--gold); }
.sx-evade.ready .meter i { background: var(--mint); box-shadow: 0 0 9px var(--mint); }
.sx-evade.ready .t { color: var(--mint); }
.sx-locks { display: flex; align-items: center; gap: 10px; }
.sx-diamonds { display: flex; gap: 6px; }
.sx-diamond { width: 16px; height: 16px; transform: rotate(45deg) scale(0.8); border: 2px solid var(--dim); transition: all 0.15s; }
.sx-diamond.on { background: var(--gold); border-color: var(--gold); box-shadow: 0 0 11px var(--gold); transform: rotate(45deg) scale(1); }
.sx-diamond.acq { border-color: var(--gold); animation: sx-blink 0.25s steps(2) infinite; }
.sx-salvo { flex: 1; }
.sx-salvo .t { font: 900 italic 14px/1 var(--display); letter-spacing: 0.1em; color: var(--dim); }
.sx-salvo.ready .t { color: var(--gold); text-shadow: 0 0 10px var(--gold); animation: sx-pulse 0.9s ease-in-out infinite; }
.sx-salvo .meter i { background: var(--gold); box-shadow: 0 0 8px var(--gold); }

/* ---- bottom right: comm windows ---- */
.sx-comms { position: absolute; right: 22px; bottom: 20px; width: min(380px, 62vw); display: grid; gap: 8px; justify-items: end; }
.sx-comm {
  display: grid; grid-template-columns: 56px 1fr; gap: 10px; align-items: center; width: 100%;
  background: var(--panel); border-right: 4px solid var(--accent); padding: 5px 16px 5px 5px;
  clip-path: polygon(14px 0, 100% 0, 100% 100%, 0 100%); will-change: transform;
}
.sx-comm .nameplate { display: flex; align-items: baseline; gap: 8px; }
.sx-comm .nm { font: 900 italic 14px/1 var(--display); text-transform: uppercase; }
.sx-comm .cs { color: var(--accent); font: 700 10px var(--mono); letter-spacing: 0.16em; }
.sx-comm .tr { color: var(--dim); font: 700 9px var(--mono); letter-spacing: 0.14em; margin-left: auto; }
.sx-comm .msg { margin-top: 4px; font: 600 12px/1.35 var(--mono); overflow-wrap: anywhere; }
.sx-comm .sx-portrait { position: relative; }
.sx-comm .sx-portrait::after {
  content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(78, 225, 255, 0.0) 0 2px, rgba(78, 225, 255, 0.16) 2px 3px);
  animation: sx-scan 0.5s linear infinite;
}

/* ---- banners and title cards ---- */
.sx-banner-slot { position: absolute; left: 0; right: 0; top: 30vh; height: 0; }
.sx-banner { position: absolute; left: 0; right: 0; top: 0; display: grid; justify-items: center; will-change: transform, opacity; }
.sx-banner .band {
  width: 100%; padding: 14px 8vw; text-align: center; background: linear-gradient(90deg, transparent, rgba(5, 8, 28, 0.88) 12%, rgba(5, 8, 28, 0.88) 88%, transparent);
  border-top: 3px solid var(--bannercolor, var(--accent)); border-bottom: 3px solid var(--bannercolor, var(--accent));
  transform: skewX(-12deg);
}
.sx-banner .band > * { transform: skewX(12deg); }
.sx-banner .kicker { font: 800 11px var(--display); letter-spacing: 0.5em; color: var(--bannercolor, var(--accent)); font-style: italic; }
.sx-banner .title {
  font: 900 italic clamp(38px, 8vw, 104px)/1 var(--display); text-transform: uppercase; letter-spacing: 0.02em;
  -webkit-text-stroke: 2px var(--bannercolor, var(--accent)); color: #fff; text-shadow: 0 0 28px var(--bannercolor, var(--accent));
}
.sx-banner .sub { margin-top: 6px; font: 800 clamp(13px, 1.8vw, 20px) var(--display); letter-spacing: 0.4em; font-style: italic; color: var(--text); }
.sx-banner.small { top: -12vh; }
.sx-banner.small .band { width: auto; padding: 8px 56px; background: var(--panel); border-bottom-width: 0; }
.sx-banner.small .title { font-size: clamp(22px, 3.4vw, 40px); -webkit-text-stroke-width: 1px; }
.sx-banner.small .sub { font-size: 13px; letter-spacing: 0.3em; }
.sx-banner.who .band { display: grid; grid-template-columns: 84px auto; gap: 18px; align-items: center; justify-content: center; text-align: left; }
.sx-banner.who .sx-portrait { width: 84px; }
.sx-banner.lost { --bannercolor: var(--hot); }
.sx-banner.lost .sx-portrait { filter: grayscale(1) contrast(1.3); animation: sx-glitch 0.5s steps(6) 3; }
.sx-banner.lost .title { animation: sx-glitch 0.6s steps(5) 2; }
.sx-banner.cleared, .sx-banner.victory { --bannercolor: var(--gold); }
.sx-banner.defeat { --bannercolor: var(--hot); }
.sx-banner.rescued { --bannercolor: var(--mint); }
.sx-banner.wave { --bannercolor: var(--accent); }

/* ---- menus ---- */
#sx-menu { overflow: hidden; background: #04061a; pointer-events: none; }
#sx-menu .bg { position: absolute; inset: 0; background: radial-gradient(120% 90% at 78% 8%, #3a1d78 0%, #141847 38%, #070a1c 78%); }
#sx-menu .stars { position: absolute; inset: -50% 0 -50% 0; background-repeat: repeat; opacity: 0.9; animation: sx-drift 28s linear infinite; }
#sx-menu .stars.a { background-image: radial-gradient(1.5px 1.5px at 20px 30px, #fff 50%, transparent 52%), radial-gradient(1px 1px at 90px 140px, #cfe3ff 50%, transparent 52%), radial-gradient(1.5px 1.5px at 160px 70px, #fff 50%, transparent 52%); background-size: 200px 200px; }
#sx-menu .stars.b { background-image: radial-gradient(2px 2px at 60px 60px, #8fdcff 50%, transparent 52%), radial-gradient(1px 1px at 130px 20px, #fff 50%, transparent 52%); background-size: 320px 320px; animation-duration: 16s; opacity: 0.75; }
#sx-menu .beam { position: absolute; top: -20%; bottom: -20%; width: 18vw; background: linear-gradient(90deg, transparent, rgba(78, 225, 255, 0.18), transparent); transform: skewX(-24deg); animation: sx-beam 7s ease-in-out infinite; }
#sx-menu .beam.two { background: linear-gradient(90deg, transparent, rgba(255, 61, 110, 0.14), transparent); animation-delay: -3.5s; animation-duration: 9s; width: 10vw; }
#sx-menu .halo { position: absolute; right: -12vw; top: -18vw; width: 52vw; aspect-ratio: 1; border-radius: 50%; border: 3px solid rgba(255, 210, 63, 0.35); box-shadow: 0 0 80px rgba(255, 210, 63, 0.25), inset 0 0 90px rgba(255, 61, 110, 0.22); animation: sx-spin 60s linear infinite; }
#sx-menu .halo::after { content: ""; position: absolute; inset: 9%; border-radius: 50%; border: 2px dashed rgba(78, 225, 255, 0.4); }
#sx-menu .vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 55%, rgba(2, 3, 12, 0.7)); }
#sx-menu.tone-victory .bg { background: radial-gradient(110% 90% at 50% 20%, #7a5a10 0%, #2c2250 40%, #070a1c 80%); }
#sx-menu.tone-victory .halo { border-color: rgba(255, 230, 120, 0.7); animation-duration: 20s; }
#sx-menu.tone-defeat .bg { background: radial-gradient(110% 90% at 50% 20%, #5a0f26 0%, #1b0b24 45%, #05030c 80%); }
#sx-menu.tone-defeat .stars { filter: hue-rotate(300deg) saturate(1.4); }
#sx-menu.tone-defeat .halo { border-color: rgba(255, 61, 110, 0.45); }
#sx-menu.tone-cleared .bg { background: radial-gradient(120% 90% at 20% 10%, #123a6a 0%, #121a4a 40%, #070a1c 80%); }

#sx-menu .stage { position: absolute; inset: 0; display: grid; grid-template-rows: auto 1fr auto; padding: clamp(18px, 4vh, 44px) clamp(18px, 5vw, 72px); gap: 14px; }
#sx-menu .head { animation: sx-head 0.7s cubic-bezier(0.2, 0.9, 0.3, 1) both; }
#sx-menu .kicker { font: 800 clamp(11px, 1.4vw, 15px) var(--display); font-style: italic; letter-spacing: 0.6em; color: var(--accent); }
#sx-menu .title {
  margin: 6px 0 0; font: 900 italic clamp(44px, 11vw, 150px)/0.95 var(--display); text-transform: uppercase; letter-spacing: -0.01em;
  color: #fff; -webkit-text-stroke: 3px var(--accent); text-shadow: 6px 6px 0 rgba(255, 61, 110, 0.85), 0 0 40px rgba(78, 225, 255, 0.6);
  transform: skewX(-10deg); transform-origin: left bottom; overflow-wrap: anywhere;
}
#sx-menu.tone-victory .title { -webkit-text-stroke-color: var(--gold); text-shadow: 6px 6px 0 rgba(255, 150, 40, 0.85), 0 0 50px rgba(255, 210, 63, 0.8); }
#sx-menu.tone-defeat .title { -webkit-text-stroke-color: var(--hot); text-shadow: 6px 6px 0 rgba(30, 0, 20, 0.9), 0 0 40px rgba(255, 61, 110, 0.7); animation: sx-glitch 1.2s steps(8) 2; }
#sx-menu.tone-cleared .title { -webkit-text-stroke-color: var(--gold); text-shadow: 6px 6px 0 rgba(30, 90, 200, 0.85), 0 0 40px rgba(255, 210, 63, 0.6); font-size: clamp(36px, 8.5vw, 112px); }
#sx-menu .slash { height: 6px; width: min(46vw, 560px); margin-top: 12px; background: linear-gradient(90deg, var(--accent), var(--hot) 60%, transparent); transform: skewX(-30deg); transform-origin: left; animation: sx-grow 0.8s 0.1s cubic-bezier(0.2, 0.9, 0.3, 1) both; }
#sx-menu .notes { margin-top: 12px; max-width: min(62ch, 90vw); color: var(--text); opacity: 0.88; font: 600 14px/1.5 var(--mono); }
#sx-menu .notes p { margin: 0 0 3px; overflow-wrap: anywhere; }

#sx-menu .mid { display: flex; flex-wrap: wrap; gap: 24px; align-content: start; align-items: start; min-height: 0; overflow: hidden; }
#sx-menu .stats { display: flex; gap: 12px; flex-wrap: wrap; }
#sx-menu .stat { background: var(--panel); border-left: 4px solid var(--gold); padding: 8px 26px 8px 14px; clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%); animation: sx-slide-left 0.5s 0.15s both; }
#sx-menu .stat .v { font: 900 italic 30px/1 var(--display); }
#sx-menu .squad { display: flex; gap: 10px; flex-wrap: wrap; }
#sx-menu .squad .sx-card { grid-template-columns: 46px 1fr; width: 190px; }

#sx-menu .bottom { display: grid; gap: 12px; align-content: end; min-height: 0; }
#sx-menu .items { display: grid; gap: 8px; width: min(560px, 100%); align-content: end; justify-self: start; }
.sx-item {
  position: relative; display: grid; grid-template-columns: 22px auto 1fr; align-items: center; gap: 10px;
  padding: 9px 26px 9px 12px; background: rgba(8, 12, 38, 0.82); border-left: 5px solid var(--dim);
  clip-path: polygon(0 0, 100% 0, calc(100% - 18px) 100%, 0 100%); transform: translateX(0);
  transition: transform 0.15s, background 0.15s, border-color 0.15s;
  animation: sx-slide-left 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.15) both; animation-delay: calc(var(--i, 0) * 70ms + 0.25s);
}
.sx-item.has-portrait { grid-template-columns: 22px 54px 1fr; padding-top: 5px; padding-bottom: 5px; }
.sx-item .mark { font: 900 14px var(--mono); color: var(--accent); white-space: pre; }
.sx-item .lbl { font: 900 italic 18px/1.1 var(--display); text-transform: uppercase; letter-spacing: 0.03em; overflow-wrap: anywhere; }
.sx-item .det { display: block; margin-top: 3px; font: 600 12px/1.3 var(--mono); text-transform: none; font-style: normal; letter-spacing: 0; color: var(--dim); }
.sx-item .ticked { color: var(--mint); font-size: 12px; letter-spacing: 0.1em; }
.sx-item.current { background: var(--accent); color: #05081c; border-left-color: #fff; transform: translateX(16px); box-shadow: 0 0 22px rgba(78, 225, 255, 0.6); }
.sx-item.current .mark, .sx-item.current .det, .sx-item.current .ticked { color: #05081c; }
.sx-item.current .lbl { animation: sx-nudge 0.8s ease-in-out infinite alternate; }
#sx-menu .foot { color: var(--dim); font: 700 11px var(--mono); letter-spacing: 0.14em; animation: sx-head 0.9s 0.3s both; }
#sx-menu .wipe { position: absolute; inset: 0; background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.85) 48%, var(--accent) 52%, transparent 70%); transform: translateX(-120%); animation: sx-wipe 0.6s ease-out both; pointer-events: none; }

/* ---- keyframes ---- */
@keyframes sx-blink { 50% { opacity: 0.25; } }
@keyframes sx-pulse { 50% { transform: scale(1.06); } }
@keyframes sx-slide-left { from { transform: translateX(-60px); opacity: 0; } }
@keyframes sx-slide-right { from { transform: translateX(60px); opacity: 0; } }
@keyframes sx-head { from { transform: translateX(-80px) skewX(-14deg); opacity: 0; } }
@keyframes sx-grow { from { transform: skewX(-30deg) scaleX(0); } }
@keyframes sx-wipe { from { transform: translateX(-120%); } to { transform: translateX(120%); } }
@keyframes sx-drift { to { transform: translateY(200px); } }
@keyframes sx-beam { 0%, 100% { left: -25vw; } 50% { left: 105vw; } }
@keyframes sx-spin { to { transform: rotate(360deg); } }
@keyframes sx-scan { to { transform: translateY(3px); } }
@keyframes sx-nudge { to { transform: translateX(6px); } }
@keyframes sx-call { 0% { transform: skewX(-12deg) scale(0.4); opacity: 0; } 12% { transform: skewX(-12deg) scale(1.15); opacity: 1; } 22% { transform: skewX(-12deg) scale(1); } 80% { opacity: 1; } 100% { transform: skewX(-12deg) translateX(40px); opacity: 0; } }
@keyframes sx-glitch { 0% { transform: translate(0); } 20% { transform: translate(-6px, 2px); filter: hue-rotate(90deg); } 40% { transform: translate(5px, -2px); } 60% { transform: translate(-3px, 1px); filter: hue-rotate(-60deg); } 100% { transform: translate(0); } }

body.sxb-calm .sx-root *, body.sxb-calm .sx-root *::before, body.sxb-calm .sx-root *::after { animation: none !important; transition: none !important; }
@media (prefers-reduced-motion: reduce) {
  .sx-root *, .sx-root *::before, .sx-root *::after { animation: none !important; transition: none !important; }
}
/* the classic parts the spectacle layer takes over */
body.sxb-hud #run-hud .roster, body.sxb-hud #run-hud .objective, body.sxb-hud #run-hud .cue { display: none; }
body.sxb-comms #run-hud .chatter { display: none; }
body.sxb-menus #run-menu { display: none !important; }
`;
