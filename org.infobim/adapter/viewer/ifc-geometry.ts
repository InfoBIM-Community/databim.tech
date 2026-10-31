import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
} from 'three';
import type { IfcConvertResponse, IfcElementInfo, IfcMeshData } from '@/addon/org.infobim/domain/model/ifc-mesh';

const MESHES_PER_SLICE = 500;

const yieldToUi = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

type Converted = { meshes: IfcMeshData[]; elements: IfcElementInfo[] };
type Pending = { resolve: (converted: Converted) => void; reject: (error: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function discardWorker(reason: string): void {
  worker?.terminate();
  worker = null;
  for (const call of pending.values()) call.reject(new Error(reason));
  pending.clear();
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./ifc-worker.ts', import.meta.url), { type: 'module' });
  worker.onerror = (event) => {
    event.preventDefault();
    discardWorker(event.message || 'The IFC worker failed.');
  };
  worker.onmessageerror = () => discardWorker('The IFC worker sent an unreadable message.');
  worker.onmessage = ({ data }: MessageEvent<IfcConvertResponse>) => {
    const call = pending.get(data.id);
    if (!call) return;
    pending.delete(data.id);
    if ('error' in data) call.reject(new Error(data.error));
    else call.resolve({ meshes: data.meshes, elements: data.elements });
  };
  return worker;
}

function convertInWorker(bytes: Uint8Array): Promise<Converted> {
  const id = nextId;
  nextId += 1;
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, bytes: buffer }, [buffer]);
  });
}

export async function loadIfcModel(bytes: Uint8Array): Promise<{ group: Group; elements: IfcElementInfo[] }> {
  const { meshes, elements } = await convertInWorker(bytes);
  const group = new Group();
  const materials = new Map<string, MeshLambertMaterial>();

  for (const [index, data] of meshes.entries()) {
    if (index > 0 && index % MESHES_PER_SLICE === 0) await yieldToUi();

    const interleaved = new InterleavedBuffer(data.vertices, 6);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new InterleavedBufferAttribute(interleaved, 3, 0));
    geometry.setAttribute('normal', new InterleavedBufferAttribute(interleaved, 3, 3));
    geometry.setIndex(new BufferAttribute(data.indices, 1));

    const [r, g, b, a] = data.color;
    const key = data.color.join(',');
    let material = materials.get(key);
    if (!material) {
      material = new MeshLambertMaterial({
        color: new Color(r, g, b),
        transparent: a < 1,
        opacity: a,
        side: DoubleSide,
      });
      materials.set(key, material);
    }

    const mesh = new Mesh(geometry, material);
    mesh.userData.expressID = data.expressID;
    mesh.applyMatrix4(new Matrix4().fromArray(data.matrix));
    group.add(mesh);
  }

  return { group, elements };
}
