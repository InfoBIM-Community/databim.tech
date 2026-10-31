import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';
import { translate } from '@/ontobdc/shared/plugin/i18n';
import '@/addon/org.infobim/domain/model/event';

const ELEMENT_SELECTED = 'presentation.ifc.element.selected';
const IFC_CLOSED = 'presentation.main.ifc.closed';
const FILE_RELOAD = 'presentation.explorer.file.reload.requested';
type IfcElementSelected = AppEventMap[typeof ELEMENT_SELECTED];
type IfcClosed = AppEventMap[typeof IFC_CLOSED] | AppEventMap[typeof FILE_RELOAD];
const SOURCE = 'org_infobim_on_ifc_element_selected';

/** The element each open IFC model has selected now, by the path of the file, so selecting the same one again says nothing. */
const selected = new Map<string, number>();

export class OnIfcElementSelected {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'org_infobim',
    description: 'Says in the assistant which element of an IFC model was selected in its 3D view, once for each selection.',
    arguments: [
      {
        listen: [ELEMENT_SELECTED, IFC_CLOSED, FILE_RELOAD],
        valued: true,
        parameter: 'item',
        description: 'Path of the IFC file whose 3D view had an element selected, whose tab was closed, or that was read again.',
        type: 'str',
      },
    ],
  };

  private readonly selection: IfcElementSelected | IfcClosed | undefined;

  constructor(private readonly event: AppEvent) {
    this.selection = event.payload as IfcElementSelected | IfcClosed | undefined;
  }

  /**
   * Posts a bubble in the assistant with what the selected element is: its name,
   * its IFC class, its global id and express id, and the model it belongs to. It says
   * nothing when the click cleared the selection (`element` is null), or when it
   * selected the element the model already had selected; clearing the selection, or
   * closing the tab of the model, or reading it again, makes the next one count again.
   */
  run(): void {
    const item = this.selection?.item;
    if (!item) throw new Error('The selection carries no IFC file.');

    if (this.event.type === IFC_CLOSED || this.event.type === FILE_RELOAD) {
      selected.delete(item);
      return;
    }

    const element = (this.selection as IfcElementSelected).element;
    if (!element) {
      selected.delete(item);
      return;
    }
    if (selected.get(item) === element.expressID) return;
    selected.set(item, element.expressID);

    eventBus.publish('presentation.assistant.message.sent', SOURCE, {
      text: translate('ifc.element.selected', {
        type: element.type,
        name: element.name || translate('ifc.element.unnamed'),
        globalId: element.globalId,
        expressID: element.expressID,
        file: item.split('/').pop() || item,
      }),
    });
  }
}
