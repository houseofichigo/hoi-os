export interface ConnectorDefinition {
  provider: string;
  mechanism: "host-mediated" | "export" | "local-files";
  importable: boolean;
  description?: string;
}
const registry = new Map<string, ConnectorDefinition>();
export function registerConnector(def: ConnectorDefinition) {
  if (!/^[a-z][a-z0-9-]{1,30}$/.test(def.provider))
    throw Error(`Invalid connector provider: ${def.provider}`);
  if (registry.has(def.provider))
    throw Error(`Connector already registered: ${def.provider}`);
  registry.set(def.provider, def);
}
export const isRegisteredConnector = (provider: string) =>
  registry.has(provider);
export const isImportableConnector = (provider: string) =>
  registry.get(provider)?.importable ?? false;
export const connectorNames = () => [...registry.keys()];
export function getConnector(provider: string): ConnectorDefinition {
  const def = registry.get(provider);
  if (!def) throw Error(`Unregistered connector: ${provider}`);
  return def;
}
registerConnector({
  provider: "gmail",
  mechanism: "host-mediated",
  importable: true,
});
registerConnector({
  provider: "calendar",
  mechanism: "host-mediated",
  importable: true,
});
registerConnector({
  provider: "drive",
  mechanism: "host-mediated",
  importable: true,
});
registerConnector({
  provider: "github",
  mechanism: "host-mediated",
  importable: true,
});
registerConnector({
  provider: "files",
  mechanism: "local-files",
  importable: false,
  description: "Local files ingest directly; no connection bridge",
});
