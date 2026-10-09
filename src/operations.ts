import {
  prepareSemanticQuery,
  indexStatus,
  configureSemantic,
  installLocalModel,
  rebuildKnowledge,
} from "./semantic.js";
import {
  memoryList,
  memoryGet,
  memoryHistory,
  proposeMemory,
  reviewVersionedMemory,
} from "./reviewed-memory.js";
import { knowledgeSearch, knowledgeEvidence } from "./retrieval.js";
import {
  activity,
  activityDetail,
  suggestions,
  suggestionDetail,
  turnResults,
} from "./activity.js";
import { sendChat } from "./chat-send.js";
import { onboarding, saveOnboarding, onboardingBackup } from "./onboarding.js";
import { previewTranscript, commitTranscript } from "./transcripts.js";
import {
  googlePolicyPreview,
  reviewGooglePolicy,
  emailActions,
  proposeEmail,
  reviewEmailAction,
  executeEmailAction,
} from "./google-actions.js";
import {
  analysisPreview,
  configureAnalysis,
  waitAI,
  aiStatus,
  configureAI,
  testAI,
  startAI,
  aiJob,
  cancelAI,
} from "./ai.js";
import { intakeDetail } from "./work-intake.js";
import { emailCandidates } from "./workspace.js";
import {
  mergeWikiTag,
  wikiTemplates,
  wikiLibrary,
  wikiDetail,
  saveWikiDraft,
  compareWiki,
  publishWiki,
  wikiHistory,
  restoreWikiDraft,
  assignPrimary,
  resolveWikiNode,
  wikiBacklinks,
  taxonomy,
  updateTaxonomy,
  searchWiki,
} from "./wiki-core.js";
import {
  listSkills,
  skillDetail,
  previewSkill,
  commitSkill,
  draftSkill,
  controlSkill,
  previewSkillSync,
  syncSkill,
} from "./skill-library.js";
import {
  savedViews,
  saveViews,
  preferences,
  savePreferences,
  processingRequests,
  prepareProcessing,
  completeProcessing,
} from "./daily-workspace.js";
import { entityMerges, mergeEntity } from "./entity-merge.js";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { APP_POST_ROUTES, appMutation, appRead } from "./app-operations.js";
import { backup } from "./backup.js";
import { importConnection } from "./bridge.js";
import {
  executeCalendar,
  listCalendarActions,
  proposeCalendar,
  reviewCalendar,
} from "./calendar.js";
import {
  acceptChatProposal,
  beginChat,
  cancelChat,
  chatStatus,
  createConversation,
  getConversation,
  listConversations,
  updateConversation,
  appendConversation,
  chatEvidence,
  getChat,
  submitChat,
} from "./chat.js";
import { configuration, security } from "./configuration.js";
import { dailyView, prepareDailyMeeting } from "./daily.js";
import { diagnostics, health, supportReport } from "./diagnostics.js";
import {
  changeSource,
  hubSources,
  sourceDetail,
  reviewSource,
  scanSources,
  sourceImpact,
} from "./hub.js";
import {
  ingest,
  planIngest,
  retrieve,
  intakeJobs,
  controlIntakeJob,
} from "./intake.js";
import {
  capture,
  connect,
  consolidate,
  context,
  entity,
  onboard,
  relationship,
  reviewMemory,
} from "./knowledge.js";
import {
  knowledgeDates,
  listKnowledgeReviews,
  proposeKnowledge,
  replacementChoices,
  reviewKnowledge,
  scanKnowledge,
} from "./maintenance.js";
import { ocr } from "./ocr.js";
import { applyOrganization, approve, organize } from "./organize.js";
import { CURRENT_SCHEMA_VERSION, Store, migrate } from "./store.js";
import { queryData } from "./structured.js";
import {
  connections,
  controlConnection,
  createConnection,
  previewConnection,
  syncConnection,
} from "./sync.js";
import {
  createProject,
  createProposal,
  getProject,
  getTask,
  listProjects,
  listProposals,
  listTasks,
  reviewProposal,
  taskHistory,
  updateTask,
  assignTask,
} from "./tasks.js";
import {
  canonicalWiki,
  getWiki,
  listWiki,
  proposeWiki,
  reviewWiki,
  wikiContradictions,
} from "./wiki.js";
import {
  decisions,
  importWork,
  intakeList,
  listMentions,
  prepareExtraction,
  resolveMention,
  submitExtraction,
  undoDecision,
} from "./work-intake.js";
import { activate, evaluate, run, saveCapability } from "./workflow.js";
import { dashboard, records, saveRecord } from "./workspace.js";

