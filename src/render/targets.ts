import * as THREE from 'three';
import type { Target, TargetKind } from '../core/world/target';
import { palette } from './palette';

const COLORS: Record<TargetKind, number> = {
  static: palette.enemyStatic,
  drone: palette.enemy,
  turret: palette.turret,
};

/** Unit-radius flat silhouette per kind, scaled by the target's radius. */
function silhouette(kind: TargetKind): THREE.Shape {
  const s = new THREE.Shape();
  if (kind === 'drone') {
    // Diamond: reads as "fast".
    s.moveTo(0, 1.15);
    s.lineTo(0.8, 0);
    s.lineTo(0, -1.15);
    s.lineTo(-0.8, 0);
  } else if (kind === 'turret') {
    // Square with notched corners: reads as "fixed gun".
    s.moveTo(-0.6, 1);
    s.lineTo(0.6, 1);
    s.lineTo(1, 0.6);
    s.lineTo(1, -0.6);
    s.lineTo(0.6, -1);
    s.lineTo(-0.6, -1);
    s.lineTo(-1, -0.6);
    s.lineTo(-1, 0.6);
  } else {
    // Hexagon.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      if (i === 0) s.moveTo(Math.cos(a), Math.sin(a));
      else s.lineTo(Math.cos(a), Math.sin(a));
    }
  }
  s.closePath();
  return s;
}

export interface TargetRenderer {
  readonly object: THREE.Group;
  update(targets: readonly Target[]): void;
  dispose(): void;
}

/** One mesh per arena target (about 30), shared geometry per kind; hidden while destroyed. */
export function createTargetRenderer(targets: readonly Target[]): TargetRenderer {
  const group = new THREE.Group();
  const geometries = new Map<TargetKind, THREE.ShapeGeometry>();
  const materials = new Map<TargetKind, THREE.MeshBasicMaterial>();
  const meshes: THREE.Mesh[] = [];
  for (const kind of ['static', 'drone', 'turret'] as const) {
    geometries.set(kind, new THREE.ShapeGeometry(silhouette(kind)));
    materials.set(kind, new THREE.MeshBasicMaterial({ color: COLORS[kind] }));
  }
  for (const t of targets) {
    const mesh = new THREE.Mesh(geometries.get(t.kind)!, materials.get(t.kind)!);
    mesh.scale.setScalar(t.radius);
    group.add(mesh);
    meshes.push(mesh);
  }
  return {
    object: group,
    update(current) {
      meshes.forEach((mesh, i) => {
        const t = current[i];
        if (!t) {
          mesh.visible = false;
          return;
        }
        mesh.visible = t.alive;
        mesh.position.set(t.x, t.y, 0.2);
        // Moving drones point where they fly.
        if (t.kind === 'drone') mesh.rotation.z = Math.atan2(t.vy, t.vx) - Math.PI / 2;
      });
    },
    dispose() {
      for (const g of geometries.values()) g.dispose();
      for (const m of materials.values()) m.dispose();
    },
  };
}
