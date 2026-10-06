import type { ShipShapes } from '../../../src/render/style';
import { bigShips } from './ships-big';
import { enemyShips } from './ships-enemy';
import { friendlyShips } from './ships-friendly';
import { miscShips } from './ships-misc';

export const ships: ShipShapes = { ...friendlyShips, ...enemyShips, ...miscShips, ...bigShips };
