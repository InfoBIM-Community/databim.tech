import { createPrompt } from '@/ontobdc/shared/adapter/terminal-prompt';
import { eventBus } from '@/ontobdc/shared/adapter/event-bus';
import '@/addon/org.infobim/domain/model/event';

const SOURCE = 'org_infobim_modeling_prompt';

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5 10 5l6.5 3.5v7L10 19l-6.5-3.5z"/><path d="M3.5 8.5 10 12l6.5-3.5M10 12v7"/><circle cx="17.5" cy="16.5" r="2.6"/><path d="m19.5 18.5 2 2"/></svg>';

/** The button that looks a modelling term up (an IFC class, for one): the term typed is asked for in `presentation.modeling.lookup.requested`. */
export default function modelingPrompt(): HTMLElement {
  return createPrompt({
    icon: ICON,
    messages: { button: 'org_infobim.modeling.button', placeholder: 'org_infobim.modeling.placeholder', send: 'org_infobim.modeling.send' },
    rows: 1,
    run: (term) => eventBus.publish('presentation.modeling.lookup.requested', SOURCE, { term }),
  });
}
