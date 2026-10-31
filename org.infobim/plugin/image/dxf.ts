import type { DocumentImageRenderer } from '@/ontobdc/shared/domain/model/document-image';

/** The longest side of the image, in pixels. */
const SIDE = 2400;

/** A DXF drawing is drawn whole, as dxf-viewer draws it, in a view that is out of the page and is gone once the image is read. */
export const renderer: DocumentImageRenderer = {
  accepts: (path) => /\.dxf$/i.test(path),
  async render(file) {
    const { createDrawingView } = await import('@/addon/org.infobim/adapter/viewer/drawing-view');
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:-${SIDE * 2}px;top:0;width:${SIDE}px;height:${SIDE}px;`;
    document.body.append(host);
    const view = await createDrawingView(host, file);
    try {
      return await view.image(SIDE);
    } finally {
      view.dispose();
      host.remove();
    }
  },
};
