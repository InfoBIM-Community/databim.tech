import { failureMessage, quoted, requestCommand } from '@/ontobdc/shared/adapter/command-request';
import { eventBus, type AppEvent } from '@/ontobdc/shared/adapter/event-bus';
import type { AppEventMap } from '@/ontobdc/shared/domain/model/event';
import type { ListenerMetadata } from '@/ontobdc/shared/domain/model/listener';
import { getLocale, translate } from '@/ontobdc/shared/plugin/i18n';
import '@/addon/org.infobim/domain/model/event';

const LOOKUP_REQUESTED = 'presentation.modeling.lookup.requested';
type LookupRequested = AppEventMap[typeof LOOKUP_REQUESTED];
const SOURCE = 'org_infobim_on_modeling_lookup_requested';

type Labels = Record<string, string>;
type Facade = { name?: string; entity_iri?: string; labels?: unknown; fields?: Array<{ identifier?: string; labels?: unknown }> };
type Definition = {
  name: string;
  entity_iri: string;
  superclasses: string[];
  subclasses: string[];
  attributes: Array<{ name: string; type: string; many: boolean }>;
  predefined_types: string[];
};
/** What `infobim context --entity <term> --describe` answers: the facade published for the entity, else the definition of its IFC class. */
type Description = { kind?: 'facade' | 'definition'; facade?: Facade; definition?: Definition };

/** The label in the language of the application, else in English, else the identifier. */
function labelOf(labels: unknown, fallback: string): string {
  const known = typeof labels === 'object' && labels !== null ? (labels as Labels) : {};
  return known[getLocale().toLowerCase()] ?? known.en ?? fallback;
}

const facadeText = (facade: Facade, term: string): string =>
  translate('modeling.facade', {
    name: labelOf(facade.labels, String(facade.name ?? term)),
    iri: String(facade.entity_iri ?? ''),
    fields: (facade.fields ?? []).map((field) => labelOf(field.labels, field.identifier ?? '')).join(', '),
  });

/** The definition of an IFC class, in lines: what it is a kind of, what is a kind of it, what it has, and the values of its type. A line is left out when there is nothing to say in it. */
function definitionText(definition: Definition): string {
  const none = translate('modeling.none');
  return [
    translate('modeling.definition', { name: definition.name, iri: definition.entity_iri }),
    translate('modeling.superclasses', { list: definition.superclasses.length ? definition.superclasses.join(' › ') : none }),
    translate('modeling.subclasses', { list: definition.subclasses.length ? definition.subclasses.join(', ') : none }),
    translate('modeling.attributes', {
      list: definition.attributes.length ? definition.attributes.map((attribute) => `${attribute.name}: ${attribute.type}${attribute.many ? '[]' : ''}`).join(', ') : none,
    }),
    ...(definition.predefined_types.length ? [translate('modeling.types', { list: definition.predefined_types.join(', ') })] : []),
  ].join('\n');
}

export class OnModelingLookupRequested {
  static readonly METADATA: ListenerMetadata = {
    id: SOURCE,
    logical_component: 'org_infobim',
    description: 'Looks a modelling term up with `infobim context --entity <term> --describe` and answers it in the assistant, as a dialog: what the person asked, then its facade or, when it has none, the definition of its IFC class.',
    arguments: [
      {
        listen: [LOOKUP_REQUESTED],
        valued: true,
        parameter: 'term',
        description: 'The modelling term to look up, such as an IFC class.',
        type: 'str',
      },
    ],
  };

  private readonly request: LookupRequested | undefined;

  constructor(event: AppEvent) {
    this.request = event.payload as LookupRequested | undefined;
  }

  /**
   * Says the term in the assistant as the person's, runs the command and says what it answered: the facade (the entity and its
   * fields) or the definition of the IFC class. When there is neither, says why. Publishes
   * `presentation.modeling.lookup.answered` when it ends.
   */
  async run(): Promise<void> {
    const term = this.request?.term?.trim();
    if (!term) throw new Error('The lookup carries no term.');

    eventBus.publish('presentation.assistant.message.sent', SOURCE, { text: term, from: 'user' });
    let text: string;
    let found = false;
    try {
      const result = await requestCommand(`infobim context --entity ${quoted(term)} --describe`, SOURCE);
      const content = (result.stdout as { content?: Description } | null)?.content;
      if (content?.kind === 'facade') text = facadeText(content.facade ?? {}, term);
      else if (content?.kind === 'definition' && content.definition) text = definitionText(content.definition);
      else throw new Error('The answer describes nothing.');
      found = true;
    } catch (error) {
      text = translate('modeling.failed', { term, message: failureMessage(error) });
    }
    eventBus.publish('presentation.assistant.message.sent', SOURCE, { text });
    eventBus.publish('presentation.modeling.lookup.answered', SOURCE, { term, text, found });
  }
}
