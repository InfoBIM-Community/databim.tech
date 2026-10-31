import type { IfcElementInfo } from '@/addon/org.infobim/domain/model/ifc-mesh';

export type IfcViewPoint = { x: number; y: number };

/** How the camera of the view sees: in perspective, or with parallel lines, as the views along an axis do. */
export type IfcProjection = 'perspective' | 'orthographic';

/** An axis of the IFC model: x and y lie on the ground, z goes up. */
export type IfcAxis = 'x' | 'y' | 'z';

export interface IfcViewPort {
  pick(point: IfcViewPoint): number | null;
  describe(expressID: number): IfcElementInfo | undefined;
  highlight(expressID: number | null): void;
  /** Puts the camera on the positive side of the axis, looking at the model along it, without perspective: the model keeps the size it had. Turning the model brings the perspective back. */
  orient(axis: IfcAxis): void;
}
