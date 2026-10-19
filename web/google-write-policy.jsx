import React, { useState, useEffect } from "react";
export function GoogleWritePolicy({ api }) {
  const [policy, setPolicy] = useState(null),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api("google-policy")
      .then(setPolicy)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section aria-label="External action policy">
      <h4>Reviewed external actions</h4>
      <p>{policy?.explanation}</p>
      <p>Current mode: {policy?.mode || "Unknown"}</p>
      {error && <p role="alert">{error}</p>}
      <label>
        <input
          type="checkbox"
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
        />
        I reviewed this policy change. Keep exact-action approvals and connector
        scope checks.
      </label>
      <button
        type="button"
        disabled={!policy || !confirm}
        onClick={async () => {
          try {
            setPolicy(
              await api("google-policy/review", {
                mode: policy.mode === "deny" ? "approve" : "deny",
                expectedDigest: policy.digest,
                confirm: true,
              }),
            );
            setConfirm(false);
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        {policy?.mode === "deny"
          ? "Enable reviewed external actions"
          : "Disable external writes"}
      </button>
    </section>
  );
}
