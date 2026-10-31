import {
  Box3,
  Box3Helper,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  GridHelper,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { IfcElementInfo } from '@/addon/org.infobim/domain/model/ifc-mesh';
import type { IfcAxis, IfcProjection, IfcViewPoint, IfcViewPort } from '@/addon/org.infobim/domain/model/ifc-view';
import { getTheme, onThemeChange } from '@/ontobdc/shared/adapter/theme';
import { AXES, createAxesGizmo, type ViewCamera } from '@/addon/org.infobim/adapter/viewer/axes-gizmo';
import { loadIfcModel } from '@/addon/org.infobim/adapter/viewer/ifc-geometry';
import { meshGeometry } from '@/addon/org.infobim/adapter/viewer/space-mesh';
import type { EntityGeometry } from '@/ontobdc/shared/domain/model/entity';
import type { SpacePoint, SpacePreview, SpaceView } from '@/ontobdc/shared/domain/model/document-space';

export type ModelHandle = { meshes: number; setVisible(show: boolean): void };

export type ModelViewOptions = {
  onClick?: (point: IfcViewPoint) => void;
  onDoubleClick?: (point: IfcViewPoint) => void;
  /** The user clicked the label of an axis of the corner of the view. */
  onAxisClick?: (axis: IfcAxis) => void;
  /** The view passed from perspective to parallel lines, or back. */
  onProjectionChange?: (projection: IfcProjection) => void;
};

/** The model as a view in space for the geometries of an annotation, besides what it is for the elements of an IFC. */
export type ModelView = IfcViewPort & SpaceView & {
  add(bytes: Uint8Array): Promise<ModelHandle>;
  /** What the view shows now, as an image. */
};

const CLICK_TOLERANCE_PX = 4;
const HIGHLIGHT_COLOR = 0xffb000;
/** The angle, in radians, the model has to be turned by from the way it was put along an axis for the perspective to come back. */
const TURNED_RAD = 1e-4;

/** What the model has of an object of the scene that is drawn: its geometry and its materials, freed. */
function disposeObject(object: Object3D): void {
  object.traverse((child: any) => {
    child.geometry?.dispose();
    const material = child.material as Material | Material[] | undefined;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose();
  });
}

function disposeGroup(group: Group): void {
  const materials = new Set<Material>();
  group.traverse((object: any) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    materials.add(mesh.material as Material);
  });
  materials.forEach((material) => material.dispose());
}

