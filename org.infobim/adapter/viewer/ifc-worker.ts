/// <reference lib="webworker" />
import { IfcAPI } from 'web-ifc';
import wasmUrl from 'web-ifc/web-ifc.wasm?url';
import type {
  IfcConvertRequest,
  IfcConvertResponse,
  IfcElementInfo,
  IfcMeshData,
} from '@/addon/org.infobim/domain/model/ifc-mesh';

let api: Promise<IfcAPI> | null = null;

function ifcApi(): Promise<IfcAPI> {
  api ??= (async () => {
    const instance = new IfcAPI();
    await instance.Init(() => wasmUrl, true);
    return instance;
  })().catch((error: unknown) => {
    api = null;
    throw error;
  });
  return api;
}

async function convert(bytes: Uint8Array): Promise<{ meshes: IfcMeshData[]; elements: IfcElementInfo[] }> {
  const ifc = await ifcApi();
  const modelID = ifc.OpenModel(bytes);
  if (modelID < 0) throw new Error('The file is not a readable IFC model.');

  const meshes: IfcMeshData[] = [];
  const elements: IfcElementInfo[] = [];

  try {
    ifc.StreamAllMeshes(modelID, (flatMesh: any) => {
      const placed = flatMesh.geometries;
      for (let i = 0; i < placed.size(); i += 1) {
        const { geometryExpressID, flatTransformation, color } = placed.get(i);
        const geometry = ifc.GetGeometry(modelID, geometryExpressID);
        const vertices = ifc.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize()).slice();
        const indices = ifc.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize()).slice();
        geometry.delete();
        if (indices.length === 0) continue;
        meshes.push({
          expressID: flatMesh.expressID,
          vertices,
          indices,
          matrix: Array.from(flatTransformation),
          color: [color.x, color.y, color.z, color.w],
        });
      }
    });

    for (const expressID of new Set(meshes.map((mesh) => mesh.expressID))) {
      const line = ifc.GetLine(modelID, expressID, false);
      elements.push({
        expressID,
        globalId: String(line?.GlobalId?.value ?? ''),
        type: ifc.GetNameFromTypeCode(line?.type ?? 0),
        name: String(line?.Name?.value ?? ''),
      });
    }
  } finally {
    ifc.CloseModel(modelID);
  }

  return { meshes, elements };
}

self.onmessage = async ({ data }: MessageEvent<IfcConvertRequest>) => {
  try {
    const { meshes, elements } = await convert(new Uint8Array(data.bytes));
    const transfer: Transferable[] = meshes.flatMap((mesh) => [mesh.vertices.buffer, mesh.indices.buffer]);
    self.postMessage({ id: data.id, meshes, elements } satisfies IfcConvertResponse, transfer);
  } catch (error) {
    self.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    } satisfies IfcConvertResponse);
  }
};
