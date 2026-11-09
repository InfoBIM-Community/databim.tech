import { eventBus } from '@/ontobdc/shared/adapter/event-bus';
import type { Mountable } from '@/ontobdc/shared/adapter/view';
import type { ExplorerNode } from '@/ontobdc/shared/domain/model/explorer-node';
import { applyTranslations, onLocaleChange, translate, type MessageKey } from '@/ontobdc/shared/plugin/i18n';
import '@/addon/org.infobim/domain/model/event';

const SOURCE = 'org_infobim_data_environment';

type GroupId = 'models' | 'drawings' | 'disciplines' | 'federated';

const GROUPS: Array<{ id: GroupId; label: MessageKey; empty: MessageKey }> = [
  { id: 'models', label: 'data_environment.group.models', empty: 'data_environment.models.empty' },
  { id: 'drawings', label: 'data_environment.group.drawings', empty: 'data_environment.drawings.empty' },
  { id: 'disciplines', label: 'data_environment.group.disciplines', empty: 'data_environment.soon' },
  { id: 'federated', label: 'data_environment.group.federated', empty: 'data_environment.soon' },
];

/**
 * The Data Environment panel. It has four groups, one open at a time: the models and the drawings of the container,
 * which arrive in `presentation.data_environment.models.found` and `presentation.data_environment.drawings.found`
 * (each replaces the whole group), and the disciplines and the federated models, which have nothing to show yet.
 * A double click on a file, or Enter on it, publishes `presentation.explorer.file.activated`; the file whose tab is
 * the active one is marked. The panel starts disabled and is enabled when a container opens. It only shows and
 * reports; what those events mean is up to the listeners.
 */
