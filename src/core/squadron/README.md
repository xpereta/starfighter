# core/squadron

- **Purpose:** the wingmen, formations (tight / spread) and orders (attack my target) (spec sections 4 and 5).
- **Status:** contract skeleton. Issues B2 (wingmen) and B3 (orders) implement it; integration issue I1 makes wingmen launch the salvo.
- **Contract:** `world.squadron.wingmen` (each with a `ship`, `hp`, `alive`), `formation`, `order`, `orderTimer`. `livingWingmen(squadron)` is the number of extra pilots: lock-on uses it for the lock limit and missiles for the salvo size. Wingmen are friends and never lockable. `stepSquadron(world)` runs after the fighters and before lock-on. Orders are edge-triggered: read `actions.cycleFormation && !world.prev.cycleFormation` (prev is updated at the end of the step). Events: `OrderGiven`; `Killed{kind: 'wingman'}`. Anything you add must also go into `mixSquadron` (replay hash).
- **Parameters:** `data/tuning/squadron.ts`.
