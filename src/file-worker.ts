import { parentPort } from "node:worker_threads";
import { readFileSync, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { extract } from "./extract.js";
import { parseCsv } from "./csv.js";
import { atomic, sha } from "./files.js";
parentPort!.on("message", async (data) => {
  try {
    if (data.mode === "model-checksum") {
      const hash = createHash("sha256");
      let size = 0;
      for await (const chunk of createReadStream(data.path)) {
        size += chunk.length;
        if (size > 512 * 1024 * 1024) throw Error("MODEL_TOO_LARGE");
        hash.update(chunk);
      }
      parentPort!.postMessage({ checksum: hash.digest("hex"), size });
      return;
    }
    if (data.mode === "extract") {
      parentPort!.postMessage({
        passages: await extract(data.path),
        rows: data.path.toLowerCase().endsWith(".csv")
          ? parseCsv(readFileSync(data.path, "utf8"))
          : [],
      });
      return;
    }
    const bytes = readFileSync(data.path);
    if (bytes.length > 50 * 1024 * 1024) throw Error("FILE_TOO_LARGE");
    const checksum = sha(bytes);
    if (data.destination) atomic(data.destination, bytes);
    parentPort!.postMessage({ checksum });
  } catch (e) {
    parentPort!.postMessage({
      error: (e as Error).message,
      code: (e as NodeJS.ErrnoException).code,
    });
  }
});