export default function makeDataEnvironment(): Mountable {
  const root = document.createElement('div');
  root.className = 'panel-content tree-panel data-environment-panel';

  const setInactive = (inactive: boolean): void => {
    root.classList.toggle('inactive', inactive);
    root.setAttribute('aria-disabled', inactive ? 'true' : 'false');
    root.inert = inactive;
  };
  setInactive(true);
  const activate = (): void => setInactive(false);

  let selectedRow: HTMLLIElement | null = null;
  /** The file of the active tab, by its path in the container; none when the active tab is not a file. */
  let activePath: string | null = null;

  const select = (row: HTMLLIElement): void => {
    selectedRow?.classList.remove('selected');
    selectedRow = row;
    row.classList.add('selected');
  };

  const open = (path: string): void => {
    eventBus.publish('presentation.explorer.file.activated', SOURCE, { item: path });
  };

  const renderNodes = (nodes: ExplorerNode[], parentPath: string, depth: number): HTMLUListElement => {
    const list = document.createElement('ul');
    list.className = depth === 0 ? 'tree' : 'tree tree-children';
    list.setAttribute('role', depth === 0 ? 'tree' : 'group');

    for (const node of nodes) {
      const path = parentPath ? `${parentPath}/${node.name}` : node.name;
      const isDirectory = node.children !== undefined;

      const item = document.createElement('li');
      item.className = isDirectory ? 'tree-node dir' : 'tree-node file';
      item.dataset.path = path;
      item.setAttribute('role', 'treeitem');
      if (isDirectory) item.setAttribute('aria-expanded', 'false');

      const row = document.createElement('div');
      row.className = 'tree-row';
      row.style.setProperty('--depth', String(depth));

      const button = document.createElement('button');
      button.type = 'button';
      button.className = isDirectory ? 'tree-item dir' : 'tree-item';
      button.textContent = node.name;
      row.append(button);
      item.append(row);

      const children = isDirectory ? renderNodes(node.children ?? [], path, depth + 1) : null;
      if (children) {
        children.hidden = true;
        item.append(children);
      }

      button.addEventListener('click', () => {
        if (children) {
          children.hidden = !children.hidden;
          item.setAttribute('aria-expanded', String(!children.hidden));
        }
        select(item);
      });
      if (!isDirectory) {
        button.addEventListener('dblclick', () => {
          select(item);
          open(path);
        });
        button.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          select(item);
          open(path);
        });
      }
      list.append(item);
    }
    return list;
  };

  /** Marks the file of the active tab, and opens the directories above it so that it is seen. */
  const markActive = (): void => {
    root.querySelectorAll('.tree-node.tab-active').forEach((node) => node.classList.remove('tab-active'));
    if (activePath === null) return;
    root.querySelectorAll<HTMLLIElement>('.tree-node.file').forEach((node) => {
      if (node.dataset.path !== activePath) return;
      node.classList.add('tab-active');
      for (let parent = node.parentElement?.closest<HTMLLIElement>('.tree-node.dir'); parent; parent = parent.parentElement?.closest<HTMLLIElement>('.tree-node.dir')) {
        parent.setAttribute('aria-expanded', 'true');
        parent.querySelector<HTMLUListElement>(':scope > ul')?.removeAttribute('hidden');
      }
    });
  };

  const bodies = new Map<GroupId, HTMLDivElement>();
  const sections = new Map<GroupId, HTMLDetailsElement>();

  const renderGroup = (group: GroupId, nodes: ExplorerNode[]): void => {
    const body = bodies.get(group);
    if (!body) return;
    if (selectedRow && body.contains(selectedRow)) selectedRow = null;
    const definition = GROUPS.find((candidate) => candidate.id === group);
    if (nodes.length === 0 && definition) {
      const empty = document.createElement('p');
      empty.className = 'tree-empty';
      empty.dataset.i18n = definition.empty;
      empty.textContent = translate(definition.empty);
      body.replaceChildren(empty);
    } else {
      body.replaceChildren(renderNodes(nodes, '', 0));
    }
    markActive();
  };

  GROUPS.forEach((group, index) => {
    const section = document.createElement('details');
    section.open = index === 0;
    const summary = document.createElement('summary');
    const label = document.createElement('span');
    label.className = 'tree-group-label';
    label.dataset.i18n = group.label;
    summary.append(label);
    section.append(summary);

    // One group open at a time.
    summary.addEventListener('click', (event) => {
      event.preventDefault();
      if (section.open) return;
      for (const other of sections.values()) other.open = false;
      section.open = true;
    });

    const body = document.createElement('div');
    body.className = 'tree-group-body';
    section.append(body);
    root.append(section);
    bodies.set(group.id, body);
    sections.set(group.id, section);
    renderGroup(group.id, []);
  });

  applyTranslations(root);

  const nodesOf = (payload: { nodes?: ExplorerNode[] } | undefined): ExplorerNode[] =>
    Array.isArray(payload?.nodes) ? payload.nodes : [];

  const unsubscribers = [
    eventBus.subscribe('presentation.container.local.opened', activate),
    eventBus.subscribe('presentation.container.remote.opened', activate),
    eventBus.subscribe('presentation.container.state.reported', ({ payload }) => {
      if (payload?.container) activate();
    }),
    eventBus.subscribe('presentation.data_environment.models.found', ({ payload }) => renderGroup('models', nodesOf(payload))),
    eventBus.subscribe('presentation.data_environment.drawings.found', ({ payload }) => renderGroup('drawings', nodesOf(payload))),
    eventBus.subscribe('presentation.main.panel.activated', ({ payload }) => {
      activePath = payload?.kind === 'file' && payload.path ? payload.path : null;
      markActive();
    }),
    // Translate in place so the trees and the selection survive a locale switch.
    onLocaleChange(() => applyTranslations(root)),
  ];

  // A container may already be open by the time the panel mounts; ask for the
  // current state so the panel does not stay locked forever.
  eventBus.publish('presentation.container.state.requested', SOURCE);

  return {
    element: root,
    dispose: () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      root.remove();
    },
  };
}
