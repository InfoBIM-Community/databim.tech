import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import { entityGroupsOf } from '@/ontobdc/shared/adapter/container-format';
import { failureMessage, quoted, requestCommand } from '@/ontobdc/shared/adapter/command-request';
import { EntityRepository } from '@/ontobdc/shared/adapter/entity-repository';
import { notify } from '@/ontobdc/shared/adapter/notice';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';
import { translate } from '@/ontobdc/shared/plugin/i18n';
import '@/addon/org.infobim/domain/model/event';
import { IfcViewRepository } from '@/addon/org.infobim/adapter/ifc-view-repository';

const VIEW_DOUBLE_CLICKED = 'presentation.ifc.view.double_clicked';
type IfcViewDoubleClicked = AppEventMap[typeof VIEW_DOUBLE_CLICKED];
const SOURCE = 'org_infobim_on_ifc_view_double_clicked';

export class OnIfcViewDoubleClicked {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'org_infobim',
    description: 'Opens the element under a double click in the 3D view of an IFC tab as an entity.',
    arguments: [
      {
        listen: [VIEW_DOUBLE_CLICKED],
        valued: true,
        parameter: 'item',
        description: 'Path of the IFC file whose tab was double clicked.',
        type: 'str',
      },
    ],
  };

  private readonly request: IfcViewDoubleClicked | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as IfcViewDoubleClicked | undefined;
  }

  /**
   * Asks InfoBIM to inspect the element under the double click, `infobim ifc --guid <GlobalId> --ifc-model-path <file> --inspect`,
   * and opens what it answers as the entity tab of the element. A double click on nothing does nothing: the
   * click it begins with has already cleared the selection.
   */
  async run(): Promise<void> {
    if (!this.request?.item) throw new Error('The double click carries no IFC file.');

    const view = IfcViewRepository.getInstance().get(this.request.item);
    const expressID = view?.pick(this.request);
    const element = view && expressID !== null && expressID !== undefined ? view.describe(expressID) : undefined;
    if (!element) return;
    if (!element.globalId) {
      notify(translate('ifc.element.noGlobalId'), 'warning');
      return;
    }

    try {
      const result = await requestCommand(`infobim ifc --guid ${quoted(element.globalId)} --ifc-model-path ${quoted(this.request.item)} --inspect`, SOURCE);
      const groups = entityGroupsOf(result.stdout);
      if (!groups?.some((group) => group.items.some((item) => item.id === element.globalId))) {
        throw new Error('The inspection did not answer with the element.');
      }
      EntityRepository.getInstance().attach(groups);
      eventBus.publish('presentation.container.entity.found', SOURCE, { groups });
    } catch (error) {
      notify(translate('ifc.element.inspectFailed', { message: failureMessage(error) }), 'error');
      return;
    }

    eventBus.publish('presentation.main.panel.open.requested', SOURCE, {
      container: 'surface',
      id: `entity:${element.globalId}`,
      component: 'entity',
      title: element.name || element.globalId,
    });
  }
}
