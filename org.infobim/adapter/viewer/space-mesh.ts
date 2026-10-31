import { BufferGeometry, Float32BufferAttribute } from 'three';

/** The faces of a mesh in well-known text (`POLYHEDRALSURFACE Z` or `TIN Z`): each one the points of its ring, the closing one left out. Anything else has none. */
export function meshFaces(wkt: string): Array<Array<[number, number, number]>> {
  if (!/^\s*(POLYHEDRALSURFACE|TIN)\s+Z\b/i.test(wkt)) return [];

  const faces: Array<Array<[number, number, number]>> = [];
  for (const ring of wkt.matchAll(/\(\(([^()]*)\)\)/g)) {
    const points = ring[1].split(',').map((pair) => pair.trim().split(/\s+/).map(Number) as [number, number, number]);
    if (points.length < 4 || points.some((point) => point.length !== 3 || point.some((value) => !Number.isFinite(value)))) continue;
    faces.push(points.slice(0, -1));
  }
  return faces;
}

/**
 * The geometry of a mesh for the scene. The model is in the coordinates of IFC (z going up) and the scene has y going up, so
 * a point (x, y, z) of the model is (x, z, -y) of the scene. A face is cut into triangles from its first point, which is
 * right for the faces the shapes have: they are convex.
 */
export function meshGeometry(wkt: string): BufferGeometry | null {
  const faces = meshFaces(wkt);
  if (faces.length === 0) return null;

  const positions: number[] = [];
  for (const face of faces) {
    for (let index = 1; index < face.length - 1; index += 1) {
      for (const [x, y, z] of [face[0], face[index], face[index + 1]]) positions.push(x, z, -y);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
