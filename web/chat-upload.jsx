import React, { useState, useRef, useEffect } from "react";
export default function ChatUpload({
  api,
  token,
  projectEntity,
  onAttached,
  capacity = 10,
}) {
  const [files, setFiles] = useState([]),
    [manifest, setManifest] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [outcomes, setOutcomes] = useState({});
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );
  async function act(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      if (live.current) setError(e.message);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  async function preview() {
    if (!files.length || files.length > capacity)
      throw Error(
        `Select between 1 and ${capacity} files; a request supports ten documents.`,
      );
    const items = [];
    for (const f of files) {
      if (f.size > 50 * 1024 * 1024)
        throw Error(`${f.name}: maximum 50 MB per file`);
      const hash = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
      items.push({
        name: f.name,
        size: f.size,
        checksum: [...new Uint8Array(hash)]
          .map((x) => x.toString(16).padStart(2, "0"))
          .join(""),
      });
    }
    const result = await api("hub/plan", {
      files: items,
      project: projectEntity || null,
      client: null,
    });
    if (live.current) setManifest(result);
  }
  async function upload() {
    for (let i = 0; i < manifest.length; i++) {
      if (!live.current) return;
      const j = manifest[i];
      if (outcomes[j.id]) continue;
      const r = await fetch("/api/hub/upload/" + j.id, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/octet-stream",
        },
        body: files[i],
      });
      const result = await r.json();
      if (!r.ok)
        throw Error(
          result.error || `${j.name}: upload failed; retry the reviewed import`,
        );
      if (live.current) {
        setOutcomes((x) => ({
          ...x,
          [j.id]:
            result.status === "ready"
              ? "Indexed and attached"
              : "Preserved; extraction gap",
        }));
        await onAttached(result, () => live.current);
      }
    }
  }
  return (
    <section className="chat-upload" aria-label="Upload chat documents">
      <p>
        Attach a transcript, brief or document. Reviewed imports are saved in
        Knowledge Hub. 50 MB per file; up to {capacity} more documents. Text
        transcripts are supported; audio/video transcription is not configured.
      </p>
      <label>
        Files for chat
        <input
          type="file"
          multiple
          disabled={busy}
          onChange={(e) => {
            setFiles([...e.target.files]);
            setManifest(null);
            setOutcomes({});
            setError("");
          }}
        />
      </label>
      <p>{files.length} files selected</p>
      {error && <p role="alert">{error}</p>}
      {!manifest && (
        <button
          type="button"
          disabled={busy || !files.length || !capacity}
          onClick={() => act(preview)}
        >
          Review attachments
        </button>
      )}
      {manifest && (
        <>
          <ul>
            {manifest.map((j) => (
              <li key={j.id}>
                {j.name} · {j.size} bytes ·{" "}
                {j.duplicate ? "Existing content" : "New content"} ·{" "}
                {outcomes[j.id] || "Awaiting import"}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy || manifest.every((j) => outcomes[j.id])}
            onClick={() => act(upload)}
          >
            Import and attach reviewed files
          </button>
          <p role="status">
            {busy
              ? "Importing reviewed files…"
              : manifest.every((j) => outcomes[j.id])
                ? "Import finished. Only readable, active sources were attached."
                : ""}
          </p>
        </>
      )}
    </section>
  );
}