import { z } from "zod";
import { atomic } from "./files.js";
import type { Host } from "./schema.js";
import { ENGINE_API_VERSION } from "./protocol.js";
export { ENGINE_API_VERSION } from "./protocol.js";
import { adapterStatus, updateAdapters } from "./adapters.js";
const optionSchema = z
  .object({
    client: z.string().optional(),
    project: z.string().optional(),
    limit: z.string().optional(),
    resume: z.string().optional(),
    approval: z.string().optional(),
    hash: z.string().optional(),
    state: z.string().optional(),
    output: z.string().optional(),
    column: z.string().optional(),
    operation: z.string().optional(),
    language: z.string().optional(),
    "source-id": z.string().optional(),
    "source-key": z.string().optional(),
    "plan-hash": z.string().optional(),
    "max-files": z.string().optional(),
    "max-bytes": z.string().optional(),
    latest: z.boolean().optional(),
    apply: z.boolean().optional(),
    activate: z.boolean().optional(),
    metadata: z.boolean().optional(),
  })
  .strict();
export const operationInput = z
  .object({
    command: z.string().min(1).max(64),
    args: z.array(z.string().max(8192)).max(32).default([]),
    options: optionSchema.default({}),
    input: z.unknown().optional(),
    metadata: z.unknown().optional(),
  })
  .strict();
