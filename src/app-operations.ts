import {indexStatus,configureSemantic,installLocalModel,rebuildKnowledge} from "./semantic.js";
import { memoryList, memoryGet, memoryHistory, proposeMemory, reviewVersionedMemory } from "./reviewed-memory.js";
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
  wikiSubjects,
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
import { basename } from "node:path";
import { readFileSync } from "node:fs";
import {
  savedViews,
  saveViews,
  preferences,
  savePreferences,
  processingRequests,
  prepareProcessing,
  completeProcessing,
} from "./daily-workspace.js";
import { intakeJobs, controlIntakeJob } from "./intake.js";
import { updateAdapters } from "./adapters.js";
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
  listChatRuns,
  submitChat,
} from "./chat.js";
import { configuration, security } from "./configuration.js";
import { dailyView, prepareDailyMeeting } from "./daily.js";
import { graph } from "./graph.js";
import {
  changeSource,
  hubSources,
  sourceDetail,
  planUpload,
  reviewSource,
  scanSources,
  sourceHistory,
  sourceImpact,
  sourceReviews,
  uploadJobs,
} from "./hub.js";
import { retrieve } from "./intake.js";
import { connect, reviewMemory } from "./knowledge.js";
import {
  listKnowledgeReviews,
  proposeKnowledge,
  replacementChoices,
  reviewKnowledge,
  scanKnowledge,
} from "./maintenance.js";
import type { Host } from "./schema.js";
import { Store } from "./store.js";
import {
  assistantQueue,
  connections,
  controlConnection,
  createConnection,
  oauthStart,
  previewConnection,
  reviewQueue,
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
  assignIntake,
  decisions,
  importWork,
  intakeList,
  listMentions,
  prepareExtraction,
  resolveMention,
  submitExtraction,
  undoDecision,
} from "./work-intake.js";
import {
  dashboard,
  recordHistory,
  records,
  reviewEmail,
  saveRecord,
} from "./workspace.js";

export const APP_POST_ROUTES = new Set([
  "/api/onboarding/save",
  "/api/onboarding/backup",
  "/api/google-policy/review",
  "/api/email-actions/propose",
  "/api/email-actions/review",
  "/api/email-actions/execute",
  "/api/ai/analysis-preview",
  "/api/ai/analysis-configure",
  "/api/ai/configure",
  "/api/ai/test",
  "/api/ai/run",
  "/api/ai/cancel",
  "/api/adapters/update",
  "/api/intake/jobs/control",
  "/api/hub/plan",
  "/api/hub/source",
  "/api/hub/scan",
  "/api/hub/review",
  "/api/records/save",
  "/api/views/save",
  "/api/preferences/save",
  "/api/processing/prepare",
  "/api/processing/complete",
  "/api/dashboard",
  "/api/email/review",
  "/api/sync/create",
  "/api/sync/oauth",
  "/api/sync/preview",
  "/api/sync/control",
  "/api/sync/run",
  "/api/sync/review",

  "/api/calendar/propose",
  "/api/calendar/review",
  "/api/calendar/execute",
  "/api/skills/preview",
  "/api/skills/commit",
  "/api/skills/draft",
  "/api/skills/control",
  "/api/skills/sync-preview",
  "/api/skills/sync",
  "/api/chat/begin",
  "/api/chat/send",
  "/api/conversations/create",
  "/api/conversations/update",
  "/api/conversations/append",
  "/api/chat/submit",
  "/api/chat/cancel",
  "/api/chat/propose",
  "/api/knowledge/scan",
  "/api/knowledge/review",
  "/api/knowledge/propose",
  "/api/daily/view",
  "/api/daily/meeting",
  "/api/intake/transcript-preview",
  "/api/intake/transcript-commit",
  "/api/intake/import",
  "/api/intake/assign",
  "/api/intake/prepare",
  "/api/intake/submit",
  "/api/intake/resolve",
  "/api/intake/undo",
  "/api/projects/create",
  "/api/tasks/propose",
  "/api/tasks/review",
  "/api/tasks/update",
  "/api/tasks/assign",
  "/api/wiki-core/save",
  "/api/wiki-core/publish",
  "/api/wiki-core/restore",
  "/api/wiki-core/primary",
  "/api/wiki-core/taxonomy",
  "/api/wiki-core/tag-merge",
  "/api/wiki/propose",
  "/api/wiki/review",
  "/api/wiki/canonical",
  "/api/memory/review",
  "/api/memory/propose",
  "/api/memory/history",
  "/api/knowledge/configure-search",
  "/api/knowledge/install-model",
  "/api/knowledge/rebuild",
]);

