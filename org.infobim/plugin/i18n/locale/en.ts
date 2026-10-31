/**
 * The words of the InfoBIM addon, in English. The core reads every
 * plugin/i18n/locale file of the addons, by the name of the file, and the keys
 * below are added to the message keys of the application.
 */
export const en = {
  'drawing.loading': 'Loading drawing…',
  'drawing.error': 'Could not open the drawing: {message}',
  'drawing.layers': 'Layers',
  'drawing.dwgUnsupported': 'DWG files cannot be opened in the browser. Convert the file to DXF to view it.',
  'ifc.element.selected': 'Selected {type}: “{name}” (GlobalId {globalId}, ExpressID {expressID}) in {file}.',
  'ifc.element.unnamed': 'unnamed',
  'ifc.element.inspectFailed': 'Could not inspect the element: {message}',
  'ifc.element.noGlobalId': 'The element has no GlobalId, so it cannot be inspected.',
  'org_infobim.modeling.button': 'Look up a modelling term',
  'org_infobim.modeling.placeholder': 'Term, such as IfcWall…',
  'org_infobim.modeling.send': 'Look up',
  'modeling.facade': '{name} (entity {iri}).\nFields: {fields}.',
  'modeling.definition': '{name}, a class of IFC4 ({iri}).',
  'modeling.superclasses': 'Kind of: {list}.',
  'modeling.subclasses': 'Subclasses: {list}.',
  'modeling.attributes': 'Attributes: {list}.',
  'modeling.types': 'Predefined types: {list}.',
  'modeling.none': 'none',
  'modeling.failed': 'Could not look up “{term}”: {message}',
};

declare module '@/ontobdc/shared/plugin/i18n' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AddonMessages extends Record<keyof typeof en, string> {}
}

export default en;
