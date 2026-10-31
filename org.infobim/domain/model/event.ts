import '@/ontobdc/shared/domain/model/event';
import type { IfcElementInfo } from '@/addon/org.infobim/domain/model/ifc-mesh';
import type { IfcAxis, IfcProjection } from '@/addon/org.infobim/domain/model/ifc-view';

declare module '@/ontobdc/shared/domain/model/event' {
  interface AppEventMap {
    /** The tab of a DXF drawing was closed; item is the path of the file in the container. */
    'presentation.main.dxf.closed': { item: string };
    /** The tab of a DWG drawing was closed; item is the path of the file in the container. */
    'presentation.main.dwg.closed': { item: string };
    'presentation.main.ifc.closed': { item: string };
    /** The user clicked in the 3D view of an IFC tab; x and y are normalized device coordinates (-1 to 1, y up). */
    'presentation.ifc.view.clicked': { item: string; x: number; y: number };
    /** The user double clicked in the 3D view of an IFC tab, at the same kind of point as a click. */
    'presentation.ifc.view.double_clicked': { item: string; x: number; y: number };
    /** The user clicked an axis of the corner of the 3D view of an IFC tab: they want to see the model along it. */
    'presentation.ifc.view.axis_clicked': { item: string; axis: IfcAxis };
    /** The camera of the 3D view of an IFC tab was put on the positive side of an axis, looking at the model along it. */
    'presentation.ifc.view.oriented': { item: string; axis: IfcAxis };
    /** The 3D view of an IFC tab passed from perspective to parallel lines, when the camera was put along an axis, or back when the person turned the model. */
    'presentation.ifc.view.projection.changed': { item: string; projection: IfcProjection };
    /** An element of the 3D view of an IFC tab was selected; element is null when the click cleared the selection. */
    'presentation.ifc.element.selected': { item: string; element: IfcElementInfo | null };
    /** The person asked for a modelling term to be looked up, such as an IFC class. */
    'presentation.modeling.lookup.requested': { term: string };
    /** The lookup of a modelling term ended; `text` is what the assistant answers. */
    'presentation.modeling.lookup.answered': { term: string; text: string; found: boolean };
  }
}

export {};
