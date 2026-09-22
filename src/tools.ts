import type { Store } from "./store.js";
import type { Capability, Host } from "./schema.js";
export interface ToolRunContext {
  contextOptions: { files?: string[]; entities?: string[] };
  checkpoint: { steps: Record<string, any> };
}
export interface ToolDefinition {
  name: string;
  run(
    s: Store,
    host: Host,
    input: any,
    ctx: ToolRunContext,
  ): any | Promise<any>;
  requiresPrecedingTool?: string;
  minAutonomy?: "A0" | "A1" | "A2";
  producesCitations?: boolean;
}
const registry = new Map<string, ToolDefinition>();
const autonomyOrder = { A0: 0, A1: 1, A2: 2 } as const;
export function registerTool(def: ToolDefinition) {
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(def.name))
    throw Error(`Invalid tool name: ${def.name}`);
  if (registry.has(def.name))
    throw Error(`Tool already registered: ${def.name}`);
  registry.set(def.name, def);
}
export const hasTool = (name: string) => registry.has(name);
export const toolNames = () => [...registry.keys()];
export function getTool(name: string): ToolDefinition {
  const def = registry.get(name);
  if (!def) throw Error(`Unregistered capability tool: ${name}`);
  return def;
}
export function validateCapabilityTools(c: Capability): string[] {
  const errors: string[] = [];
  c.steps.forEach((step, index) => {
    const def = registry.get(step.tool);
    if (!def) {
      errors.push(`Unregistered capability tool: ${step.tool}`);
      return;
    }
    if (
      def.requiresPrecedingTool &&
      !c.steps
        .slice(0, index)
        .some((prior) => prior.tool === def.requiresPrecedingTool)
    )
      errors.push(
        `${step.tool} requires a preceding ${def.requiresPrecedingTool} step`,
      );
    if (
      def.minAutonomy &&
      autonomyOrder[c.autonomy] < autonomyOrder[def.minAutonomy]
    )
      errors.push(`${step.tool} requires autonomy ${def.minAutonomy}`);
  });
  if (
    c.evaluation.requireCitations &&
    !c.steps.some((step) => registry.get(step.tool)?.producesCitations)
  )
    errors.push("A cited output requires a step whose tool produces citations");
  return errors;
}
export function assertCapabilityTools(c: Capability) {
  const errors = validateCapabilityTools(c);
  if (errors.length) throw Error(errors.join("; "));
}
