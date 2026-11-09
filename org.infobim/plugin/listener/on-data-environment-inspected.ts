import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import { pathsToTree } from '@/ontobdc/shared/adapter/container-format';
import { CONTAINER_INSPECT_COMMAND } from '@/ontobdc/shared/domain/model/container-command';
import type { ContainerInspection, ContainerInspectionNode } from '@/ontobdc/shared/domain/model/container';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';
import '@/addon/org.infobim/domain/model/event';

const CONTAINER_OPENED = 'presentation.container.local.opened';
const STATE_REPORTED = 'presentation.container.state.reported';
const CODE_SUCCESS = 'presentation.main.code.success';
const SOURCE = 'org_infobim_on_data_environment_inspected';

/** The paths of the files of one section of an inspection (`model` or `drawing`), in order. */
function sectionPaths(inspect: ContainerInspection | undefined, kind: 'model' | 'drawing'): string[] {
  const section = inspect?.content?.tree?.children?.find((child) => child.kind === kind);
  const paths: string[] = [];
  const collect = (node: ContainerInspectionNode): void => {
    if (typeof node.path === 'string' && node.path) paths.push(node.path);
    node.children?.forEach(collect);
  };
  section?.children?.forEach(collect);
  return paths.sort();
}

export class OnDataEnvironmentInspected {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'org_infobim',
    description: 'Tells the models and the drawings of the container, from its inspection, for the Data Environment to show: when a container is opened, when the state of the container is reported, and when an inspection ran after a refresh.',
    arguments: [
      {
        listen: [CONTAINER_OPENED, STATE_REPORTED, CODE_SUCCESS],
        valued: false,
        description: 'A container was opened, its state was reported, or a command ran and worked (the inspection is the one that counts).',
        type: 'str',
      },
    ],
  };

  constructor(private readonly event: AppEvent) {}

  /**
   * Publishes `presentation.data_environment.models.found` and `…drawings.found` with the trees of the files of each
   * section of the inspection. A state with no container, or a command that is not the inspection, says nothing; the
   * Data Environment keeps what it showed.
   */
  run(): void {
    const inspect = this.inspection();
    if (inspect === undefined) return;

    eventBus.publish('presentation.data_environment.models.found', SOURCE, { nodes: pathsToTree(sectionPaths(inspect, 'model')) });
    eventBus.publish('presentation.data_environment.drawings.found', SOURCE, { nodes: pathsToTree(sectionPaths(inspect, 'drawing')) });
  }

  private inspection(): ContainerInspection | undefined {
    if (this.event.type === CODE_SUCCESS) {
      const result = (this.event.payload as AppEventMap[typeof CODE_SUCCESS] | undefined)?.result;
      return result?.stdin === CONTAINER_INSPECT_COMMAND ? (result.stdout as unknown as ContainerInspection) : undefined;
    }
    if (this.event.type === STATE_REPORTED) return (this.event.payload as AppEventMap[typeof STATE_REPORTED] | undefined)?.container?.inspect;
    return (this.event.payload as AppEventMap[typeof CONTAINER_OPENED] | undefined)?.inspect;
  }
}
