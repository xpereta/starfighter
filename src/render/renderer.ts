import * as THREE from 'three';

/** Reference screen (Steam Deck). Visible world height at start, in world units. */
const REFERENCE_ASPECT = 1280 / 800;
const VIEW_WIDTH = 1600;

export interface Renderer {
  render(): void;
  dispose(): void;
}

export function createRenderer(container: HTMLElement): Renderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060d);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

  // Placeholder flat ship: nose points up (+y).
  const shape = new THREE.Shape();
  shape.moveTo(0, 60);
  shape.lineTo(40, -40);
  shape.lineTo(0, -20);
  shape.lineTo(-40, -40);
  shape.closePath();
  const ship = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color: 0x4ee1ff }),
  );
  scene.add(ship);

  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    // Same visible width regardless of screen size; height follows the aspect.
    const aspect = w / h || REFERENCE_ASPECT;
    const halfW = VIEW_WIDTH / 2;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfW / aspect;
    camera.bottom = -halfW / aspect;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    render: () => renderer.render(scene, camera),
    dispose() {
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
