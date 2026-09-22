import { readFileSync } from "node:fs";
import { Store } from "./store.js";
import { context } from "./knowledge.js";
import {
  capabilitySchema,
  meetingInput,
  type Host,
  type MeetingInput,
} from "./schema.js";
import { uid, sha, now, writeYaml, atomic } from "./files.js";
import { getTool, assertCapabilityTools } from "./tools.js";
import "./tools-builtin.js";

export function saveCapability(s: Store, input: unknown) {
  const c = capabilitySchema.parse(input);
  assertCapabilityTools(c);
  c.state = "draft";
  if (
    s.one("SELECT id FROM executions WHERE capability=? LIMIT 1", c.id) &&
    c.version <=
      Math.max(
        ...s
          .all("SELECT version FROM executions WHERE capability=?", c.id)
          .map((r) => r.version),
      )
  )
    throw Error("Increment the capability version");
  writeYaml(s.path(`capabilities/${c.id}.yaml`), c);
  s.log("capability.drafted", { id: c.id, version: c.version });
  return c;
}
function resolveMeeting(s: Store, input: MeetingInput) {
  if (
    input.client &&
    !s.one(
      "SELECT id FROM entities WHERE id=? AND type IN (?,?)",
      input.client,
      "client",
      "organization",
    )
  )
    throw Error("Unknown client; resolve identity first");
  if (
    input.project &&
    !s.one(
      "SELECT id FROM entities WHERE id=? AND type=?",
      input.project,
      "project",
    )
  )
    throw Error("Unknown project");
  return input;
}
export async function run(
  s: Store,
  capabilityId: string,
  input: unknown,
  host: Host,
  options: { resume?: string; evaluate?: boolean; approval?: string } = {},
): Promise<any> {
  s.assertHost(host);
  const capability = s.capability(capabilityId);
  assertCapabilityTools(capability);
  if (capability.state !== "active" && !options.evaluate)
    throw Error("Capability is draft; evaluate and activate it first");
  const policy = s.policy();
  if (policy.actions.draft === "deny")
    throw Error("Draft actions denied by policy");
  const parsed = resolveMeeting(s, meetingInput.parse(input));
  s.validateEvidence(parsed.eventEvidence, host, true);
  const digest = sha(JSON.stringify(capability)),
    policyDigest = sha(JSON.stringify(policy));
  const contextOptions = {
    files: capability.requiredContext,
    entities: [parsed.client, parsed.project].filter(Boolean) as string[],
  };
  const contextDigest = sha(JSON.stringify(context(s, host, contextOptions)));
  const sourceDigest = sha(
    JSON.stringify(
      s.all("SELECT id,current_revision,metadata FROM sources ORDER BY id"),
    ),
  );
  const prior = options.resume
    ? s.one("SELECT * FROM executions WHERE id=?", options.resume)
    : null;
  if (options.resume && !prior) throw Error("Unknown execution");
  if (
    prior &&
    (prior.input !== JSON.stringify(parsed) ||
      prior.capability !== capabilityId ||
      prior.version !== capability.version ||
      prior.host !== host)
  )
    throw Error("Resume input, host or capability changed");
  const action = {
    capabilityId,
    digest,
    policyDigest,
    contextDigest,
    sourceDigest,
    input: parsed,
    host,
  };
  const actionHash = sha(JSON.stringify(action));
  if (policy.actions.draft === "approve" && !prior) {
    if (!options.approval) {
      const planId = uid("plan");
      s.exec(
        "INSERT INTO plans VALUES(?,?,?,?,?,?)",
        planId,
        "run",
        JSON.stringify(action),
        actionHash,
        "proposed",
        now(),
      );
      return {
        id: planId,
        state: "awaiting-approval",
        hash: actionHash,
        action,
      };
    }
    const a = s.one("SELECT * FROM approvals WHERE id=?", options.approval);
    if (
      !a ||
      a.consumed_at ||
      a.action_hash !== actionHash ||
      a.policy_hash !== policyDigest
    )
      throw Error("Run approval is missing, changed, or consumed");
  }
  const id = prior?.id ?? uid("execution");
  let checkpoint: any = prior
    ? JSON.parse(prior.checkpoint)
    : { digest, policyDigest, contextDigest, sourceDigest, steps: {} };
  if (
    checkpoint.digest !== digest ||
    checkpoint.policyDigest !== policyDigest ||
    checkpoint.contextDigest !== contextDigest ||
    checkpoint.sourceDigest !== sourceDigest
  )
    throw Error(
      "Capability, policy, context or sources changed; start a new execution",
    );
  for (const step of Object.values(checkpoint.steps) as any[])
    if (step?.results) s.validateEvidence(step.results, host, true);
  if (prior?.state === "completed")
    return { id, state: "completed", output: JSON.parse(prior.output) };
  if (!prior)
    s.tx(() => {
      s.exec(
        "INSERT INTO executions VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        id,
        capabilityId,
        capability.version,
        JSON.stringify(parsed),
        host,
        "running",
        JSON.stringify(checkpoint),
        null,
        null,
        now(),
        null,
      );
      if (policy.actions.draft === "approve") {
        s.exec(
          "UPDATE approvals SET consumed_at=? WHERE id=?",
          now(),
          options.approval,
        );
        s.exec("UPDATE plans SET state=? WHERE hash=?", "applied", actionHash);
      }
    });
  else
    s.exec(
      "UPDATE executions SET state=?,error=NULL WHERE id=?",
      "running",
      id,
    );
  try {
    for (const step of capability.steps) {
      if (checkpoint.steps[step.id]) continue;
      const result: any = await getTool(step.tool).run(s, host, parsed, {
        contextOptions,
        checkpoint,
      });
      checkpoint.steps[step.id] = result;
      s.exec(
        "UPDATE executions SET checkpoint=? WHERE id=?",
        JSON.stringify(checkpoint),
        id,
      );
    }
    const values = Object.values(checkpoint.steps) as any[];
    const output = values.find((v) => v?.markdown) ?? {
      steps: checkpoint.steps,
    };
    const evidence = values.find((v) => v?.results)?.results ?? [];
    const checks = {
      enoughEvidence: evidence.length >= capability.evaluation.minEvidence,
      citationsValid: true,
    };
    s.validateEvidence(evidence, host, true);
    const state = checks.enoughEvidence ? "completed" : "needs-review";
    const payload = {
      ...output,
      checks,
      context: values.find((v) => v?.notes) ?? null,
      model: "active-host",
      synthesis:
        "Evidence brief; ask the active assistant to synthesize only from supplied evidence.",
      eventBasis: parsed.eventEvidence.length
        ? "cited-source"
        : "user-supplied; not verified live",
    };
    atomic(
      s.path(`executions/${id}.md`),
      payload.markdown ?? JSON.stringify(payload, null, 2),
    );
    s.exec(
      "UPDATE executions SET state=?,output=?,completed_at=? WHERE id=?",
      state,
      JSON.stringify(payload),
      now(),
      id,
    );
    s.log("execution.finished", { id, state, policyDigest });
    return { id, state, output: payload };
  } catch (e) {
    s.exec(
      "UPDATE executions SET state=?,error=? WHERE id=?",
      "failed",
      (e as Error).message,
      id,
    );
    throw e;
  }
}
export async function evaluate(
  s: Store,
  capabilityId: string,
  cases: any[],
  host: Host,
) {
  if (!Array.isArray(cases) || !cases.length)
    throw Error("Provide at least one evaluation case");
  const c = s.capability(capabilityId),
    results = [];
  for (const test of cases) {
    if (
      !Array.isArray(test.expectedSourceIds) ||
      !test.expectedSourceIds.length
    )
      throw Error("Each case requires expectedSourceIds");
    const result = await run(s, capabilityId, test.input, host, {
      evaluate: true,
    });
    if (result.state === "awaiting-approval")
      throw Error(
        "Evaluation requires an isolated test workspace whose policy permits local drafting. No approval was bypassed.",
      );
    const actual = result.output.evidence?.map((e: any) => e.sourceId) ?? [];
    results.push({
      name: test.name ?? "case",
      executionId: result.id,
      passed:
        result.state === "completed" &&
        test.expectedSourceIds.every((id: string) => actual.includes(id)),
      expectedSourceIds: test.expectedSourceIds,
      actualSourceIds: actual,
    });
  }
  const id = uid("evaluation"),
    passed = results.every((r) => r.passed),
    digest = sha(JSON.stringify(c));
  s.exec(
    "INSERT INTO evaluations VALUES(?,?,?,?,?,?)",
    id,
    c.id,
    digest,
    Number(passed),
    JSON.stringify(results),
    now(),
  );
  return {
    id,
    passed,
    results,
    semanticReview: "Human claim-support review remains required",
  };
}
export function activate(s: Store, id: string) {
  const c = s.capability(id),
    digest = sha(JSON.stringify(c));
  assertCapabilityTools(c);
  if (
    !s.one(
      "SELECT id FROM evaluations WHERE capability=? AND digest=? AND passed=1",
      id,
      digest,
    )
  )
    throw Error("No passing evaluation for this exact capability");
  c.state = "active";
  writeYaml(s.path(`capabilities/${id}.yaml`), c);
  return c;
}
