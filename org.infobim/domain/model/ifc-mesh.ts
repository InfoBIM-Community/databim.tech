export type IfcMeshData = {
  expressID: number;
  vertices: Float32Array;
  indices: Uint32Array;
  matrix: number[];
  color: [number, number, number, number];
};

export type IfcElementInfo = {
  expressID: number;
  globalId: string;
  type: string;
  name: string;
};

export type IfcConvertRequest = { id: number; bytes: ArrayBuffer };

export type IfcConvertResponse =
  | { id: number; meshes: IfcMeshData[]; elements: IfcElementInfo[] }
  | { id: number; error: string };
