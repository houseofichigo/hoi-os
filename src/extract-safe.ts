import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { extname } from "node:path";
import { extract, type Extracted } from "./extract.js";
export async function extractSafe(path: string): Promise<Extracted[]> {
  if (
    ![".pdf", ".docx", ".pptx", ".xlsx"].includes(extname(path).toLowerCase())
  )
    return extract(path);
  return new Promise((resolve, reject) => {
    const child = fork(
      fileURLToPath(new URL("./extract-worker.js", import.meta.url)),
      [path],
      {
        execArgv: ["--max-old-space-size=256"],
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      },
    );
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      finish(Error("Extraction timed out; original preserved."));
    }, 60000);
    function finish(error: Error | null, value?: Extracted[]) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value!);
    }
    child.on("message", (message: any) =>
      message.error
        ? finish(Error(message.error))
        : finish(null, message.passages),
    );
    child.on("error", (e) => finish(e));
    child.on("exit", (code, signal) => {
      if (!settled)
        finish(
          Error(
            `Extraction process failed (${signal ?? code}); original preserved.`,
          ),
        );
    });
  });
}
