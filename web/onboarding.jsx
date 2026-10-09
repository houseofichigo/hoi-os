import React, { useEffect, useState } from "react";
import { navigate } from "./destination.js";
const labels = {
  profile: "Your workspace",
  preferences: "Time and working hours",
  assistant: "Optional assistant",
  sources: "Select sources",
  "first-result": "Try your first result",
  recovery: "Recovery and finish",
};
export function OnboardingPrompt({ api }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api("onboarding")
      .then(setData)
      .catch(() => {});
  }, []);
  if (!data || data.status === "complete") return null;
  return (
    <aside className="app-note">
      <strong>Make this workspace yours.</strong> Your setup progress is saved
      locally.{" "}
      <button onClick={() => navigate("configuration", "Onboarding")}>
        Continue setup
      </button>
    </aside>
  );
}
export default function Onboarding({ api }) {
  const [data, setData] = useState(null),
    [step, setStep] = useState("profile"),
    [form, setForm] = useState({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  function adopt(d) {
    setData(d);
    setForm({
      ...d.profile,
      timezone: d.preferences.version
        ? d.preferences.timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone,
      workStart: d.preferences.workStart || d.workStart,
      workEnd: d.preferences.workEnd || d.workEnd,
      assistant: d.assistant,
    });
  }
  useEffect(() => {
    api("onboarding")
      .then((d) => {
        adopt(d);
        setStep(
          d.steps.find(
            (x) => !d.completed.includes(x) && !d.skipped.includes(x),
          ) || "profile",
        );
      })
      .catch((e) => setError(e.message));
  }, []);
  async function save(skip = false, finish = false) {
    setBusy(true);
    setError("");
    try {
      const body = { expectedVersion: data.version, step, skip, finish };
      if (step === "profile") {
        body.profileHash = data.profileHash;
        body.profile = Object.fromEntries(
          ["name", "role", "organization", "goals"]
            .filter((k) => form[k] !== undefined)
            .map((k) => [k, form[k]]),
        );
      }
      if (step === "preferences")
        Object.assign(body, {
          timezone: form.timezone,
          workStart: form.workStart,
          workEnd: form.workEnd,
          preferencesVersion: data.preferences.version,
        });
      if (step === "assistant") body.assistant = form.assistant;
      adopt(await api("onboarding/save", body));
      setNotice(
        skip ? "Step skipped. You can return at any time." : "Progress saved.",
      );
      if (!finish)
        setStep(
          data.steps[
            Math.min(data.steps.indexOf(step) + 1, data.steps.length - 1)
          ],
        );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function backup() {
    setBusy(true);
    setError("");
    try {
      const r = await api("onboarding/backup", {});
      setNotice(
        `Backup verified (${r.files} files). Stored beside your private workspace.`,
      );
      adopt(await api("onboarding"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const field = (key, label, type = "text") => (
    <label>
      {label}
      <input
        type={type}
        value={form[key] || ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <section className="onboarding" aria-label="Workspace onboarding">
      <h2>Set up your workspace</h2>
      <p>
        Use HOI without skills, accounts or API keys. Optional steps can wait.
      </p>
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            onClick={() =>
              api("onboarding")
                .then(adopt)
                .catch((e) => setError(e.message))
            }
          >
            Reload saved setup
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!data ? (
        <p>Loading setup…</p>
      ) : (
        <>
          <nav aria-label="Setup steps">
            {data.steps.map((s) => (
              <button
                key={s}
                aria-current={step === s ? "step" : undefined}
                disabled={busy}
                onClick={() => {
                  setStep(s);
                  setNotice("");
                }}
              >
                {labels[s]}
                {data.completed.includes(s)
                  ? " ✓"
                  : data.skipped.includes(s)
                    ? " (skipped)"
                    : ""}
              </button>
            ))}
          </nav>
          <h3>{labels[step]}</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(false, step === "recovery");
            }}
          >
            {step === "profile" && (
              <>
                <p>
                  Existing values are preserved. Share only what you want in
                  this workspace.
                </p>
                {field("name", "Your name")}
                {field("organization", "Organization")}
                {field("role", "Role")}
                {field("goals", "First useful outcome")}
              </>
            )}
            {step === "preferences" && (
              <>
                {field("timezone", "Timezone (IANA name)")}
                {field("workStart", "Working day starts", "time")}
                {field("workEnd", "Working day ends", "time")}
                <p>
                  Confirm your timezone. Working hours become week-planning
                  defaults; you can adjust them for a particular week.
                </p>
              </>
            )}
            {step === "assistant" && (
              <>
                <label>
                  Preferred experience
                  <select
                    value={form.assistant}
                    onChange={(e) =>
                      setForm({ ...form, assistant: e.target.value })
                    }
                  >
                    <option value="none">No AI for now</option>
                    <option value="handoff">Codex / Claude handoff</option>
                    <option value="openai">OpenAI API</option>
                    <option value="anthropic">Anthropic API</option>
                  </select>
                </label>
                <p>
                  This records a preference only. API calls cost money and
                  disclose permitted content to the selected provider. Keys,
                  model, source permissions and limits require separate
                  configuration. The automatic-analysis budget is $25/month;
                  manual Chat has its own limit. Nothing is enabled here.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    navigate("configuration", "Assistant & search")
                  }
                >
                  Open assistant configuration
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate("configuration", "Skills & capabilities")
                  }
                >
                  Optional workspace adapters
                </button>
              </>
            )}
            {step === "sources" && (
              <>
                <p>
                  Choose a small folder or a few fictional files first. Review
                  the import manifest before ingestion; no sources are selected
                  automatically. Connections require their own scope review.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("knowledge", "Ingestion")}
                >
                  Open reviewed ingestion
                </button>
              </>
            )}
            {step === "first-result" && (
              <>
                <p>
                  Search an imported document and open the original passage.
                  Optionally review a proposed task in Inbox. Completing this
                  step records your acknowledgement; it does not certify
                  retrieval quality.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("knowledge", "Sources")}
                >
                  Browse sources and evidence
                </button>
                <button
                  type="button"
                  onClick={() => navigate("inbox", "Suggestions")}
                >
                  Review suggestions
                </button>
              </>
            )}
            {step === "recovery" && (
              <>
                <p>
                  Create a verified backup before importing valuable data.
                  Backup verification checks integrity; it is not a separate
                  restore rehearsal.
                </p>
                <p>
                  {data.backupRecorded
                    ? "A backup record exists. Create a fresh verified copy when needed."
                    : "No backup recorded yet."}
                </p>
                <button type="button" disabled={busy} onClick={backup}>
                  Create verified backup
                </button>
                <p>
                  Finish after reviewing or skipping each step. You can reopen
                  setup without resetting your workspace.
                </p>
              </>
            )}
            <div className="onboarding-actions">
              <button type="submit" disabled={busy}>
                {busy
                  ? "Saving…"
                  : step === "recovery"
                    ? "Save and finish"
                    : "Save and continue"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => save(true, step === "recovery")}
              >
                Skip for now
              </button>
            </div>
          </form>
          {data.status === "complete" && (
            <p role="status">
              Setup checklist complete. Skipped features remain unconfigured.
            </p>
          )}
        </>
      )}
    </section>
  );
}
