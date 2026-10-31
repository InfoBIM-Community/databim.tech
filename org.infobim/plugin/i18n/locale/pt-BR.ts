import type { en } from './en';

export default {
  'drawing.loading': 'Carregando o desenho…',
  'drawing.error': 'Não foi possível abrir o desenho: {message}',
  'drawing.layers': 'Camadas',
  'drawing.dwgUnsupported': 'Arquivos DWG não podem ser abertos no navegador. Converta o arquivo para DXF para visualizá-lo.',
  'ifc.element.selected': 'Selecionado {type}: “{name}” (GlobalId {globalId}, ExpressID {expressID}) em {file}.',
  'ifc.element.unnamed': 'sem nome',
  'ifc.element.inspectFailed': 'Não foi possível inspecionar o elemento: {message}',
  'ifc.element.noGlobalId': 'O elemento não tem GlobalId, então não pode ser inspecionado.',
  'org_infobim.modeling.button': 'Consultar uma modelagem',
  'org_infobim.modeling.placeholder': 'Termo, como IfcWall…',
  'org_infobim.modeling.send': 'Consultar',
  'modeling.facade': '{name} (entidade {iri}).\nCampos: {fields}.',
  'modeling.definition': '{name}, uma classe do IFC4 ({iri}).',
  'modeling.superclasses': 'Tipo de: {list}.',
  'modeling.subclasses': 'Subclasses: {list}.',
  'modeling.attributes': 'Atributos: {list}.',
  'modeling.types': 'Tipos predefinidos: {list}.',
  'modeling.none': 'nenhuma',
  'modeling.failed': 'Não foi possível consultar “{term}”: {message}',
} satisfies Record<keyof typeof en, string>;
