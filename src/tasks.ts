import { z } from "zod";
import { Store } from "./store.js";
import { uid, now } from "./files.js";
import { type Host } from "./schema.js";
import {
  projectInput,
  proposalInput,
  reviewInput,
  updateInput,
} from "./task-schema.js";
function access(s: Store, h: Host, mutation = false, reviewFlow = false) {
  s.assertSchema(3, "Projects and tasks");
  s.assertHost(h);
  if (mutation && s.policy().actions.draft === "deny")
    throw Error("Local task changes denied by policy");
  if (mutation && !reviewFlow && s.policy().actions.draft === "approve")
    throw Error(
      "Policy requires a review flow; direct project/status changes are unavailable",
    );
}
function projectVisible(s: Store, p: any, h: Host) {
  if (s.schemaVersion >= 9) {
    const row = s.one("SELECT payload FROM workspace_records WHERE id=?", p.id);
    if (row) {
      const v = JSON.parse(row.payload);
      if (
        !v.allowedHosts.includes(h) ||
        !s.evidenceVisible(v.evidence, h, false)
      )
        return false;
      for (const key of v.clientIds || []) {
        const c = s.one(
          "SELECT payload FROM workspace_records WHERE id=?",
          key,
        );
        if (!c) return false;
        const value = JSON.parse(c.payload);
        if (
          !value.allowedHosts.includes(h) ||
          !s.evidenceVisible(value.evidence, h, false)
        )
          return false;
      }
    }
  }

  const e = s.one(
    "SELECT * FROM entities WHERE id=? AND type='project'",
    p.entity_id,
  );
  return !!e && JSON.parse(e.allowed_hosts).includes(h);
}
export function listProjects(s: Store, h: Host) {
  access(s, h);
  return s
    .all(
      "SELECT p.*,e.name FROM projects p JOIN entities e ON e.id=p.entity_id ORDER BY e.name",
    )
    .filter((p) => projectVisible(s, p, h));
}
export function getProject(s: Store, id: string, h: Host) {
  const p = listProjects(s, h).find((p) => p.id === id);
  if (!p) throw Error("Project unavailable");
  return p;
}
export function createProject(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  const v = projectInput.parse(input);
  return s.tx(() => {
    const entity = s.one(
      "SELECT * FROM entities WHERE id=? AND type='project'",
      v.entityId,
    );
    if (!entity || !JSON.parse(entity.allowed_hosts).includes(h))
      throw Error("Project entity unavailable");
    const prior = s.one("SELECT * FROM projects WHERE entity_id=?", v.entityId);
    if (prior) {
      if (prior.objective !== v.objective || prior.owner !== v.owner)
        throw Error("Project already exists with different details");
      return getProject(s, prior.id, h);
    }
    const id = uid("project");
    s.exec(
      "INSERT INTO projects VALUES(?,?,?,?,?)",
      id,
      v.entityId,
      v.objective,
      v.owner,
      now(),
    );
    s.log("project.created", { id });
    return getProject(s, id, h);
  });
}
function evidence(s: Store, id: string) {
  return s.all(
    "SELECT revision_id revisionId,passage_id passageId,quote FROM task_evidence WHERE proposal_id=? ORDER BY rowid",
    id,
  );
}
function visible(s: Store, row: any, h: Host) {
  const p = JSON.parse(row.payload);
  return (
    p.allowedHosts.includes(h) &&
    (s.schemaVersion < 4 ||
      s
        .all(
          "SELECT payload FROM intake_decisions WHERE target_id=?",
          row.proposal_id ?? row.id,
        )
        .every((d) => {
          const history = JSON.parse(d.payload);
          return s.evidenceVisible(history.evidence, h, false);
        })) &&
    ((!p.task.projectId && s.schemaVersion >= 16) ||
      listProjects(s, h).some((x) => x.id === p.task.projectId)) &&
    s.evidenceVisible(evidence(s, row.proposal_id ?? row.id), h, false)
  );
}
function proposal(s: Store, row: any, h: Host) {
  const refs = evidence(s, row.id);
  return {
    id: row.id,
    ...JSON.parse(row.payload),
    state: row.state,
    version: row.version,
    taskId: row.task_id,
    evidence: refs,
    evidenceCurrent: s.evidenceVisible(refs, h, true),
  };
}
export function listProposals(s: Store, h: Host) {
  access(s, h);
  return s
    .all("SELECT * FROM task_proposals ORDER BY created_at,id")
    .filter((r) => visible(s, r, h))
    .map((r) => proposal(s, r, h));
}
export function createProposal(s: Store, input: unknown, h: Host) {
  access(s, h, true, true);
  const v = proposalInput.parse(input);
  if (!v.allowedHosts.includes(h))
    throw Error("Proposal excludes current host");
  return s.tx(() => {
    if (v.task.projectId) getProject(s, v.task.projectId, h);
    else s.assertSchema(16, "Standalone tasks");
    s.validateEvidence(v.evidence, h, true);
    const prior = s.one(
      "SELECT * FROM task_proposals WHERE request_key=?",
      v.key,
    );
    const payload = JSON.stringify(v);
    if (prior) {
      if (!visible(s, prior, h) || prior.payload !== payload)
        throw Error("Proposal key conflict");
      return proposal(s, prior, h);
    }
    const id = uid("proposal");
    s.exec(
      "INSERT INTO task_proposals VALUES(?,?,?,?,?,?,?)",
      id,
      v.key,
      payload,
      "proposed",
      1,
      null,
      now(),
    );
    for (const e of v.evidence)
      s.exec(
        "INSERT OR IGNORE INTO task_evidence VALUES(?,?,?,?)",
        id,
        e.revisionId,
        e.passageId,
        e.quote,
      );
    s.log("task.proposed", { id });
    return proposal(s, s.one("SELECT * FROM task_proposals WHERE id=?", id), h);
  });
}
export function reviewProposal(s: Store, input: unknown, h: Host) {
  access(s, h, true, true);
  const v = reviewInput.parse(input);
  return s.tx(() => {
    const row = s.one("SELECT * FROM task_proposals WHERE id=?", v.id);
    if (!row || !visible(s, row, h)) throw Error("Proposal unavailable");
    // Only the exact original review may be replayed; a competing decision fails.
    if (row.state !== "proposed") {
      if (row.state === v.decision && row.version === v.expectedVersion + 1)
        return proposal(s, row, h);
      throw Error("STALE_VERSION: Proposal already reviewed");
    }
    if (row.version !== v.expectedVersion)
      throw Error("STALE_VERSION: Reload proposal");
    let taskId = null;
    if (v.decision === "approved") {
      s.validateEvidence(evidence(s, row.id), h, true);
      taskId = uid("task");
      const p = JSON.parse(row.payload),
        at = now();
      s.exec(
        "INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?)",
        taskId,
        p.task.projectId,
        row.id,
        row.payload,
        "open",
        1,
        at,
        at,
      );
      s.exec(
        "INSERT INTO task_history VALUES(?,?,?,?,?,?)",
        uid("history"),
        taskId,
        1,
        JSON.stringify({
          type: "approved",
          status: "open",
          proposalId: row.id,
        }),
        h,
        at,
      );
    }
    s.exec(
      "UPDATE task_proposals SET state=?,version=version+1,task_id=? WHERE id=?",
      v.decision,
      taskId,
      row.id,
    );
    s.log("task.reviewed", { id: row.id, decision: v.decision, taskId });
    return proposal(
      s,
      s.one("SELECT * FROM task_proposals WHERE id=?", row.id),
      h,
    );
  });
}
function task(s: Store, r: any, h: Host) {
  const refs = evidence(s, r.proposal_id);
  return {
    id: r.id,
    ...JSON.parse(r.payload).task,
    status: r.status,
    version: r.version,
    proposalId: r.proposal_id,
    evidence: refs,
    evidenceCurrent: s.evidenceVisible(refs, h, true),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
export function listTasks(s: Store, h: Host) {
  access(s, h);
  return s
    .all("SELECT * FROM tasks ORDER BY created_at,id")
    .filter((r) => visible(s, r, h))
    .map((r) => task(s, r, h));
}
export function getTask(s: Store, id: string, h: Host) {
  access(s, h);
  const r = s.one("SELECT * FROM tasks WHERE id=?", id);
  if (!r || !visible(s, r, h)) throw Error("Task unavailable");
  return task(s, r, h);
}
export function taskHistory(s: Store, id: string, h: Host) {
  getTask(s, id, h);
  return s
    .all("SELECT * FROM task_history WHERE task_id=? ORDER BY version", id)
    .map((r) => ({ ...r, event: JSON.parse(r.event) }));
}
export function updateTask(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  const v = updateInput.parse(input);
  return s.tx(() => {
    const t = getTask(s, v.id, h);
    if (t.version !== v.expectedVersion)
      throw Error("STALE_VERSION: Reload task");
    if (t.status === v.status) return t;
    const at = now();
    s.exec(
      "UPDATE tasks SET status=?,version=version+1,updated_at=? WHERE id=?",
      v.status,
      at,
      t.id,
    );
    s.exec(
      "INSERT INTO task_history VALUES(?,?,?,?,?,?)",
      uid("history"),
      t.id,
      t.version + 1,
      JSON.stringify({ type: "status", from: t.status, to: v.status }),
      h,
      at,
    );
    s.log("task.updated", { id: t.id, version: t.version + 1 });
    return getTask(s, t.id, h);
  });
}

export function assignTask(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  s.assertSchema(16, "Standalone tasks");
  const v = z
    .object({
      id: z.string(),
      expectedVersion: z.number().int().positive(),
      projectId: z.string().nullable(),
    })
    .strict()
    .parse(input);
  return s.tx(() => {
    const t = getTask(s, v.id, h);
    if (t.version !== v.expectedVersion)
      throw Error("STALE_VERSION: Reload task");
    if (v.projectId) getProject(s, v.projectId, h);
    if (t.projectId === v.projectId) return t;
    const row = s.one("SELECT * FROM tasks WHERE id=?", t.id),
      payload = JSON.parse(row.payload);
    payload.task.projectId = v.projectId;
    s.exec(
      "UPDATE tasks SET project_id=?,payload=?,version=version+1,updated_at=? WHERE id=?",
      v.projectId,
      JSON.stringify(payload),
      now(),
      t.id,
    );
    s.exec(
      "INSERT INTO task_history VALUES(?,?,?,?,?,?)",
      uid("history"),
      t.id,
      t.version + 1,
      JSON.stringify({
        type: "project-assignment",
        from: t.projectId,
        to: v.projectId,
      }),
      h,
      now(),
    );
    return getTask(s, t.id, h);
  });
}
