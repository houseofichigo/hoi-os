import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync, rmSync } from "node:fs";
import { resolve, extname } from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { Store } from "./store.js";
import { graph } from "./graph.js";
import {
  listWiki,
  getWiki,
  proposeWiki,
  reviewWiki,
  canonicalWiki,
  wikiContradictions,
} from "./wiki.js";
import { retrieve } from "./intake.js";
import { connect, reviewMemory } from "./knowledge.js";
import { safePath, atomic } from "./files.js";
import type { Host } from "./schema.js";

const APP_POST_ROUTES = new Set([
  "/api/wiki/propose",
  "/api/wiki/review",
  "/api/wiki/canonical",
  "/api/memory/review",
]);

function readBody(req: any): Promise<any> {
  return new Promise((ok, bad) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 1_000_000) bad(Error("Request body too large"));
      else chunks.push(c);
    });
    req.on("end", () => {
      try {
        ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {});
      } catch {
        bad(Error("Invalid JSON body"));
      }
    });
    req.on("error", bad);
  });
}

export async function serve(
  s: Store,
  host: Host,
  webRoot: string,
  port = 4640,
  options: { app?: boolean } = {},
) {
  s.assertHost(host);
  const entry = options.app ? "app.html" : "index.html";
  if (!existsSync(resolve(webRoot, entry)))
    throw Error("Map not built. Run npm run build.");
  const token = randomBytes(32).toString("hex");
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    try {
      const address = server.address() as any,
        origin = `http://127.0.0.1:${address.port}`;
      if (
        req.headers.host !== `127.0.0.1:${address.port}` ||
        (req.headers.origin && req.headers.origin !== origin)
      )
        throw Error("Untrusted origin");
      const url = new URL(req.url ?? "/", origin),
        pathname = decodeURIComponent(url.pathname);
      const mutation =
        options.app && req.method === "POST" && APP_POST_ROUTES.has(pathname);
      if (req.method !== "GET" && !mutation) {
        res.writeHead(405);
        res.end(
          options.app
            ? "Unsupported mutation; only reviewable app actions are exposed."
            : "Read-only service",
        );
        return;
      }
      if (pathname.startsWith("/api/")) {
        const bearer = Buffer.from(
          (req.headers.authorization ?? "").replace(/^Bearer /, ""),
        );
        if (
          bearer.length !== token.length ||
          !timingSafeEqual(bearer, Buffer.from(token))
        ) {
          res.writeHead(401);
          res.end("Open the URL printed by the CLI.");
          return;
        }
        let result: any;
        if (mutation) {
          const body = await readBody(req);
          if (pathname === "/api/wiki/propose")
            result = proposeWiki(s, body, host);
          else if (pathname === "/api/wiki/review")
            result = reviewWiki(s, String(body.id), body.state, host);
          else if (pathname === "/api/wiki/canonical")
            result = canonicalWiki(s, String(body.id), host);
          else result = reviewMemory(s, String(body.id), body.state, host);
        } else if (pathname === "/api/graph") result = graph(s, host);
        else if (pathname === "/api/wiki") result = listWiki(s, host);
        else if (pathname.startsWith("/api/wiki/"))
          result = getWiki(s, pathname.split("/").pop() ?? "", host);
        else if (options.app && pathname === "/api/workspace")
          result = {
            schemaVersion: s.schemaVersion,
            host,
            counts: {
              sources: s.one("SELECT COUNT(*) c FROM sources").c,
              entities: s.one("SELECT COUNT(*) c FROM entities").c,
              memories: s
                .memories()
                .filter((m) => m.allowedHosts?.includes(host)).length,
              wikiPages:
                s.schemaVersion >= 2
                  ? s.one("SELECT COUNT(*) c FROM wiki_pages").c
                  : 0,
            },
          };
        else if (options.app && pathname === "/api/retrieve")
          result = retrieve(s, url.searchParams.get("q") ?? "", host, {
            limit: 8,
          });
        else if (options.app && pathname === "/api/memory")
          result = s
            .memories()
            .filter((m) => m.allowedHosts?.includes(host))
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
        else if (options.app && pathname === "/api/connections")
          result = connect(s);
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
        else if (pathname.startsWith("/api/passage/")) {
          const id = pathname.split("/").pop();
          const p = s.one(
            "SELECT p.*,s.id source_id,s.title,s.metadata FROM passages p JOIN revisions r ON r.id=p.revision_id JOIN sources s ON s.id=r.source_id WHERE p.id=?",
            id,
          );
          if (!p || !s.allowed({ id: p.source_id, metadata: p.metadata }, host))
            throw Error("Passage unavailable");
          result = {
            id: p.id,
            revisionId: p.revision_id,
            sourceId: p.source_id,
            title: p.title,
            location: p.location,
            text: p.text,
          };
        } else if (pathname.startsWith("/api/original/")) {
          const id = pathname.split("/").pop(),
            source = s.one("SELECT * FROM sources WHERE id=?", id);
          if (!source || !s.allowed(source, host))
            throw Error("Source unavailable");
          const r = s.one(
            "SELECT * FROM revisions WHERE source_id=? AND id=?",
            id,
            url.searchParams.get("revision") ?? source.current_revision,
          );
          if (!r) throw Error("Revision unavailable");
          res.setHeader("Content-Type", "application/octet-stream");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="original${extname(r.original_path).replace(/[^.a-z0-9]/gi, "")}"`,
          );
          res.end(readFileSync(s.path(r.original_path)));
          return;
        } else {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
        return;
      }
      const file = safePath(
        webRoot,
        pathname === "/"
          ? "index.html"
          : pathname === "/app"
            ? "app.html"
            : pathname.slice(1),
      );
      if (!existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const types: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".woff2": "font/woff2",
      };
      res.setHeader(
        "Content-Type",
        types[extname(file)] ?? "application/octet-stream",
      );
      res.end(readFileSync(file));
    } catch (e) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
  });
  await new Promise<void>((ok, bad) => {
    server.once("error", (error: NodeJS.ErrnoException) =>
      bad(
        error.code === "EADDRINUSE"
          ? Error(
              "PORT_IN_USE: Choose --port 0 for an available port, or another port. Leave unrelated services running.",
            )
          : error,
      ),
    );
    server.listen(port, "127.0.0.1", ok);
  });
  const address = server.address() as any;
  const reader = s.path(`.hoi/readers/${process.pid}-${address.port}`);
  atomic(reader, options.app ? "app server" : "map server");
  server.on("close", () => rmSync(reader, { force: true }));
  return {
    server,
    token,
    url: `http://127.0.0.1:${address.port}/${options.app ? "app" : ""}#${token}`,
  };
}
