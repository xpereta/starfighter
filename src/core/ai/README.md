# core/ai

- **Purpose:** enemy fighters and their waves (spec section 3). Fighters use the same flight model as the player, driven by AI-produced actions.
- **Status:** contract skeleton. Issue B1 implements the AI, guns, break-away, waves and tests.
- **Contract:** a `Fighter` is a `Collider` with a velocity; `world.fighters[i]` has lockable id `FIGHTER_ID_BASE + i` (`core/world/lockable.ts`), so lock-on and missiles can target and damage it without knowing about fighters. Dead fighters stay in the array with `alive = false` (ids stay stable). `stepFighters(world)` runs after the player's flight; `stepWaves(world)` after enemy shots. Emit `Killed{kind: 'fighter'}`. Anything you add to `Fighter` must also go into `mixFighters` (replay hash).
- **Parameters:** `data/tuning/fighter.ts`.
