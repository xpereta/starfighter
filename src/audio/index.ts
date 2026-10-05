import { createMixConfig, type MixConfig } from '../../data/audio/mix';
import { activeStyle } from '../render/style-active';
import { createAudioEngine, type AudioEngine } from './engine';
import { sampleUrl } from './samples';
import { createWebAudioBackend } from './webaudio';

export const MUTE_STORAGE_KEY = 'starfighter.muted';
/** `KeyboardEvent.code` of the mute key. */
export const MUTE_KEY = 'KeyM';

export interface Audio {
  engine: AudioEngine;
  /** The live mix values (the panel edits these in place). */
  mix: MixConfig;
  /** Mutes or unmutes, remembers it in this browser and marks `<html data-audio-muted>`. */
  setMuted(muted: boolean): void;
  dispose(): void;
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false; // storage blocked
  }
}

function storeMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // Storage blocked: the mute just is not remembered.
  }
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Browser wiring: the Web Audio engine on the active style's sound table, started by the first
 * key press or click (browser rule), with M to mute. Reads events and state; never writes the world.
 */
export function startAudio(): Audio {
  const mix = createMixConfig();
  const engine = createAudioEngine({
    backend: createWebAudioBackend((file) => sampleUrl(activeStyle().manifest.id, file)),
    table: () => activeStyle().sounds,
    mix,
  });
  const setMuted = (muted: boolean): void => {
    engine.muted = muted;
    storeMuted(muted);
    document.documentElement.dataset.audioMuted = String(muted);
  };
  setMuted(readMuted());
  const unlock = (): void => engine.unlock();
  const onKey = (e: KeyboardEvent): void => {
    if (isTyping(e.target)) return;
    engine.unlock();
    if (e.code === MUTE_KEY && !e.repeat) {
      setMuted(!engine.muted);
    }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', unlock);
  return {
    engine,
    mix,
    setMuted,
    dispose() {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', unlock);
    },
  };
}
