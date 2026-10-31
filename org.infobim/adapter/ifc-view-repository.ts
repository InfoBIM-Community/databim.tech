import type { IfcViewPort } from '@/addon/org.infobim/domain/model/ifc-view';

export class IfcViewRepository {
  private static instance: IfcViewRepository | null = null;

  private readonly views = new Map<string, IfcViewPort>();

  static getInstance(): IfcViewRepository {
    IfcViewRepository.instance ??= new IfcViewRepository();
    return IfcViewRepository.instance;
  }

  register(item: string, view: IfcViewPort): () => void {
    this.views.set(item, view);
    return () => {
      if (this.views.get(item) === view) this.views.delete(item);
    };
  }

  get(item: string): IfcViewPort | undefined {
    return this.views.get(item);
  }
}
