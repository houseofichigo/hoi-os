import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdirSync,
  existsSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";
import { fixture } from "./helpers.mjs";
import { Store } from "../dist/core/store.js";
import { ingest, retrieve } from "../dist/core/intake.js";
import { serve } from "../dist/core/server.js";
import { queryData } from "../dist/core/structured.js";
import { entity } from "../dist/core/knowledge.js";
import { filterGraph } from "../web/filters.js";
import { backup, restore } from "../dist/core/backup.js";
import { writeYaml } from "../dist/core/files.js";

test("Office extraction keeps document locations and typed CSV refuses ambiguous totals", async (t) => {
  const { s, file } = fixture(t);
  const fixtures = [
    [
      "x.docx",
      "word/document.xml",
      "<w:document><w:body><w:p><w:r><w:t>Atlas agreement</w:t></w:r></w:p></w:body></w:document>",
      "Paragraph 1",
    ],
    [
      "x.pptx",
      "ppt/slides/slide1.xml",
      "<p:sld><a:t>Atlas slides</a:t></p:sld>",
      "Slide 1",
    ],
    [
      "x.xlsx",
      "xl/worksheets/sheet1.xml",
      '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Atlas workbook</t></is></c></row></sheetData></worksheet>',
      "sheet1 row 1",
    ],
  ];
  for (const [name, part, xml, location] of fixtures) {
    const zip = new JSZip();
    zip.file(part, xml);
    const result = await ingest(
      s,
      file(name, await zip.generateAsync({ type: "nodebuffer" })),
    );
    assert.equal(result.status, "ready");
    assert.equal(
      retrieve(s, "Atlas", "codex", { sourceId: result.sourceId }).results[0]
        .location,
      location,
    );
  }
  const csv = await ingest(
    s,
    file("amounts.csv", 'name,amount\r\n"Atlas, Inc",12.5\r\nOther,7.5\r\n'),
  );
  assert.equal(queryData(s, csv.sourceId, "amount", "sum", "codex").value, 20);
  const mixed = await ingest(
    s,
    file("mixed.csv", "name,amount\nA,EUR 10\nB,12\n"),
  );
  assert.throws(
    () => queryData(s, mixed.sourceId, "amount", "sum", "codex"),
    /numeric/,
  );
});
test("PDF text is extracted with page provenance; malformed PDF remains preserved", async (t) => {
  const { s, file } = fixture(t);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = "BT /F1 12 Tf 40 700 Td (Atlas PDF agreement) Tj ET";
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let pdf = "%PDF-1.4\n",
    offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n ")
    .join(
      "\n",
    )}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const result = await ingest(s, file("agreement.pdf", pdf));
  assert.equal(result.status, "ready", result.error);
  assert.equal(retrieve(s, "Atlas", "codex").results[0].location, "Page 1");
  assert.equal(
    (await ingest(s, file("broken.pdf", "bad pdf"))).status,
    "failed",
  );
});
test("localhost map API requires a token, rejects mutation and foreign origin, resolves exact source", async (t) => {
  const { s, file, root } = fixture(t);
  const source = await ingest(s, file("record.md", "Atlas verified passage"));
  const staticRoot = join(root, "web");
  mkdirSync(staticRoot);
  writeFileSync(join(staticRoot, "index.html"), "<html>test</html>");
  const app = await serve(s, "codex", staticRoot, 0);
  const base = app.url.split("/#")[0],
    headers = { Authorization: `Bearer ${app.token}` };
  try {
    assert.equal((await fetch(base + "/api/graph")).status, 401);
    assert.equal(
      (await fetch(base + "/api/graph", { method: "POST", headers })).status,
      405,
    );
    assert.equal(
      (
        await fetch(base + "/api/graph", {
          headers: { ...headers, Origin: "https://untrusted.invalid" },
        })
      ).status,
      403,
    );
    const g = await (await fetch(base + "/api/graph", { headers })).json();
    assert.ok(g.nodes.some((n) => n.id === source.sourceId));
    assert.equal(
      await (
        await fetch(base + "/api/original/" + source.sourceId, { headers })
      ).text(),
      "Atlas verified passage",
    );
    const e = retrieve(s, "Atlas", "codex").results[0];
    const p = await (
      await fetch(base + "/api/passage/" + e.passageId, { headers })
    ).json();
    assert.equal(p.revisionId, e.revisionId);
    const dest = join(root, "backup");
    backup(s, dest);
    assert.throws(() => restore(dest, s.root), /in use/);
  } finally {
    await new Promise((ok) => app.server.close(ok));
  }
});
test("fresh setup installs both host adapters and preserves unrelated manual text on rerun", (t) => {
  const root = mkdtempSync(join(tmpdir(), "hoi-setup-")),
    workspace = join(root, "private");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const args = [
    "scripts/setup.mjs",
    "--skip-build",
    "--non-interactive",
    "--workspace",
    workspace,
    "--hosts",
    "both",
  ];
  const a = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(a.status, 0, a.stderr);
  for (const dir of [".agents", ".claude"])
    assert.ok(existsSync(join(workspace, dir, "skills/hoi-retrieve/SKILL.md")));
  writeFileSync(
    join(workspace, "AGENTS.md"),
    "# My rules\nKeep these.\n" +
      readFileSync(join(workspace, "AGENTS.md"), "utf8"),
  );
  const b = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(b.status, 0, b.stderr);
  const manual = readFileSync(join(workspace, "AGENTS.md"), "utf8");
  assert.match(manual, /Keep these/);
  assert.equal(manual.split("HOI OS managed start").length, 2);
});
test("temporal, client, source, memory and neighborhood map views keep valid endpoints", () => {
  const data = {
    nodes: [
      { id: "c", type: "client", name: "Atlas", date: null },
      {
        id: "d",
        type: "document",
        name: "Plan",
        client: "c",
        date: "2026-03-01",
      },
      { id: "m", type: "memory", name: "Decision", date: "2026-04-01" },
    ],
    links: [
      { source: "d", target: "c", basis: "manual" },
      { source: "d", target: "m", basis: "supported" },
    ],
  };
  assert.equal(filterGraph(data, { scope: "c" }).nodes.length, 3);
  assert.equal(filterGraph(data, { view: "memory" }).nodes.length, 1);
  assert.equal(
    filterGraph(data, { cutoff: "2026-03-15", unknown: false }).nodes.length,
    1,
  );
  assert.equal(filterGraph(data, { focus: "c" }).nodes.length, 2);
  assert.equal(
    filterGraph(data, { source: "d", basis: "supported" }).links.length,
    1,
  );
  assert.equal(filterGraph(data, { query: "missing" }).nodes.length, 0);
});
test("1000-document synthetic benchmark: 60 labeled questions with top-five evidence", async (t) => {
  const { s, file } = fixture(t);
  const ids = [];
  for (let i = 0; i < 1000; i++) {
    const project = `project${String(i).padStart(4, "0")}`;
    const result = await ingest(
      s,
      file(
        `${project}.md`,
        `${project} acceptance owner is Person ${i}.\n\n${project} approved milestone is delivery stage ${i % 7}.`,
      ),
    );
    ids.push(result.sourceId);
  }
  let hits = 0;
  for (let i = 0; i < 60; i++) {
    const n = i * 13;
    const query = `project${String(n).padStart(4, "0")} acceptance owner`;
    if (
      retrieve(s, query, "codex", { limit: 5 }).results.some(
        (r) => r.sourceId === ids[n],
      )
    )
      hits++;
  }
  assert.ok(hits / 60 >= 0.9, `${hits}/60`);
  t.diagnostic(
    `Synthetic retrieval recall@5: ${hits}/60. This is not a real-client quality result.`,
  );
});
test("launcher serves authenticated workspace and reports occupied port without stopping it", async (t) => {
  const { spawn, spawnSync } = await import("node:child_process");
  const { s } = fixture(t);
  const child = spawn(
    process.execPath,
    [
      "scripts/start.mjs",
      "--workspace",
      s.root,
      "--host",
      "codex",
      "--port",
      "0",
      "--no-open",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  t.after(() => child.kill("SIGTERM"));
  const output = await new Promise((resolve, reject) => {
    let text = "";
    const timer = setTimeout(() => reject(Error("Launcher timed out")), 10000);
    child.stdout.on("data", (chunk) => {
      text += chunk;
      if (text.includes("http://")) {
        clearTimeout(timer);
        resolve(text);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(Error(`Launcher exited ${code}`));
    });
  });
  const url = output.match(/http:\/\/127\.0\.0\.1:\d+\/#\w+/)[0],
    parsed = new URL(url);
  assert.equal(
    (
      await fetch(parsed.origin + "/api/graph", {
        headers: { Authorization: `Bearer ${parsed.hash.slice(1)}` },
      })
    ).status,
    200,
  );
  const conflict = spawnSync(
    process.execPath,
    [
      "scripts/start.mjs",
      "--workspace",
      s.root,
      "--host",
      "codex",
      "--port",
      parsed.port,
      "--no-open",
    ],
    { encoding: "utf8" },
  );
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /PORT_IN_USE/);
  assert.equal((await fetch(parsed.origin)).status, 200);
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill("SIGTERM");
  });
});
