import { eventBus } from '@/ontobdc/shared/adapter/event-bus';
import { REFRESH_ICON } from '@/ontobdc/shared/adapter/menu-icons';
import { makeFilePanel } from '@/ontobdc/shared/adapter/file-panel';
import '@/addon/org.infobim/domain/model/event';
import '@/addon/org.infobim/plugin/asset/ifc.css';
import { translate } from '@/ontobdc/shared/plugin/i18n';
import { IfcViewRepository } from '@/addon/org.infobim/adapter/ifc-view-repository';

export default makeFilePanel({
  prefix: 'ifc',
  className: 'ifc-panel',
  closedEvent: 'presentation.main.ifc.closed',
  render: async (file, element, item) => {
    const [{ createModelView }, bytes] = await Promise.all([
      import('@/addon/org.infobim/adapter/viewer/model-view'),
      file.arrayBuffer(),
    ]);

    const view = createModelView(element, {
      onClick: ({ x, y }) => eventBus.publish('presentation.ifc.view.clicked', 'ifc', { item, x, y }),
      onAxisClick: (axis) => eventBus.publish('presentation.ifc.view.axis_clicked', 'ifc', { item, axis }),
      onProjectionChange: (projection) => eventBus.publish('presentation.ifc.view.projection.changed', 'ifc', { item, projection }),
      onDoubleClick: ({ x, y }) => eventBus.publish('presentation.ifc.view.double_clicked', 'ifc', { item, x, y }),
    });

    try {
      await view.add(new Uint8Array(bytes));
    } catch (error) {
      view.dispose();
      throw error;
    }

    // Reads the file again, to see what a command changed in it, such as the name of an element.
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'ifc-reload';
    reload.title = translate('file.reload');
    reload.setAttribute('aria-label', reload.title);
    reload.innerHTML = REFRESH_ICON;
    reload.addEventListener('click', () => eventBus.publish('presentation.explorer.file.reload.requested', 'ifc', { item }));
    element.append(reload);

    const forget = IfcViewRepository.getInstance().register(item, view);
    return () => {
      forget();
      view.dispose();
    };
  },
});