export type OperationInput = z.infer<typeof operationInput>;
const json: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(json),
    z.record(json),
  ]),
);
export const operationOutput = json;
const subcommands: Record<string, string[]> = {
  skills: [
    "",
    "list",
    "get",
    "preview",
    "commit",
    "draft",
    "control",
    "sync-preview",
    "sync",
  ],
  activity: ["", "list", "get"],
  suggestions: ["", "list", "get"],
  "google-policy": ["", "review"],
  "email-actions": ["", "list", "propose", "review", "execute"],
  ai: [
    "",
    "status",
    "job",
    "configure",
    "test",
    "run",
    "cancel",
    "analysis-preview",
    "analysis-configure",
  ],
  inbox: ["", "get", "email-candidates"],
  views: ["client", "project", "training", "save"],
  preferences: ["", "get", "save"],
  processing: ["", "list", "prepare", "complete"],
  "entity-merge": ["", "list", "review"],
  jobs: ["", "list", "resume", "cancel"],
  adapter: ["", "status", "install", "remove"],
  engine: ["", "status", "operations"],
  calendar: ["", "list", "propose", "review", "execute"],
  records: ["client", "project", "training", "save"],
  source: ["", "list", "get", "impact", "change", "scan", "review"],
  sync: ["", "list", "create", "preview", "control", "run"],
  chat: [
    "results",
    "send",
    "",
    "status",
    "begin",
    "get",
    "cancel",
    "submit",
    "propose",
    "conversations",
    "conversation",
    "create",
    "update",
    "append",
    "evidence",
  ],
  memory: ["list", "get", "history", "propose", "review", "retire"],
  knowledge: [
    "",
    "index-status",
    "configure-search",
    "install-model",
    "rebuild",
    "search",
    "evidence",
    "dates",
    "list",
    "scan",
    "review",
    "propose",
    "replacements",
  ],
  daily: ["", "view", "meeting"],
  intake: [
    "transcript-preview",
    "transcript-commit",
    "",
    "list",
    "import",
    "prepare",
    "submit",
    "mentions",
    "resolve",
    "undo",
    "decisions",
  ],
  project: ["", "list", "create", "get"],
  task: [
    "assign",
    "",
    "list",
    "propose",
    "proposals",
    "review",
    "update",
    "get",
    "history",
  ],
  wiki: [
    "",
    "list",
    "get",
    "propose",
    "review",
    "canonical",
    "contradictions",
    "pages",
    "page",
    "save",
    "compare",
    "publish",
    "history",
    "restore",
    "primary",
    "node",
    "taxonomy",
    "tag",
    "tag-merge",
    "search",
    "templates",
    "backlinks",
  ],
};
const commands = new Set(
  "memory activity suggestions google-policy email-actions ai inbox skills views preferences processing entity-merge jobs adapter engine app-action app-read calendar security configuration dashboard records source sync chat knowledge daily intake project task health doctor audit diagnostics ocr onboard context connect import-connection ingest-plan ingest retrieve query-data entity relate capture review-memory consolidate organize approve build-capability run evaluate reindex backup upgrade wiki".split(
    " ",
  ),
);
const reads = new Set(
  "memory:list memory:get memory:history activity: activity:list activity:get suggestions: suggestions:list suggestions:get chat:results onboard:status google-policy: email-actions: email-actions:list ai: ai:status ai:job inbox: inbox:get inbox:email-candidates skills: skills:list skills:get views:client views:project views:training preferences: preferences:get processing: processing:list entity-merge: entity-merge:list jobs: jobs:list adapter: adapter:status engine: engine:status engine:operations app-read security configuration dashboard health doctor audit diagnostics context ingest-plan retrieve query-data consolidate calendar:list calendar: records:client records:project records:training source: source:list source:get source:impact sync: sync:list chat: chat:status chat:get chat:conversations chat:conversation chat:evidence knowledge:index-status knowledge:search knowledge:evidence knowledge:dates knowledge: knowledge:list knowledge:replacements daily: daily:view intake: intake:list intake:mentions intake:decisions project: project:list project:get task: task:list task:proposals task:get task:history wiki: wiki:list wiki:get wiki:contradictions wiki:pages wiki:page wiki:compare wiki:history wiki:node wiki:taxonomy wiki:search wiki:templates wiki:backlinks".split(
    " ",
  ),
);
export function operationInfo(raw: unknown) {
  const r = operationInput.parse(raw),
    sub = r.args[0] || "";
  if (
    !commands.has(r.command) ||
    (subcommands[r.command] && !subcommands[r.command].includes(sub))
  )
    throw Error("OPERATION_UNKNOWN");
  if (r.command === "app-action" && !APP_POST_ROUTES.has(sub))
    throw Error("OPERATION_UNKNOWN");
  const key = subcommands[r.command] ? r.command + ":" + sub : r.command;
  const appReadAction =
    r.command === "app-action" &&
    ["/api/dashboard", "/api/daily/view"].includes(sub);
  const read =
    (reads.has(key) ||
      appReadAction ||
      (r.command === "onboard" && sub === "status")) &&
    !(r.command === "diagnostics" && r.options.output);
  const action =
    (["calendar", "email-actions"].includes(r.command) && sub === "execute") ||
    (r.command === "app-action" &&
      ["/api/calendar/execute", "/api/email-actions/execute"].includes(sub))
      ? "external"
      : read
        ? "read"
        : "draft";
  return {
    name: r.command === "app-action" ? sub : key,
    action,
    requiredPermission: action,
    idempotency: read ? "read-only" : "request-receipt",
    inputSchema:
      (r.command === "chat" && sub === "send") ||
      (r.command === "app-action" && sub === "/api/chat/send")
        ? "ChatSend/v1 (strict sendInput)"
        : "OperationInput/v1 plus domain validation",
    outputSchema: "JSON/v1",
    exclusive: r.command === "upgrade",
  };
}
export function operationCatalog() {
  return [...commands]
    .filter((c) => !c.startsWith("app-"))
    .sort()
    .flatMap((command) =>
      (subcommands[command] || [""]).map((sub) =>
        operationInfo({ command, args: sub ? [sub] : [] }),
      ),
    );
}
export async function executeOperation(s: Store, host: Host, raw: unknown) {
  const request = operationInput.parse(raw);
  const info = operationInfo(request);
  s.assertHost(host);
  if (info.action === "draft" && s.policy().actions.draft === "deny")
    throw Error("POLICY_DENIED: Local mutations disabled");
  const result = await dispatch(s, host, request);
  return operationOutput.parse(JSON.parse(JSON.stringify(result ?? null)));
}
async function dispatch(s: Store, host: Host, request: OperationInput) {
  const command = request.command,
    p = [command, ...request.args],
    v = request.options;
  const input = () => {
    if (request.input === undefined) throw Error("--input file is required");
    return request.input;
  };
  let result: any;
  switch (command) {
    case "entity-merge":
      result =
        p[1] === "review"
          ? mergeEntity(s, host, input())
          : entityMerges(s, host);
      break;
    case "jobs":
      result =
        !p[1] || p[1] === "list"
          ? intakeJobs(s, host)
          : await controlIntakeJob(s, host, p[2], p[1]);
      break;
    case "adapter":
      result =
        !p[1] || p[1] === "status"
          ? adapterStatus(s)
          : updateAdapters(s, host, {
              action: p[1],
              hosts: p[2] === "both" ? ["codex", "claude"] : [p[2]],
            });
      break;
    case "engine":
      result = {
        apiVersion: ENGINE_API_VERSION,
        schemaVersion: s.schemaVersion,
        operations: operationCatalog(),
      };
      break;
    case "app-action":
      result = await appMutation(s, host, p[1], input());
      break;
    case "app-read": {
      const r = z
        .object({
          pathname: z.string().startsWith("/api/"),
          query: z.string(),
          app: z.boolean(),
        })
        .strict()
        .parse(input());
      result = appRead(s, host, r.pathname, r.query, r.app);
      break;
    }
    case "calendar":
      if (p[1] === "propose") result = proposeCalendar(s, input(), host);
      else if (p[1] === "review") result = reviewCalendar(s, input(), host);
      else if (p[1] === "execute")
        result = await executeCalendar(s, p[2], host);
      else result = listCalendarActions(s, host);
      break;
    case "security":
      result = security(s, host);
      break;
    case "configuration":
      result = configuration(s, host);
      break;
    case "views":
      result =
        p[1] === "save"
          ? saveViews(s, host, input())
          : savedViews(s, host, p[1]);
      break;
    case "preferences":
      result =
        p[1] === "save"
          ? savePreferences(s, host, input())
          : preferences(s, host);
      break;
    case "processing":
      result =
        p[1] === "prepare"
          ? prepareProcessing(s, host, input())
          : p[1] === "complete"
            ? completeProcessing(s, host, input())
            : processingRequests(s, host);
      break;
    case "dashboard":
      result = dashboard(s, host, input());
      break;
    case "records":
      result =
        p[1] === "save"
          ? saveRecord(s, input(), host)
          : records(s, p[1] as any, host);
      break;
    case "source":
      result =
        p[1] === "get"
          ? sourceDetail(s, p[2], host)
          : p[1] === "impact"
            ? sourceImpact(s, p[2], host)
            : p[1] === "change"
              ? changeSource(s, input(), host)
              : p[1] === "scan"
                ? scanSources(s, host)
                : p[1] === "review"
                  ? reviewSource(s, input(), host)
                  : hubSources(s, host);
      break;
    case "sync":
      result =
        p[1] === "create"
          ? createConnection(s, input(), host)
          : p[1] === "preview"
            ? await previewConnection(s, p[2], host)
            : p[1] === "control"
              ? await controlConnection(s, input(), host)
              : p[1] === "run"
                ? await syncConnection(s, p[2], host)
                : connections(s, host);
      break;
    case "skills":
      result =
        p[1] === "get"
          ? skillDetail(s, p[2], host)
          : p[1] === "preview"
            ? await previewSkill(s, input(), host)
            : p[1] === "commit"
              ? commitSkill(s, input(), host)
              : p[1] === "draft"
                ? draftSkill(s, input(), host)
                : p[1] === "control"
                  ? controlSkill(s, input(), host)
                  : p[1] === "sync-preview"
                    ? previewSkillSync(s, input(), host)
                    : p[1] === "sync"
                      ? syncSkill(s, input(), host)
                      : listSkills(s, host);
      break;
    case "activity":
      result =
        p[1] === "get"
          ? activityDetail(s, host, p[2])
          : activity(s, host, request.input ?? {});
      break;
    case "suggestions":
      result =
        p[1] === "get"
          ? suggestionDetail(s, host, p[2])
          : suggestions(s, host, request.input ?? {});
      break;
    case "chat":
      if (p[1] === "results") result = turnResults(s, p[2], host);
      else if (p[1] === "send") result = await sendChat(s, input(), host);
      else if (p[1] === "conversations") result = listConversations(s, host);
      else if (p[1] === "conversation") result = getConversation(s, p[2], host);
      else if (p[1] === "create") result = createConversation(s, input(), host);
      else if (p[1] === "update") result = updateConversation(s, input(), host);
      else if (p[1] === "append") result = appendConversation(s, input(), host);
      else if (p[1] === "evidence") result = chatEvidence(s, p[2], host);
      else if (p[1] === "begin") result = beginChat(s, input(), host);
      else if (p[1] === "get") result = getChat(s, p[2], host);
      else if (p[1] === "cancel") result = cancelChat(s, p[2], host);
      else if (p[1] === "submit") {
        const v = input() as any;
        result = submitChat(s, v.runId, v.expectedVersion, v.response, host);
      } else if (p[1] === "propose") {
        const v = input() as any;
        result = acceptChatProposal(
          s,
          v.runId,
          v.expectedVersion,
          host,
          v.task,
        );
      } else result = chatStatus();
      break;
    case "memory":
      if (p[1] === "list")
        result = memoryList(s, host, String(v.state ?? "current"));
      else if (p[1] === "get") result = memoryGet(s, p[2], host);
      else if (p[1] === "history") result = memoryHistory(s, p[2], host);
      else if (p[1] === "propose") result = proposeMemory(s, input(), host);
      else
        result = reviewVersionedMemory(
          s,
          p[1] === "retire"
            ? { ...(input() as any), state: "retired" }
            : input(),
          host,
        );
      break;
    case "knowledge":
      if (p[1] === "search") {
        const value = input() as any;
        if (!value.asOf)
          await prepareSemanticQuery(s, host, String(value.query ?? ""));
        result = knowledgeSearch(s, value, host);
      } else if (p[1] === "index-status") result = indexStatus(s, host);
      else if (p[1] === "configure-search")
        result = configureSemantic(s, host, input());
      else if (p[1] === "install-model")
        result = await installLocalModel(s, host, input());
      else if (p[1] === "rebuild")
        result = await rebuildKnowledge(s, host, input());
      else if (p[1] === "evidence")
        result = knowledgeEvidence(s, input(), host);
      else if (p[1] === "dates") result = knowledgeDates(s, host);
      else if (p[1] === "scan") result = scanKnowledge(s, host);
      else if (p[1] === "review") result = reviewKnowledge(s, input(), host);
      else if (p[1] === "propose") result = proposeKnowledge(s, input(), host);
      else if (p[1] === "replacements") result = replacementChoices(s, host);
      else result = listKnowledgeReviews(s, host);
      break;
    case "daily":
      result =
        p[1] === "meeting"
          ? prepareDailyMeeting(s, p[2], host)
          : dailyView(s, input(), host);
      break;
    case "intake":
      if (p[1] === "transcript-preview")
        result = previewTranscript(s, input(), host);
      else if (p[1] === "transcript-commit")
        result = commitTranscript(s, input(), host);
      else if (p[1] === "import") result = await importWork(s, input(), host);
      else if (p[1] === "prepare") result = prepareExtraction(s, p[2], host);
      else if (p[1] === "submit") result = submitExtraction(s, input(), host);
      else if (p[1] === "mentions") result = listMentions(s, host);
      else if (p[1] === "resolve") result = resolveMention(s, input(), host);
      else if (p[1] === "undo") result = undoDecision(s, p[2], host);
      else if (p[1] === "decisions") result = decisions(s, host);
      else if (!p[1] || p[1] === "list") result = intakeList(s, host);
      else throw Error("Unknown intake operation");
      break;
    case "project":
      if (p[1] === "create") result = createProject(s, input(), host);
      else if (p[1] === "get") result = getProject(s, p[2], host);
      else if (!p[1] || p[1] === "list") result = listProjects(s, host);
      else throw Error("Unknown project operation");
      break;
    case "google-policy":
      result =
        p[1] === "review"
          ? reviewGooglePolicy(s, input(), host)
          : googlePolicyPreview(s, host);
      break;
    case "email-actions":
      result =
        p[1] === "propose"
          ? proposeEmail(s, input(), host)
          : p[1] === "review"
            ? reviewEmailAction(s, input(), host)
            : p[1] === "execute"
              ? await executeEmailAction(s, String(p[2]), host)
              : emailActions(s, host);
      break;
    case "ai":
      if (p[1] === "analysis-preview")
        result = analysisPreview(s, input(), host);
      else if (p[1] === "analysis-configure")
        result = configureAnalysis(s, input(), host);
      else if (p[1] === "configure")
        result = await configureAI(s, input(), host);
      else if (p[1] === "test") result = await testAI(s, input(), host);
      else if (p[1] === "run") {
        const job = startAI(s, input(), host);
        result = await waitAI(s, job.id);
      } else if (p[1] === "cancel") result = cancelAI(s, String(p[2]), host);
      else if (p[1] === "job") result = aiJob(s, String(p[2]), host);
      else result = aiStatus(s, host);
      break;
    case "inbox":
      result =
        p[1] === "get"
          ? intakeDetail(s, String(p[2]), host)
          : p[1] === "email-candidates"
            ? emailCandidates(s, host)
            : intakeList(s, host);
      break;
    case "task":
      if (p[1] === "propose") result = createProposal(s, input(), host);
      else if (p[1] === "proposals") result = listProposals(s, host);
      else if (p[1] === "review") result = reviewProposal(s, input(), host);
      else if (p[1] === "update") result = updateTask(s, input(), host);
      else if (p[1] === "assign") result = assignTask(s, input(), host);
      else if (p[1] === "get") result = getTask(s, p[2], host);
      else if (p[1] === "history") result = taskHistory(s, p[2], host);
      else if (!p[1] || p[1] === "list") result = listTasks(s, host);
      else throw Error("Unknown task operation");
      break;
    case "health":
      result = health(s, host);
      break;
    case "doctor":
    case "audit": {
      const sources = s
        .all(
          "SELECT s.*,r.status,r.error FROM sources s LEFT JOIN revisions r ON r.id=s.current_revision",
        )
        .filter((x) => s.allowed(x, host));
      result = {
        diagnostics: diagnostics(s, host),
        schemaVersion: s.schemaVersion,
        node: process.version,
        integrity: s.one("PRAGMA integrity_check"),
        sources: sources.length,
        ready: sources.filter((r) => r.status === "ready").length,
        gaps: sources
          .filter((r) => r.status !== "ready")
          .map((r) => ({ sourceId: r.id, status: r.status, error: r.error })),
        memory: consolidate(s, host),
        connections: connect(s),
        release: "alpha; client acceptance pending",
        policyBoundary:
          "HOI commands only; host-native tools have independent permissions",
      };
      break;
    }
    case "diagnostics":
      result = supportReport(s, host);
      if (v.output) {
        const target = resolve(String(v.output));
        if (existsSync(target)) throw Error("Diagnostic output already exists");
        atomic(target, JSON.stringify(result, null, 2));
      }
      break;
    case "ocr":
      if (!p[1] || !v.output) throw Error("ocr requires an image and --output");
      result = ocr(p[1], String(v.output), String(v.language ?? "eng"));
      s.log("ocr.completed", { output: result.output });
      break;
    case "onboard":
      result =
        p[1] === "status"
          ? onboarding(s, host)
          : p[1] === "save"
            ? saveOnboarding(s, input(), host)
            : p[1] === "backup"
              ? onboardingBackup(s, host)
              : onboard(s, input() as any);
      break;
    case "context":
      result = context(s, host);
      break;
    case "connect":
      result = connect(s, request.input !== undefined ? input() : undefined);
      break;
    case "import-connection":
      result = await importConnection(s, input(), host);
      break;
    case "ingest-plan":
      if (!p[1]) throw Error("ingest-plan requires a file or directory");
      result = planIngest(s, p[1], {
        maxFiles: v["max-files"] ? Number(v["max-files"]) : undefined,
        maxBytes: v["max-bytes"] ? Number(v["max-bytes"]) : undefined,
      });
      break;
    case "ingest":
      if (!p[1]) throw Error("ingest requires a file or directory");
      result = await ingest(s, p[1], {
        host,
        metadata: v.metadata ? request.metadata : undefined,
        sourceId: v["source-id"] as string,
        sourceKey: v["source-key"] as string,
        planHash: v["plan-hash"] as string,
        maxFiles: v["max-files"] ? Number(v["max-files"]) : undefined,
        maxBytes: v["max-bytes"] ? Number(v["max-bytes"]) : undefined,
      });
      break;
    case "retrieve":
      await prepareSemanticQuery(s, host, p.slice(1).join(" "));
      result = retrieve(s, p.slice(1).join(" "), host, {
        client: v.client as string,
        project: v.project as string,
        sourceId: v["source-id"] as string,
        limit: v.limit ? Number(v.limit) : 8,
        latest: !!v.latest,
      });
      break;
    case "query-data":
      result = queryData(
        s,
        String(v["source-id"] ?? ""),
        String(v.column ?? ""),
        String(v.operation ?? "count"),
        host,
      );
      break;
    case "entity":
      result = entity(s, input());
      break;
    case "relate":
      result = relationship(s, input(), host);
      break;
    case "capture":
      result = capture(s, input(), host);
      break;
    case "review-memory":
      if (!p[1] || !["approved", "rejected"].includes(String(v.state)))
        throw Error(
          "review-memory requires an ID and --state approved|rejected",
        );
      result =
        s.schemaVersion >= 19
          ? reviewVersionedMemory(
              s,
              { ...(input() as any), id: p[1], state: v.state },
              host,
            )
          : reviewMemory(s, p[1], v.state as any, host);
      break;
    case "consolidate":
      result = consolidate(s, host);
      break;
    case "organize":
      result = v.apply
        ? applyOrganization(s, p[1], String(v.approval ?? ""), host)
        : organize(s, host);
      break;
    case "approve":
      if (!p[1] || !v.hash)
        throw Error("approve requires a plan ID and --hash");
      result = approve(s, p[1], String(v.hash));
      break;
    case "build-capability":
      result = v.activate ? activate(s, p[1]) : saveCapability(s, input());
      break;
    case "run":
      result = await run(s, p[1] ?? "meeting-prep", input(), host, {
        resume: v.resume as string,
        approval: v.approval as string,
      });
      break;
    case "evaluate":
      result = await evaluate(
        s,
        p[1] ?? "meeting-prep",
        input() as any[],
        host,
      );
      break;
    case "reindex":
      s.tx(() => {
        s.exec("DELETE FROM passage_search");
        s.exec(
          "INSERT INTO passage_search(text,passage_id) SELECT text,id FROM passages",
        );
      });
      result = {
        indexed: s.one("SELECT COUNT(*) count FROM passages").count,
      };
      break;
    case "backup":
      if (!p[1]) throw Error("backup requires a new destination directory");
      result = backup(s, p[1]);
      break;
    case "upgrade": {
      if (!p[1]) throw Error("upgrade requires a backup destination");
      const verified = backup(s, p[1]);
      if (s.schemaVersion < CURRENT_SCHEMA_VERSION) {
        mkdirSync(s.path("wiki"), { recursive: true, mode: 0o700 });
        migrate(s);
        result = {
          backup: verified,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          status: `Migrated schema ${s.schemaVersion} -> ${CURRENT_SCHEMA_VERSION} after verified backup.`,
        };
      } else
        result = {
          backup: verified,
          schemaVersion: s.schemaVersion,
          status:
            "Already at current schema; backup verified by checksum manifest.",
        };
      break;
    }
    case "wiki": {
      const sub = p[1] ?? "list";
      if (sub === "pages") result = wikiLibrary(s, host);
      else if (sub === "page") result = wikiDetail(s, p[2], host);
      else if (sub === "save") result = saveWikiDraft(s, input(), host);
      else if (sub === "publish") result = publishWiki(s, input(), host);
      else if (sub === "compare") result = compareWiki(s, p[2], host);
      else if (sub === "history") result = wikiHistory(s, p[2], host);
      else if (sub === "restore") result = restoreWikiDraft(s, input(), host);
      else if (sub === "primary") result = assignPrimary(s, input(), host);
      else if (sub === "node") result = resolveWikiNode(s, p[2], host);
      else if (sub === "backlinks") result = wikiBacklinks(s, p[2], host);
      else if (sub === "taxonomy") result = taxonomy(s, host);
      else if (sub === "tag-merge") result = mergeWikiTag(s, input(), host);
      else if (sub === "tag") result = updateTaxonomy(s, input(), host);
      else if (sub === "templates") result = wikiTemplates;
      else if (sub === "search")
        result = searchWiki(s, p.slice(2).join(" "), host);
      else if (sub === "list") result = listWiki(s, host);
      else if (sub === "get") {
        if (!p[2]) throw Error("wiki get requires a page ID or slug");
        result = getWiki(s, p[2], host);
      } else if (sub === "propose") result = proposeWiki(s, input(), host);
      else if (sub === "review") {
        if (!p[2] || !["reviewed", "rejected"].includes(String(v.state)))
          throw Error(
            "wiki review requires an ID and --state reviewed|rejected",
          );
        result = reviewWiki(s, p[2], v.state as any, host);
      } else if (sub === "canonical") {
        if (!p[2]) throw Error("wiki canonical requires a page ID");
        result = canonicalWiki(s, p[2], host);
      } else if (sub === "contradictions") result = wikiContradictions(s, host);
      else throw Error(`Unknown wiki subcommand: ${sub}`);
      break;
    }
    default:
      throw Error(`Unknown operation: ${command}`);
  }
  return result;
}
