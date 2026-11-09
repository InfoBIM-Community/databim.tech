import type { MenuEntry } from '@/ontobdc/shared/adapter/menu';
import makeDataEnvironment from '@/addon/org.infobim/plugin/panel/data-environment';

const dataEnvironmentMenu: MenuEntry = {
  id: 'data_environment',
  icon: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/>
      <path d="M4 7.5 12 12l8-4.5M12 12v9"/>
    </svg>
  `,
  label: 'nav.data_environment',
  header: 'pane.data_environment.header',
  panel: makeDataEnvironment,
};

export default dataEnvironmentMenu;
