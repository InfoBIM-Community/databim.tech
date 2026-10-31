import type { DocumentSpace, SpaceView } from '@/ontobdc/shared/domain/model/document-space';

/** How an IFC model is seen in a snapshot of it: wide, as a view of a model is. */
const OFFSCREEN = { left: -10000, top: 0 };

/** Opens an IFC model with the 3D viewer of its tab, which is loaded the first time one is shown. */
async function openModel(file: File, host: HTMLElement): Promise<SpaceView> {
  const [{ createModelView }, bytes] = await Promise.all([
    import('@/addon/org.infobim/adapter/viewer/model-view'),
    file.arrayBuffer(),
  ]);
  const view = createModelView(host);
  try {
    await view.add(new Uint8Array(bytes));
  } catch (error) {
    view.dispose();
    throw error;
  }
  return view;
}

/** An IFC model is shown in space, and the geometries of an annotation are put in it by the points of the model the person clicks. */
export const space: DocumentSpace = {
  accepts: (path) => /\.ifc$/i.test(path),
  open: openModel,
  async snapshot(file, geometries, size) {
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:${OFFSCREEN.left}px;top:${OFFSCREEN.top}px;width:${size.width}px;height:${size.height}px;`;
    document.body.append(host);
    try {
      const view = await openModel(file, host);
      try {
        view.setGeometries(geometries, null);
        // The view is read in the same turn it was drawn: after it, the browser may have cleared it.
        const url = view.capture();
        return { blob: await (await fetch(url)).blob(), width: size.width, height: size.height };
      } finally {
        view.dispose();
      }
    } finally {
      host.remove();
    }
  },
};