export async function appMutation(
  s: Store,
  host: Host,
  pathname: string,
  body: any,
) {
  if (!APP_POST_ROUTES.has(pathname)) throw Error("OPERATION_UNKNOWN");
  let result: any;
  if (pathname === "/api/onboarding/save")
    result = saveOnboarding(s, body, host);
  else if (pathname === "/api/onboarding/backup")
    result = onboardingBackup(s, host);
  else if (pathname === "/api/wiki-core/save")
    result = saveWikiDraft(s, body, host);
  else if (pathname === "/api/wiki-core/publish")
    result = publishWiki(s, body, host);
  else if (pathname === "/api/wiki-core/restore")
    result = restoreWikiDraft(s, body, host);
  else if (pathname === "/api/wiki-core/primary")
    result = assignPrimary(s, body, host);
  else if (pathname === "/api/wiki-core/tag-merge")
    result = mergeWikiTag(s, body, host);
  else if (pathname === "/api/wiki-core/taxonomy")
    result = updateTaxonomy(s, body, host);
  else if (pathname === "/api/ai/analysis-preview")
    result = analysisPreview(s, body, host);
  else if (pathname === "/api/ai/analysis-configure")
    result = configureAnalysis(s, body, host);
  else if (pathname === "/api/google-policy/review")
    result = reviewGooglePolicy(s, body, host);
  else if (pathname === "/api/email-actions/propose")
    result = proposeEmail(s, body, host);
  else if (pathname === "/api/email-actions/review")
    result = reviewEmailAction(s, body, host);
  else if (pathname === "/api/email-actions/execute")
    result = await executeEmailAction(s, body.id, host);
  else if (pathname === "/api/ai/configure")
    result = await configureAI(s, body, host);
  else if (pathname === "/api/ai/test") result = await testAI(s, body, host);
  else if (pathname === "/api/ai/run") result = startAI(s, body, host);
  else if (pathname === "/api/ai/cancel") result = cancelAI(s, body.id, host);
  else if (pathname === "/api/intake/jobs/control")
    result = await controlIntakeJob(s, host, body.id, body.action);
  else if (pathname === "/api/adapters/update")
    result = updateAdapters(s, host, body);
  else if (pathname === "/api/hub/plan") result = planUpload(s, body, host);
  else if (pathname === "/api/hub/source") result = changeSource(s, body, host);
  else if (pathname === "/api/hub/scan") result = scanSources(s, host);
  else if (pathname === "/api/hub/review") result = reviewSource(s, body, host);
  else if (pathname === "/api/records/save") result = saveRecord(s, body, host);
  else if (pathname === "/api/views/save") result = saveViews(s, host, body);
  else if (pathname === "/api/preferences/save")
    result = savePreferences(s, host, body);
  else if (pathname === "/api/processing/prepare")
    result = prepareProcessing(s, host, body);
  else if (pathname === "/api/processing/complete")
    result = completeProcessing(s, host, body);
  else if (pathname === "/api/dashboard") result = dashboard(s, host, body);
  else if (pathname === "/api/email/review")
    result = reviewEmail(s, body, host);
  else if (pathname === "/api/sync/create")
    result = createConnection(s, body, host);
  else if (pathname === "/api/sync/oauth")
    result = await oauthStart(s, body.id, body.credentials, host);
  else if (pathname === "/api/sync/preview")
    result = await previewConnection(s, body.id, host);
  else if (pathname === "/api/sync/control")
    result = await controlConnection(s, body, host);
  else if (pathname === "/api/sync/review") result = reviewQueue(s, body, host);
  else if (pathname === "/api/sync/run")
    result = await syncConnection(s, body.id, host);
  else if (pathname === "/api/calendar/propose")
    result = proposeCalendar(s, body, host);
  else if (pathname === "/api/calendar/review")
    result = reviewCalendar(s, body, host);
  else if (pathname === "/api/calendar/execute")
    result = await executeCalendar(s, body.id, host);
  else if (pathname === "/api/chat/send")
    result = await sendChat(s, body, host);
  else if (pathname === "/api/conversations/create")
    result = createConversation(s, body, host);
  else if (pathname === "/api/conversations/update")
    result = updateConversation(s, body, host);
  else if (pathname === "/api/conversations/append")
    result = appendConversation(s, body, host);
  else if (pathname === "/api/skills/preview")
    result = await previewSkill(s, body, host);
  else if (pathname === "/api/skills/commit")
    result = commitSkill(s, body, host);
  else if (pathname === "/api/skills/draft") result = draftSkill(s, body, host);
  else if (pathname === "/api/skills/control")
    result = controlSkill(s, body, host);
  else if (pathname === "/api/skills/sync-preview")
    result = previewSkillSync(s, body, host);
  else if (pathname === "/api/skills/sync") result = syncSkill(s, body, host);
  else if (pathname === "/api/chat/begin") result = beginChat(s, body, host);
  else if (pathname === "/api/chat/submit")
    result = submitChat(
      s,
      body.runId,
      body.expectedVersion,
      body.response,
      host,
    );
  else if (pathname === "/api/chat/cancel")
    result = cancelChat(s, body.runId, host);
  else if (pathname === "/api/chat/propose")
    result = acceptChatProposal(
      s,
      body.runId,
      body.expectedVersion,
      host,
      body.task,
    );
  else if (pathname === "/api/knowledge/scan") result = scanKnowledge(s, host);
  else if (pathname === "/api/knowledge/review")
    result = reviewKnowledge(s, body, host);
  else if (pathname === "/api/knowledge/propose")
    result = proposeKnowledge(s, body, host);
  else if (pathname === "/api/daily/view") result = dailyView(s, body, host);
  else if (pathname === "/api/daily/meeting")
    result = prepareDailyMeeting(s, String(body.id), host);
  else if (pathname === "/api/intake/assign")
    result = assignIntake(s, body, host);
  else if (pathname === "/api/intake/transcript-preview")
    result = previewTranscript(s, body, host);
  else if (pathname === "/api/intake/transcript-commit")
    result = commitTranscript(s, body, host);
  else if (pathname === "/api/intake/import")
    result = await importWork(s, body, host);
  else if (pathname === "/api/intake/prepare")
    result = prepareExtraction(s, String(body.id), host);
  else if (pathname === "/api/intake/submit")
    result = submitExtraction(s, body, host);
  else if (pathname === "/api/intake/resolve")
    result = resolveMention(s, body, host);
  else if (pathname === "/api/intake/undo")
    result = undoDecision(s, String(body.id), host);
  else if (pathname === "/api/projects/create")
    result = createProject(s, body, host);
  else if (pathname === "/api/tasks/propose")
    result = createProposal(s, body, host);
  else if (pathname === "/api/tasks/review")
    result = reviewProposal(s, body, host);
  else if (pathname === "/api/tasks/assign") result = assignTask(s, body, host);
  else if (pathname === "/api/tasks/update") result = updateTask(s, body, host);
  else if (pathname === "/api/wiki/propose")
    result = proposeWiki(s, body, host);
  else if (pathname === "/api/wiki/review")
    result = reviewWiki(s, String(body.id), body.state, host);
  else if (pathname === "/api/wiki/canonical")
    result = canonicalWiki(s, String(body.id), host);
  else if (pathname === "/api/knowledge/configure-search") result=configureSemantic(s,host,body);
  else if (pathname === "/api/knowledge/install-model") result=await installLocalModel(s,host,body);
  else if (pathname === "/api/knowledge/rebuild") result=await rebuildKnowledge(s,host,body);
  else if (pathname === "/api/memory/propose") result = proposeMemory(s,body,host);
  else if (pathname === "/api/memory/history") result = memoryHistory(s,String(body.id),host);
  else result = s.schemaVersion>=19 ? reviewVersionedMemory(s,body,host) : reviewMemory(s, String(body.id), body.state, host);

  return result;
}
export function appRead(
  s: Store,
  host: Host,
  pathname: string,
  query: string,
  app: boolean,
) {
  const options = { app },
    url = new URL("http://127.0.0.1" + pathname + query);
  let result: any;
  if (options.app && pathname === "/api/onboarding")
    result = onboarding(s, host);
  else if (pathname === "/api/knowledge/index-status") result=indexStatus(s,host);
  else if (pathname === "/api/wiki-core") result = wikiLibrary(s, host);
  else if (pathname === "/api/wiki-core/subjects")
    result = wikiSubjects(s, host);
  else if (pathname === "/api/wiki-core/templates") result = wikiTemplates;
  else if (pathname === "/api/wiki-core/taxonomy") result = taxonomy(s, host);
  else if (pathname === "/api/wiki-core/search")
    result = searchWiki(s, url.searchParams.get("q") ?? "", host);
  else if (pathname.startsWith("/api/wiki-core/")) {
    const [, , , action, id] = pathname.split("/");
    result =
      action === "node"
        ? resolveWikiNode(s, id, host)
        : action === "compare"
          ? compareWiki(s, id, host)
          : action === "history"
            ? wikiHistory(s, id, host)
            : action === "backlinks"
              ? wikiBacklinks(s, id, host)
              : wikiDetail(s, id, host);
  } else if (options.app && pathname === "/api/hub/sources")
    result = hubSources(s, host);
  else if (options.app && pathname === "/api/intake/jobs")
    result = intakeJobs(s, host);
  else if (options.app && pathname === "/api/hub/jobs")
    result = uploadJobs(s, host);
  else if (options.app && pathname === "/api/hub/reviews")
    result = sourceReviews(s, host);
  else if (options.app && pathname.startsWith("/api/hub/history/"))
    result = sourceHistory(s, pathname.split("/").pop()!, host);
  else if (options.app && pathname.startsWith("/api/hub/impact/"))
    result = sourceImpact(s, pathname.split("/").pop()!, host);
  else if (options.app && pathname.startsWith("/api/records/history/"))
    result = recordHistory(s, pathname.split("/").pop()!, host);
  else if (options.app && pathname.startsWith("/api/records/"))
    result = records(s, pathname.split("/").pop() as any, host);
  else if (
    options.app &&
    /^\/api\/views\/(client|project|training)$/.test(pathname)
  )
    result = savedViews(s, host, pathname.split("/").pop());
  else if (options.app && pathname === "/api/preferences")
    result = preferences(s, host);
  else if (options.app && pathname === "/api/processing")
    result = processingRequests(s, host);
  else if (options.app && pathname === "/api/sync")
    result = connections(s, host);
  else if (options.app && pathname === "/api/sync/queue")
    result = assistantQueue(s, host);
  else if (options.app && pathname === "/api/configuration")
    result = configuration(s, host);
  else if (options.app && pathname === "/api/security")
    result = security(s, host);
  else if (options.app && pathname === "/api/activity")
    result = activity(s, host, Object.fromEntries(url.searchParams));
  else if (options.app && pathname.startsWith("/api/activity/"))
    result = activityDetail(s, host, decodeURIComponent(pathname.slice(14)));
  else if (options.app && pathname === "/api/suggestions")
    result = suggestions(s, host, Object.fromEntries(url.searchParams));
  else if (options.app && pathname.startsWith("/api/suggestions/"))
    result = suggestionDetail(s, host, decodeURIComponent(pathname.slice(17)));
  else if (options.app && pathname.startsWith("/api/chat/results/"))
    result = turnResults(s, pathname.split("/").pop()!, host);
  else if (options.app && pathname === "/api/conversations")
    result = listConversations(s, host);
  else if (options.app && pathname.startsWith("/api/conversations/"))
    result = getConversation(s, pathname.split("/").pop()!, host);
  else if (options.app && pathname.startsWith("/api/chat/evidence/"))
    result = chatEvidence(s, pathname.split("/").pop()!, host);
  else if (options.app && pathname === "/api/skills")
    result = listSkills(s, host);
  else if (options.app && pathname.startsWith("/api/skills/"))
    result = skillDetail(s, pathname.split("/").pop()!, host);
  else if (options.app && pathname === "/api/chat/runs")
    result = listChatRuns(s, host);
  else if (options.app && pathname === "/api/calendar")
    result = listCalendarActions(s, host);
  else if (options.app && pathname === "/api/chat/status")
    result = chatStatus();
  else if (options.app && pathname.startsWith("/api/chat/run/"))
    result = getChat(s, pathname.split("/").pop()!, host);
  else if (options.app && pathname === "/api/knowledge")
    result = listKnowledgeReviews(s, host);
  else if (options.app && pathname === "/api/knowledge/replacements")
    result = replacementChoices(s, host);
  else if (options.app && pathname === "/api/inbox/email-candidates")
    result = emailCandidates(s, host);
  else if (options.app && pathname.startsWith("/api/inbox/item/"))
    result = intakeDetail(s, pathname.split("/").pop()!, host);
  else if (options.app && pathname === "/api/google-policy")
    result = googlePolicyPreview(s, host);
  else if (options.app && pathname === "/api/email-actions")
    result = emailActions(s, host);
  else if (options.app && pathname === "/api/ai/status")
    result = aiStatus(s, host);
  else if (options.app && pathname.startsWith("/api/ai/job/"))
    result = aiJob(s, pathname.split("/").pop()!, host);
  else if (options.app && pathname === "/api/inbox")
    result = intakeList(s, host);
  else if (options.app && pathname === "/api/intake")
    result = intakeList(s, host);
  else if (options.app && pathname === "/api/intake/mentions")
    result = listMentions(s, host);
  else if (options.app && pathname === "/api/intake/decisions")
    result = decisions(s, host);
  else if (options.app && pathname === "/api/projects")
    result = listProjects(s, host);
  else if (options.app && pathname.startsWith("/api/projects/"))
    result = getProject(s, pathname.split("/")[3], host);
  else if (options.app && pathname === "/api/tasks/proposals")
    result = listProposals(s, host);
  else if (options.app && pathname === "/api/tasks")
    result = listTasks(s, host);
  else if (options.app && /^\/api\/tasks\/[^/]+\/history$/.test(pathname))
    result = taskHistory(s, pathname.split("/")[3], host);
  else if (options.app && /^\/api\/tasks\/[^/]+$/.test(pathname))
    result = getTask(s, pathname.split("/")[3], host);
  else if (pathname === "/api/graph") result = graph(s, host);
  else if (pathname === "/api/wiki") result = listWiki(s, host);
  else if (pathname.startsWith("/api/wiki/"))
    result = getWiki(s, pathname.split("/").pop() ?? "", host);
  else if (options.app && pathname === "/api/workspace")
    result = {
      schemaVersion: s.schemaVersion,
      displayName: basename(s.root),
      environment:
        JSON.parse(readFileSync(s.path(".hoi/workspace.json"), "utf8"))
          .environment === "demo"
          ? "demo"
          : "private",
      host,
      counts: {
        sources: s
          .all("SELECT * FROM sources")
          .filter((r) => s.allowed(r, host)).length,
        entities: graph(s, host).nodes.filter((n: any) => n.type !== "source")
          .length,
        memories: s
          .memories()
          .filter(
            (m) =>
              m.allowedHosts?.includes(host) &&
              s.evidenceVisible(m.evidence || [], host, false),
          ).length,
        wikiPages: s.schemaVersion >= 2 ? listWiki(s, host).length : 0,
      },
    };
  else if (options.app && pathname === "/api/retrieve")
    result = retrieve(s, url.searchParams.get("q") ?? "", host, {
      limit: 8,
    });
  else if (options.app && pathname === "/api/memory")
    result = s.schemaVersion>=19 ? (url.searchParams.get("view")==="history" ? memoryList(s,host,"history") : [...memoryList(s,host,"current"),...memoryList(s,host,"proposed")]) : s
      .memories()
      .filter(
        (m) =>
          m.allowedHosts?.includes(host) &&
          s.evidenceVisible(m.evidence || [], host, false),
      )
      .map((m) => ({
        id: m.id,
        type: m.type,
        content: m.content,
        state: m.state,
        createdAt: m.createdAt,
        durability: m.durability,
        stale: !s.evidenceVisible(m.evidence ?? [], host),
        evidence: m.evidence ?? [],
      }));
  else if (options.app && pathname === "/api/connections") result = connect(s);
  else if (options.app && pathname === "/api/sources")
    result = s
      .all(
        "SELECT s.*,r.status extraction_status FROM sources s LEFT JOIN revisions r ON r.id=s.current_revision",
      )
      .filter((r) => s.allowed(r, host))
      .map((r) => {
        const m = JSON.parse(r.metadata);
        return {
          id: r.id,
          title: r.title,
          documentType: m.documentType,
          authority: m.authority,
          status: m.status,
          effectiveDate: m.effectiveDate,
          client: m.client,
          extractionStatus: r.extraction_status,
          sourceKey: r.source_key,
          lastChecked: r.last_checked,
        };
      });
  else if (options.app && pathname === "/api/contradictions")
    result = wikiContradictions(s, host);
  else if (options.app && pathname.startsWith("/api/hub/source/"))
    result = sourceDetail(s, pathname.split("/").pop()!, host);
  else if (pathname.startsWith("/api/passage/")) {
    const id = pathname.split("/").pop();
    const p = s.one(
      "SELECT p.*,s.id source_id,s.title,s.metadata FROM passages p JOIN revisions r ON r.id=p.revision_id JOIN sources s ON s.id=r.source_id WHERE p.id=?",
      id,
    );
    if (
      !p ||
      !s.allowed(
        { id: p.source_id, metadata: p.metadata },
        host,
        options.app && url.searchParams.get("history") === "1",
      )
    )
      throw Error("Passage unavailable");
    result = {
      id: p.id,
      revisionId: p.revision_id,
      sourceId: p.source_id,
      title: p.title,
      location: p.location,
      text: p.text,
    };
  } else throw Error("OPERATION_UNKNOWN");
  return result;
}
