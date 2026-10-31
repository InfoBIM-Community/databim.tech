import type { IfcAxis } from '@/addon/org.infobim/domain/model/ifc-view';
import {
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from 'three';

/**
 * The axes of the model, as the IFC names them. The geometry comes out of web-ifc with the Y axis
 * up: the x of the IFC is the x of the scene, its z the y of the scene (up), and its y the -z of the scene.
 */
export const AXES: ReadonlyArray<{ axis: IfcAxis; label: string; color: string; direction: Vector3 }> = [
  { axis: 'x', label: 'X', color: '#e53935', direction: new Vector3(1, 0, 0) },
  { axis: 'y', label: 'Y', color: '#43a047', direction: new Vector3(0, 0, -1) },
  { axis: 'z', label: 'Z', color: '#1e88e5', direction: new Vector3(0, 1, 0) },
];

/** The side of the square the axes are drawn in, and its distance from the corner, in CSS pixels. */
const SIZE_PX = 96;
const MARGIN_PX = 10;
const SHAFT_LENGTH = 0.72;
const LABEL_DISTANCE = 1.28;
/** How far from the label of an axis, in CSS pixels, a click still chooses it. */
const HIT_RADIUS_PX = 16;

function labelSprite(text: string, color: string): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.font = 'bold 96px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = color;
    context.fillText(text, 64, 68);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(0.55, 0.55, 1);
  sprite.renderOrder = 1;
  return sprite;
}

/** The camera of the view: it sees in perspective, or with parallel lines. */
export type ViewCamera = PerspectiveCamera | OrthographicCamera;

export type AxesGizmo = {
  /** Draws the axes over the corner of what the renderer just drew, as the camera of the view sees them there. */
  render(renderer: WebGLRenderer, camera: ViewCamera): void;
  /**
   * The axis whose label is under the point, given in CSS pixels from the top left corner of the view, as
   * the camera sees the axes now; null when the point is on none.
   */
  axisAt(point: { x: number; y: number }, size: { width: number; height: number }, camera: ViewCamera): IfcAxis | null;
  dispose(): void;
};

/** How far in front of the camera the axes are drawn, in the units of the scene; only the size they have on the screen depends on it. */
const DEPTH = 10;
/** The same, for parallel lines, where the scene is in pixels. */
const PARALLEL_DEPTH = 500;

/**
 * The x, y and z axes of the IFC model in a corner of the view, in red, green and blue. They are
 * drawn by a camera that looks as the camera of the view does, with its field of view, and they sit where
 * the corner is: each one is seen in perspective, and heads for its own vanishing point, as the edges of the
 * model do. When the view has parallel lines, so do the axes.
 */
export function createAxesGizmo(): AxesGizmo {
  const scene = new Scene();
  const group = new Group();
  scene.add(group);
  const perspective = new PerspectiveCamera(50, 1, 0.1, DEPTH * 4);
  const parallel = new OrthographicCamera(-1, 1, 1, -1, 0.1, PARALLEL_DEPTH * 2);
  let camera: ViewCamera = perspective;
  const disposables: Array<{ dispose(): void }> = [];

  const up = new Vector3(0, 1, 0);
  for (const { label, color, direction } of AXES) {
    const material = new MeshBasicMaterial({ color });
    const shaft = new Mesh(new CylinderGeometry(0.045, 0.045, SHAFT_LENGTH, 12), material);
    const head = new Mesh(new ConeGeometry(0.12, 1 - SHAFT_LENGTH, 16), material);
    const orientation = new Quaternion().setFromUnitVectors(up, direction);
    shaft.quaternion.copy(orientation);
    shaft.position.copy(direction).multiplyScalar(SHAFT_LENGTH / 2);
    head.quaternion.copy(orientation);
    head.position.copy(direction).multiplyScalar(SHAFT_LENGTH + (1 - SHAFT_LENGTH) / 2);
    const sprite = labelSprite(label, color);
    sprite.position.copy(direction).multiplyScalar(LABEL_DISTANCE);
    group.add(shaft, head, sprite);
    disposables.push(material, shaft.geometry, head.geometry, sprite.material, sprite.material.map as CanvasTexture);
  }

  /** Looks where the camera of the view looks, and puts the axes at the corner, the size they have in pixels. */
  const place = (viewCamera: ViewCamera, width: number, height: number): void => {
    const centre = MARGIN_PX + SIZE_PX / 2;
    if (viewCamera instanceof OrthographicCamera) {
      // With parallel lines the scene is the screen: a unit is a pixel, and the corner is an offset from the centre.
      camera = parallel;
      parallel.left = -width / 2;
      parallel.right = width / 2;
      parallel.top = height / 2;
      parallel.bottom = -height / 2;
      parallel.updateProjectionMatrix();
      parallel.position.set(0, 0, 0);
      parallel.quaternion.copy(viewCamera.quaternion);
      parallel.updateMatrixWorld();
      group.position.set(centre - width / 2, centre - height / 2, -PARALLEL_DEPTH).applyQuaternion(parallel.quaternion);
      group.scale.setScalar(SIZE_PX / 3.2);
      group.updateMatrixWorld(true);
      return;
    }

    camera = perspective;
    perspective.fov = viewCamera.fov;
    perspective.aspect = width / height;
    perspective.updateProjectionMatrix();
    perspective.position.set(0, 0, 0);
    perspective.quaternion.copy(viewCamera.quaternion);
    perspective.updateMatrixWorld();

    const ray = new Vector3((2 * centre) / width - 1, (2 * centre) / height - 1, 0.5).unproject(perspective).normalize();
    const ahead = ray.clone().applyQuaternion(perspective.quaternion.clone().invert()).z;
    group.position.copy(ray).multiplyScalar(DEPTH / -ahead);
    const unitsPerPixel = (2 * DEPTH * Math.tan((perspective.fov * Math.PI) / 360)) / height;
    group.scale.setScalar((SIZE_PX / 3.2) * unitsPerPixel);
    group.updateMatrixWorld(true);
  };

  return {
    render(renderer, viewCamera) {
      const size = renderer.getSize(new Vector2());
      if (size.x < SIZE_PX + MARGIN_PX * 2 || size.y < SIZE_PX + MARGIN_PX * 2) return;

      place(viewCamera, size.x, size.y);
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.autoClear = autoClear;
    },
    axisAt(point, size, viewCamera) {
      if (size.width < SIZE_PX + MARGIN_PX * 2 || size.height < SIZE_PX + MARGIN_PX * 2) return null;

      place(viewCamera, size.width, size.height);
      let nearest: IfcAxis | null = null;
      let nearestDistance = HIT_RADIUS_PX;
      for (const { axis, direction } of AXES) {
        const label = direction.clone().multiplyScalar(LABEL_DISTANCE).applyMatrix4(group.matrixWorld).project(camera);
        const distance = Math.hypot(
          point.x - ((label.x + 1) / 2) * size.width,
          point.y - ((1 - label.y) / 2) * size.height,
        );
        if (distance < nearestDistance) {
          nearest = axis;
          nearestDistance = distance;
        }
      }
      return nearest;
    },
    dispose() {
      disposables.forEach((item) => item.dispose());
    },
  };
}
