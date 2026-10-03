/** Anything bullets can hit. Issue #8 adds drones and turrets on top of this. */
export interface Target {
  x: number;
  y: number;
  radius: number;
  hp: number;
  alive: boolean;
}
