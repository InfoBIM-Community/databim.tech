import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';
import '@/addon/org.infobim/domain/model/event';
import { IfcViewRepository } from '@/addon/org.infobim/adapter/ifc-view-repository';

const AXIS_CLICKED = 'presentation.ifc.view.axis_clicked';
type IfcViewAxisClicked = AppEventMap[typeof AXIS_CLICKED];
const SOURCE = 'org_infobim_on_ifc_view_axis_clicked';

export class OnIfcViewAxisClicked {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'org_infobim',
    description: 'Puts the camera of the 3D view of an IFC tab on the side of the axis that was clicked, looking at the model along it.',
    arguments: [
      {
        listen: [AXIS_CLICKED],
        valued: true,
        parameter: 'item',
        description: 'Path of the IFC file whose 3D view had an axis clicked.',
        type: 'str',
      },
    ],
  };

  private readonly request: IfcViewAxisClicked | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as IfcViewAxisClicked | undefined;
  }

  /** Turns the camera of the view and says it did: `presentation.ifc.view.oriented`. */
  run(): void {
    if (!this.request?.item) throw new Error('The axis click carries no IFC file.');

    const view = IfcViewRepository.getInstance().get(this.request.item);
    if (!view) return;

    view.orient(this.request.axis);
    eventBus.publish('presentation.ifc.view.oriented', SOURCE, { item: this.request.item, axis: this.request.axis });
  }
}
