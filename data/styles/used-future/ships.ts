import type { ShipShapes } from '../../../src/render/style';
import { enemyShips } from './ships-enemy';
import { friendlyShips } from './ships-friendly';

export const ships: ShipShapes = { ...friendlyShips, ...enemyShips };
