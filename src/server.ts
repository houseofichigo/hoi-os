import { startIndexMaintenance } from "./index-maintenance.js";
import { stopAI, startAutomaticAnalysis } from "./ai.js";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { z } from "zod";
import { APP_POST_ROUTES } from "./app-operations.js";
import { getChat } from "./chat.js";
import { createEngineSession } from "./engine.js";
import { atomic, safePath } from "./files.js";
import { receiveUpload } from "./hub.js";
import { ENGINE_API_VERSION, executeOperation } from "./operations.js";
import type { Host } from "./schema.js";
import { Store } from "./store.js";
import { startSync } from "./sync.js";

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
  const engine = options.app ? await createEngineSession(s) : undefined;
  const token = randomBytes(32).toString("hex");
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'self'; base-uri 'none'",
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
      if (options.app && pathname.startsWith("/api/engine/")) {
        const caller = engine!.authenticate(
          (req.headers.authorization || "").replace(/^Bearer /, ""),
        );
        if (!caller) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: "ENGINE_AUTH_REQUIRED" }));
          return;
        }
        s.assertHost(caller);
        if (pathname === "/api/engine/status" && req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(engine!.status()));
          return;
        }
        if (pathname !== "/api/engine/call" || req.method !== "POST")
          throw Error("OPERATION_UNKNOWN");
        const body = z
          .object({
            apiVersion: z.literal(ENGINE_API_VERSION),
            requestId: z.string(),
            operation: z.unknown(),
          })
          .strict()
          .parse(await readBody(req));
        const result = await engine!.execute(
          caller,
          body.operation,
          body.requestId,
        );
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ apiVersion: ENGINE_API_VERSION, result }));
        return;
      }
      const mutation =
        options.app &&
        req.method === "POST" &&
        (APP_POST_ROUTES.has(pathname) ||
          /^\/api\/hub\/upload\/upload_[a-f0-9]+$/.test(pathname));
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
        if (options.app && pathname.startsWith("/api/chat/stream/")) {
          const id = pathname.split("/").pop()!;
          getChat(s, id, host);
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            Connection: "keep-alive",
          });
          let version = -1;
          const started = Date.now();
          let timer: ReturnType<typeof setInterval>;
          const send = () => {
            try {
              const r = getChat(s, id, host);
              if (r.version !== version) {
                version = r.version;
                res.write(`data: ${JSON.stringify(r)}\n\n`);
              }
              if (
                r.state !== "awaiting-assistant" ||
                Date.now() - started > 600000
              ) {
                clearInterval(timer);
                res.end();
              }
            } catch {
              res.write(
                `data: ${JSON.stringify({ error: "Chat context changed or became unavailable. Start a new chat." })}\n\n`,
              );
              clearInterval(timer);
              res.end();
            }
          };
          timer = setInterval(send, 1000);
          res.on("close", () => clearInterval(timer));
          send();
          return;
        }
        if (mutation && pathname.startsWith("/api/hub/upload/")) {
          const result = await engine!.enqueue(() =>
            receiveUpload(s, pathname.split("/").pop()!, host, req),
          );
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
          return;
        }
        let result: any;
        if (mutation) {
          const body = await readBody(req);
          result = await engine!.execute(
            host,
            { command: "app-action", args: [pathname], input: body },
            String(req.headers["x-hoi-request-id"] || randomUUID()),
          );
        } else if (!pathname.startsWith("/api/original/")) {
          result = await (pathname === "/api/intake/jobs"
            ? executeOperation(s, host, { command: "jobs", args: ["list"] })
            : engine
              ? engine.enqueue(() =>
                  executeOperation(s, host, {
                    command: "app-read",
                    input: { pathname, query: url.search, app: true },
                  }),
                )
              : executeOperation(s, host, {
                  command: "app-read",
                  input: { pathname, query: url.search, app: false },
                }));
        } else if (pathname.startsWith("/api/original/")) {
          const id = pathname.split("/").pop(),
            source = s.one("SELECT * FROM sources WHERE id=?", id);
          if (
            !source ||
            !s.allowed(
              source,
              host,
              options.app && url.searchParams.get("history") === "1",
            )
          )
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
      res.writeHead(
        (e as Error).message === "OPERATION_UNKNOWN"
          ? 404
          : (e as Error).message.startsWith("STALE_VERSION")
            ? 409
            : 403,
        { "Content-Type": "application/json" },
      );
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
  });
  try {
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
  } catch (e) {
    await engine?.stop();
    throw e;
  }
  const stopAnalysis = options.app
    ? startAutomaticAnalysis(s, host, (fn) => engine!.enqueue(fn))
    : () => {};
  const stopSync = options.app
    ? startSync(s, host, (fn) => engine!.enqueue(fn))
    : () => {};
  const stopIndex = options.app
    ? startIndexMaintenance(s, host, (fn) => engine!.enqueue(fn))
    : () => {};
  const close = server.close.bind(server);
  let closing = false;
  server.close = ((callback?: (error?: Error) => void) => {
    if (closing) {
      if (callback) server.once("close", callback);
      return server;
    }
    closing = true;
    stopSync();
    stopAnalysis();
    stopIndex();
    // Close sockets only after durable work finishes; keep ownership until then.
    void stopAI(s)
      .then(() => engine?.stop())
      .then(() => {
        close(callback);
        server.closeIdleConnections();
      });
    return server;
  }) as typeof server.close;
  server.on("close", stopSync);
  const address = server.address() as any;
  engine?.publish(address.port);
  const reader = s.path(`.hoi/readers/${process.pid}-${address.port}`);
  atomic(reader, options.app ? "app server" : "map server");
  server.on("close", () => rmSync(reader, { force: true }));
  return {
    server,
    token,
    url: `http://127.0.0.1:${address.port}/${options.app ? "app" : ""}#${token}`,
  };
}
