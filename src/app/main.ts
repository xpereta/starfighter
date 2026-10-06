import { createTuning } from '../../data/tuning';
import { applyFinishedRun, veteranOffers } from '../core/meta/meta';
import { enterStartScreen, offerVeterans } from '../core/run/run';
import { createWorld, stepWorld, type World } from '../core/world/world';
import { createInput } from '../input/input';
import { startAudio } from '../audio';
import { loopStateOf, musicInputOf } from '../audio/state';
import { createHud } from '../render/hud/hud';
import { createRenderer } from '../render/renderer';
import { initFxLevel, spectacleSettings as visualSettings } from '../render/spectacle/settings';
import { initStyle } from '../render/style-active';
import { initSpectacle, spectacleOn } from '../ui/spectacle/active';
import { spectacle as spectacleSettings } from '../ui/spectacle/settings';
import { createSpectacle } from '../ui/spectacle/controller';
import { menuVisible } from '../ui/menu-model';
import { maskFlightActions } from '../ui/menu-nav';
import { createHudView } from '../ui/hud-view';
import { createMenuView } from '../ui/menu-view';
import { createPauseView } from '../ui/pause-view';
import { createFixedLoop } from './loop';
import { canPause, createPause } from './pause';
import { loadSave, saveIsFromNewerVersion, storeSave } from './save';

const save = loadSave();
// The look: `?style=<id>` or the remembered choice, `plain` otherwise. Render and audio read it; core never does.
initStyle(window.location.search);
// Eye-candy quality: `?fx=low|medium|high` (high by default); `low` is the fallback for weak devices.
const fxLevel = initFxLevel(window.location.search);
// The presentation of the style (HUD, menus, camera feel), when it has one: render and UI only, core never knows.
const presentation = initSpectacle(window.location.search);

/**
 * Dev tools (tuning panel, debug overlay) are a separate lazy chunk: on with `?dev` (always in
 * `npm run dev`), so preview URLs can tune. Build with VITE_DEV_TOOLS=false to strip them entirely.
 */
const devToolsEnabled =
  import.meta.env.VITE_DEV_TOOLS !== 'false' &&
  (import.meta.env.DEV || new URLSearchParams(window.location.search).has('dev'));

const world = createWorld(Date.now() >>> 0, createTuning(), save.bestTrialTime);
// Sound: starts on the first key press or click; reads the same events as the renderer.
const audio = startAudio();
const renderer = createRenderer(document.body, world, fxLevel);
const hud = createHud(document.body, {
  skipArrows: () => spectacleOn() && spectacleSettings.indicators,
  skipWorld: () => spectacleOn(),
  skipText: () => spectacleOn() && spectacleSettings.hud,
});
const fx = presentation
  ? createSpectacle(document.body, presentation, { getBestRun: () => save.meta.bestRun })
  : null;
// Dev builds only: the effects' event entry point, so tests and screenshots can stage a moment.
if (devToolsEnabled) {
  (window as unknown as { __sf: unknown }).__sf = { world };
  if (fx) (window as unknown as { __presentation: unknown }).__presentation = fx;
}

/**
 * One source of truth per effect when both Spectacle tracks are on (see docs/art-direction.md):
 * the presentation layer owns the title banners and the zoom punch, so the visuals' title cards and
 * shader zoom punch are switched off while those presentation parts are on, and back on when they
 * are turned off. Only changes are applied, so the visuals panel can still force both back on.
 * Everything else is complementary: bloom/fringe/grain/static vignette (visuals) and tension vignette,
 * roll, shake, hit-stop, kill-cam and flashes (presentation) do not overlap.
 */
let ownsBanners: boolean | null = null;
let ownsPunch: boolean | null = null;
function syncSpectacleTracks(): void {
  const banners = spectacleOn() && spectacleSettings.banners;
  if (banners !== ownsBanners) {
    ownsBanners = banners;
    visualSettings.cards = !banners;
  }
  const punch = spectacleOn() && spectacleSettings.zoomPunch > 0;
  if (punch !== ownsPunch) {
    ownsPunch = punch;
    visualSettings.zoomPunch = !punch;
  }
}
syncSpectacleTracks();
const input = createInput();
const menus = createMenuView(document.body, () => save.meta.bestRun);
const pauseView = createPauseView(document.body);
const pause = createPause();
const runHud = createHudView(document.body, world.seed);
// The game starts on the Start screen (a run); `?practice` opens the practice field instead.
const practice = new URLSearchParams(window.location.search).has('practice');
// A save written by a newer version of the game is read as empty and never overwritten.
const canStore = !saveIsFromNewerVersion();
let offered = false;
if (!practice) {
  enterStartScreen(world);
  offerVeterans(world, veteranOffers(save.meta));
  offered = true;
}
let devTools: {
  beforeStep(world: World): void;
  draw(world: World, frameSeconds: number): void;
} | null = null;
if (devToolsEnabled) {
  void import('../dev').then((m) => {
    devTools = m.createDevTools(world, document.body);
  });
}

const loop = createFixedLoop((dt) => {
  devTools?.beforeStep(world); // replay: record the inputs about to be used, or inject recorded ones
  stepWorld(world, dt);
  // Events live for one step; hand them to FX before the next step clears them.
  renderer.consumeEvents(world.events.events);
  audio.engine.consumeEvents(world.events.events, world.ship);
  runHud.step(world, dt);
  fx?.step(world, dt);
  if (world.run.mode === 'run') {
    // Offer the saved veterans once per Start screen (a restart gets the updated roster).
    if (world.run.phase === 'start' && !offered) {
      offerVeterans(world, veteranOffers(save.meta));
      offered = true;
    }
    for (const e of world.events.events) {
      if (e.type !== 'RunEnded') continue;
      save.meta = applyFinishedRun(
        loadSave().meta, // another tab may have saved since boot
        world.pilots.roster,
        world.run,
        world.tuning.pilots.veteranCap,
      );
      offered = false;
      if (canStore) storeSave(save);
    }
  }
  if (world.trial.best !== save.bestTrialTime) {
    save.bestTrialTime = world.trial.best;
    if (canStore) storeSave(save);
  }
});

let last = performance.now();
function frame(now: number): void {
  input.poll(world.actions);
  pause.update(input.pause, canPause(world));
  loop.setPaused(pause.paused);
  audio.engine.setPaused(pause.paused);
  audio.engine.update();
  const audioDt = Math.min(0.1, (now - last) / 1000);
  audio.engine.setLoopState(loopStateOf(world), audioDt);
  audio.engine.setMusicState(musicInputOf(world), audioDt); // the adaptive score (when the style has one)
  // The pause buttons (pad Start is also the time trial) never act as flight controls.
  if (input.pause) maskFlightActions(world.actions);
  if (menuVisible(world.run)) maskFlightActions(world.actions); // the keys that fly never act behind a menu
  world.camera.aspect = window.innerWidth / window.innerHeight || 1;
  const previous = last;
  loop.advance((now - last) / 1000);
  last = now;
  syncSpectacleTracks();
  const { frozen } = fx?.update(world, Math.min(0.1, (now - previous) / 1000), now / 1000) ?? {
    frozen: false,
  };
  // Hit-stop and the kill-cam are drawing only: the simulation above keeps running, the picture holds.
  if (!frozen) renderer.render(world);
  if (!frozen) hud.draw(world);
  fx?.draw(world, now / 1000);
  menus.draw(world);
  pauseView.draw(world, pause.paused);
  runHud.draw(world);
  fx?.drawUi(world, runHud.chatterLines());
  devTools?.draw(world, (now - previous) / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
