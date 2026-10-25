import type { ICapability, ICapabilityRegistry } from '../interfaces/capabilities.js';

export class CapabilityRegistry implements ICapabilityRegistry {
  private readonly map = new Map<string, ICapability>();

  register(capability: ICapability): void {
    this.map.set(capability.name, capability);
  }

  resolve(name: string): ICapability | undefined {
    return this.map.get(name);
  }

  list(): readonly ICapability[] {
    return Array.from(this.map.values());
  }
}
