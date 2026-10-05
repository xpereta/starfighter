import { styles as registry } from '../../data/styles';
import {
  checkStyle,
  PALETTE_KEYS,
  resolveStyle,
  SOUND_EVENT_KEYS,
  type ResolvedStyle,
  type StyleInput,
  type StylePack,
  type StyleRegistry,
  type Theme,
} from './style';

/** The fallback pack every other style builds on. */
export const FALLBACK_STYLE = 'plain';
export const STYLE_STORAGE_KEY = 'starfighter.style';

/** Turns `plain` into a complete pack. `plain` must give the whole theme and sound table. */
export function completeFallback(input: StyleInput): StylePack {
  const errors = checkStyle(input);
  const t = input.theme;
  if (!t?.palette || PALETTE_KEYS.some((k) => t.palette?.[k] === undefined))
    errors.push('the fallback style must define the whole palette');
  if (
    t?.outlineWidth === undefined ||
    t.outlineColor === undefined ||
    t.shadowShare === undefined ||
    t.glow === undefined
  )
    errors.push('the fallback style must define every theme field');
  if (SOUND_EVENT_KEYS.some((k) => input.sounds?.[k] === undefined))
    errors.push('the fallback style must have an entry or "silent" for every event');
  if (errors.length) throw new Error(`style "${input.manifest.id}": ${errors.join('; ')}`);
  return {
    manifest: input.manifest,
    theme: t as Theme,
    ships: input.ships ?? {},
    deaths: input.deaths ?? {},
    explosions: input.explosions ?? {},
    sounds: input.sounds as StylePack['sounds'],
  };
}

/**
 * Resolves every pack in a registry. A pack's missing parts come from its `parent` (resolved first),
 * else from `plain`. Unknown parents and cycles fall back to `plain` with a warning.
 */
export function buildStyles(reg: StyleRegistry): Record<string, ResolvedStyle> {
  const plainInput = reg[FALLBACK_STYLE];
  if (!plainInput) throw new Error(`the registry has no "${FALLBACK_STYLE}" style`);
  const fallback = completeFallback(plainInput);
  const out: Record<string, ResolvedStyle> = { [FALLBACK_STYLE]: { pack: fallback, warnings: [] } };
  const resolving = new Set<string>();

  const resolve = (id: string): ResolvedStyle => {
    const done = out[id];
    if (done) return done;
    const input = reg[id]!;
    resolving.add(id);
    const extra: string[] = [];
    let base = fallback;
    const parent = input.manifest.parent;
    if (parent && parent !== id) {
      if (!reg[parent]) extra.push(`style "${id}": parent "${parent}" is not registered`);
      else if (resolving.has(parent)) extra.push(`style "${id}": parent cycle through "${parent}"`);
      else base = resolve(parent).pack;
    }
    resolving.delete(id);
    const r = resolveStyle(input, base);
    return (out[id] = { pack: r.pack, warnings: [...extra, ...r.warnings] });
  };
  for (const id of Object.keys(reg)) resolve(id);
  return out;
}

/** Which style to use: `?style=` wins (when known), then the remembered choice, then `plain`. */
export function chooseStyleId(
  search: string,
  stored: string | null,
  known: (id: string) => boolean,
): { id: string; warning?: string } {
  const asked = new URLSearchParams(search).get('style');
  if (asked !== null) {
    if (known(asked)) return { id: asked };
    return {
      id: FALLBACK_STYLE,
      warning: `unknown style "${asked}", using ${FALLBACK_STYLE}`,
    };
  }
  if (stored !== null && known(stored)) return { id: stored };
  return { id: FALLBACK_STYLE };
}

// The active style ------------------------------------------------------------------------

let packs: Record<string, ResolvedStyle> | null = null;
let active = FALLBACK_STYLE;
let revision = 0;

/**
 * Bumped whenever the active pack is edited live (the panel's Look section), so render code that
 * caches meshes built from it knows to rebuild.
 */
export function styleRevision(): number {
  return revision;
}

/** Call after editing the active pack in place. */
export function touchStyle(): void {
  revision++;
}

const all = (): Record<string, ResolvedStyle> => (packs ??= buildStyles(registry));

function readStored(): string | null {
  try {
    return localStorage.getItem(STYLE_STORAGE_KEY);
  } catch {
    return null; // storage blocked
  }
}

/** Remembers the choice in this browser (ignored when storage is blocked). */
export function rememberStyle(id: string): void {
  try {
    localStorage.setItem(STYLE_STORAGE_KEY, id);
  } catch {
    // Storage blocked: `?style=` still works.
  }
}

/**
 * Picks the active style from the URL and the remembered choice, remembers an explicit `?style=`,
 * and logs a console warning for an unknown id or anything a pack leaves to its fallback.
 * Call once at startup, before anything reads `activeStyle()`.
 */
export function initStyle(search: string, stored: string | null = readStored()): StylePack {
  const chosen = chooseStyleId(search, stored, (id) => id in all());
  active = chosen.id;
  if (chosen.warning) console.warn(chosen.warning);
  for (const w of all()[active]!.warnings) console.warn(w);
  if (new URLSearchParams(search).has('style') && !chosen.warning) rememberStyle(active);
  return all()[active]!.pack;
}

/** The one accessor: the active style pack (complete). `plain` until `initStyle` runs. */
export function activeStyle(): StylePack {
  return all()[active]!.pack;
}

/** What the active style leaves to its fallback (shown in the panel). */
export function activeWarnings(): readonly string[] {
  return all()[active]!.warnings;
}

/** Ids of every registered style, `plain` first. */
export function styleIds(): string[] {
  return Object.keys(all()).sort((a, b) =>
    a === FALLBACK_STYLE ? -1 : b === FALLBACK_STYLE ? 1 : a.localeCompare(b),
  );
}