export function createModelView(container: HTMLElement, options: ModelViewOptions = {}): ModelView {
  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0x444444, 2.2));

  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(1, 2, 1.5);
  scene.add(sun);

  const perspective = new PerspectiveCamera(50, 1, 0.1, 1000);
  const orthographic = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  /** The camera that sees now: the one in perspective, or, along an axis, the one with parallel lines. */
  let camera: ViewCamera = perspective;
  /** What the camera with parallel lines sees of the model, from its top to its bottom, at zoom 1; and how it was turned when the camera was put along an axis. */
  let parallelHeight = 1;
  let aligned: Quaternion | null = null;
  let viewAspect = 1;
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(getTheme() === 'light' ? 0xf5f5f5 : 0x1e1e1e);
  renderer.domElement.className = 'ifc-viewer-canvas';
  container.appendChild(renderer.domElement);

  const axes = createAxesGizmo();
  const render = (): void => {
    renderer.render(scene, camera);
    axes.render(renderer, camera);
  };
  const controls = new OrbitControls(perspective as ViewCamera, renderer.domElement);

  const fitOrthographic = (): void => {
    orthographic.top = parallelHeight / 2;
    orthographic.bottom = -parallelHeight / 2;
    orthographic.left = (-parallelHeight * viewAspect) / 2;
    orthographic.right = (parallelHeight * viewAspect) / 2;
    orthographic.updateProjectionMatrix();
  };

  /** What the camera in perspective sees of the model at the distance the target is, as the camera with parallel lines sees it. */
  const visibleHeight = (distance: number): number => 2 * distance * Math.tan((perspective.fov * Math.PI) / 360);

  const changeProjection = (next: ViewCamera): void => {
    if (camera === next) return;
    camera = next;
    controls.object = next;
    options.onProjectionChange?.(next === orthographic ? 'orthographic' : 'perspective');
  };

  /** The person turned the model: the perspective comes back, with the model the size it has on the screen. */
  const backToPerspective = (): void => {
    const distance = parallelHeight / orthographic.zoom / visibleHeight(1);
    perspective.position.copy(controls.target).add(orthographic.position.clone().sub(controls.target).normalize().multiplyScalar(distance));
    perspective.quaternion.copy(orthographic.quaternion);
    aligned = null;
    changeProjection(perspective);
  };

  controls.addEventListener('change', () => {
    if (camera === orthographic && aligned && camera.quaternion.angleTo(aligned) > TURNED_RAD) backToPerspective();
    render();
  });

  const models = new Set<Group>();
  const elements = new Map<number, IfcElementInfo>();
  const highlightMaterial = new MeshLambertMaterial({
    color: HIGHLIGHT_COLOR,
    emissive: HIGHLIGHT_COLOR,
    emissiveIntensity: 0.35,
  });
  const raycaster = new Raycaster();
  let highlighted: Array<{ mesh: Mesh; material: Material | Material[] }> = [];
  let framed = false;
  let disposed = false;

  const frame = (model: Group): void => {
    const box = new Box3().setFromObject(model);
    if (box.isEmpty()) return;

    const size = box.getSize(new Vector3()).length() || 1;
    const center = box.getCenter(new Vector3());
    perspective.near = size / 1000;
    perspective.far = size * 100;
    perspective.updateProjectionMatrix();
    perspective.position.copy(center).add(new Vector3(1, 0.8, 1).normalize().multiplyScalar(size * 1.2));
    controls.target.copy(center);
    controls.update();

    const isLight = getTheme() === 'light';
    const grid = new GridHelper(size * 2, 20, isLight ? 0xcccccc : 0x3a3a3a, isLight ? 0xdddddd : 0x2a2a2a);
    grid.position.set(center.x, box.min.y, center.z);
    scene.add(grid);
    framed = true;
  };

  /** The point of the view the mouse event is at, in normalized device coordinates; null while the view has no size. */
  const pointOf = (event: MouseEvent): IfcViewPoint | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    };
  };

  /** The axis of the corner of the view the mouse event is at, if it is at one. */
  const axisOf = (event: MouseEvent): IfcAxis | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return axes.axisAt({ x: event.clientX - rect.left, y: event.clientY - rect.top }, { width: rect.width, height: rect.height }, camera);
  };

  let pressed: { x: number; y: number } | null = null;

  const onPointerDown = (event: PointerEvent): void => {
    pressed = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
  };

  const onPointerUp = (event: PointerEvent): void => {
    const start = pressed;
    pressed = null;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_TOLERANCE_PX) return;

    const axis = axisOf(event);
    if (axis) {
      options.onAxisClick?.(axis);
      return;
    }

    const point = pointOf(event);
    if (point) options.onClick?.(point);
  };

  const onPointerMove = (event: PointerEvent): void => {
    renderer.domElement.style.cursor = axisOf(event) ? 'pointer' : '';
  };

  const onDoubleClick = (event: MouseEvent): void => {
    if (axisOf(event)) return;

    const point = pointOf(event);
    if (point) options.onDoubleClick?.(point);
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('dblclick', onDoubleClick);

  const clearHighlight = (): void => {
    for (const { mesh, material } of highlighted) mesh.material = material;
    highlighted = [];
  };

  const resize = (): void => {
    const { clientWidth: width, clientHeight: height } = container;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    viewAspect = width / height;
    perspective.aspect = viewAspect;
    perspective.updateProjectionMatrix();
    fitOrthographic();
    render();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const unsubscribeTheme = onThemeChange((theme) => {
    renderer.setClearColor(theme === 'light' ? 0xf5f5f5 : 0x1e1e1e);
    render();
  });

  // The geometries of an annotation are in the coordinates of the model (z going up); the scene has y going up.
  const geometryGroup = new Group();
  scene.add(geometryGroup);
  let previewObject: Object3D | null = null;
  const toScene = (point: SpacePoint): Vector3 => new Vector3(point[0], point[2], -point[1]);
  const toModel = (vector: Vector3): SpacePoint => [vector.x, -vector.z, vector.y];

  /** Sets the ray at a position of the screen, in client pixels; false while the view has no size. */
  const aim = (clientX: number, clientY: number): boolean => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    raycaster.setFromCamera(new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1)), camera);
    return true;
  };
  /** The first thing that is drawn, and not a line that marks it, among these, along the ray. */
  const firstHit = (targets: Object3D[]): ReturnType<Raycaster['intersectObjects']>[number] | undefined =>
    raycaster.intersectObjects(targets, true).find((hit) => (hit.object as Mesh).isMesh);
  const lengthAt = (point: SpacePoint, pixels: number): number => {
    const height = renderer.domElement.clientHeight || 1;
    const seen = camera === orthographic ? parallelHeight / orthographic.zoom : visibleHeight(camera.position.distanceTo(toScene(point)));
    return (pixels * seen) / height;
  };
  const clearGroup = (group: Object3D): void => {
    for (const child of [...group.children]) {
      group.remove(child);
      disposeObject(child);
    }
  };

  return {
    canvas: renderer.domElement,
    pointAt: (clientX, clientY) => {
      if (!aim(clientX, clientY)) return null;
      const hit = firstHit([...[...models].filter((model) => model.visible), geometryGroup]);
      return hit ? toModel(hit.point) : null;
    },
    lengthAt,
    extent: () => {
      const box = new Box3();
      for (const model of models) box.expandByObject(model);
      return box.isEmpty() ? 1 : box.getSize(new Vector3()).length();
    },
    setGeometries: (geometries: EntityGeometry[], selected: string | null) => {
      clearGroup(geometryGroup);
      for (const geometry of geometries) {
        const shape: BufferGeometry | null = meshGeometry(geometry.wkt);
        if (!shape) continue;
        const solid = geometry.fill !== null;
        const group = new Group();
        group.userData.geometryId = geometry.id;
        // A shape with no fill is only its edges, and still takes a click where it is.
        const body = new Mesh(shape, new MeshLambertMaterial({ color: new Color(geometry.fill ?? '#000000'), side: DoubleSide, transparent: true, opacity: 0.85, colorWrite: solid, depthWrite: solid }));
        body.userData.geometryId = geometry.id;
        group.add(body, new LineSegments(new EdgesGeometry(shape, 25), new LineBasicMaterial({ color: new Color(geometry.stroke ?? '#e53935') })));
        if (geometry.id === selected) group.add(new Box3Helper(new Box3().setFromObject(group), new Color(0x1e88e5)));
        geometryGroup.add(group);
      }
      render();
    },
    setPreview: (preview: SpacePreview | null) => {
      if (previewObject) {
        scene.remove(previewObject);
        disposeObject(previewObject);
        previewObject = null;
      }
      if (preview) {
        const material = new MeshBasicMaterial({ color: new Color(preview.color), transparent: true, opacity: 0.5, depthWrite: false });
        const r = preview.size;
        const placed = new Group();
        const part = (shape: BufferGeometry, up: number): void => {
          const mesh = new Mesh(shape, material);
          mesh.position.y = up;
          placed.add(mesh);
        };
        if (preview.shape === 'box') part(new BoxGeometry(2 * r, 2 * r, 2 * r), 0);
        else if (preview.shape === 'cylinder') part(new CylinderGeometry(r, r, 2 * r, 24), 0);
        else if (preview.shape === 'sphere') part(new SphereGeometry(r, 16, 8), 0);
        else {
          // The tip of the stick is where it was put: the stick goes up from it and the ball is on top.
          part(new CylinderGeometry(r / 5, r / 5, 3 * r, 12), 1.5 * r);
          part(new SphereGeometry(r, 16, 8), 4 * r);
        }
        placed.position.copy(toScene(preview.center));
        previewObject = placed;
        scene.add(placed);
      }
      render();
    },
    geometryAt: (clientX, clientY) => {
      if (!aim(clientX, clientY)) return null;
      const hit = firstHit([geometryGroup]);
      return typeof hit?.object.userData.geometryId === 'string' ? hit.object.userData.geometryId : null;
    },
    nudge: (id, delta) => {
      const group = geometryGroup.children.find((child) => child.userData.geometryId === id);
      if (!group) return;
      group.position.copy(toScene(delta));
      render();
    },
    dragDelta: (point, dxPixels, dyPixels) => {
      camera.updateMatrixWorld();
      const scale = lengthAt(point, 1);
      const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      return toModel(right.multiplyScalar(dxPixels * scale).add(up.multiplyScalar(-dyPixels * scale)));
    },
    setOrbit: (enabled) => {
      controls.enabled = enabled;
    },
    capture: () => {
      render();
      return renderer.domElement.toDataURL('image/png');
    },
    pick: (point) => {
      raycaster.setFromCamera(new Vector2(point.x, point.y), camera);
      const meshes = [...models].filter((model) => model.visible).flatMap((model) => model.children);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      const expressID = hit?.object.userData.expressID;
      return typeof expressID === 'number' ? expressID : null;
    },
    describe: (expressID) => elements.get(expressID),
    orient: (axis) => {
      const direction = AXES.find((candidate) => candidate.axis === axis)?.direction.clone();
      if (!direction) return;
      // Looking straight down leaves the orbit no horizontal to keep: the camera stays a hair off the vertical.
      if (axis === 'z') direction.set(0, 1, 0.001).normalize();

      // The model keeps the size it has on the screen at the target.
      const distance = camera.position.distanceTo(controls.target);
      parallelHeight = camera === perspective ? visibleHeight(distance) : parallelHeight / orthographic.zoom;
      orthographic.zoom = 1;
      orthographic.near = perspective.near;
      orthographic.far = perspective.far;
      orthographic.position.copy(controls.target).addScaledVector(direction, distance);
      fitOrthographic();
      aligned = null;
      changeProjection(orthographic);
      controls.update();
      aligned = orthographic.quaternion.clone();
      render();
    },
    highlight: (expressID) => {
      clearHighlight();
      if (expressID !== null) {
        for (const model of models) {
          for (const child of model.children) {
            const mesh = child as Mesh;
            if (mesh.userData.expressID !== expressID) continue;
            highlighted.push({ mesh, material: mesh.material });
            mesh.material = highlightMaterial;
          }
        }
      }
      render();
    },
    add: async (bytes) => {
      const { group: model, elements: table } = await loadIfcModel(bytes);
      for (const element of table) elements.set(element.expressID, element);
      if (disposed) {
        disposeGroup(model);
        throw new Error('The view was closed.');
      }
      models.add(model);
      scene.add(model);
      if (!framed) frame(model);
      render();
      return {
        meshes: model.children.length,
        setVisible: (show: boolean) => {
          model.visible = show;
          render();
        },
      };
    },
    dispose: () => {
      disposed = true;
      clearHighlight();
      highlightMaterial.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('dblclick', onDoubleClick);
      resizeObserver.disconnect();
      unsubscribeTheme();
      controls.dispose();
      axes.dispose();
      clearGroup(geometryGroup);
      if (previewObject) disposeObject(previewObject);
      models.forEach(disposeGroup);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
