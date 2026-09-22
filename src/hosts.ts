export interface HostAdapter {
  name: string;
  kind: "assistant" | "local";
  description?: string;
}
const registry = new Map<string, HostAdapter>();
export function registerHost(adapter: HostAdapter) {
  if (!/^[a-z][a-z0-9-]{1,30}$/.test(adapter.name))
    throw Error(`Invalid host name: ${adapter.name}`);
  if (registry.has(adapter.name))
    throw Error(`Host already registered: ${adapter.name}`);
  registry.set(adapter.name, adapter);
}
export const isRegisteredHost = (name: string) => registry.has(name);
export const hostNames = () => [...registry.keys()];
export function getHost(name: string): HostAdapter {
  const adapter = registry.get(name);
  if (!adapter) throw Error(`Unregistered host: ${name}`);
  return adapter;
}
registerHost({ name: "codex", kind: "assistant", description: "Codex CLI" });
registerHost({ name: "claude", kind: "assistant", description: "Claude Code" });
registerHost({ name: "local", kind: "local", description: "Local operator" });
