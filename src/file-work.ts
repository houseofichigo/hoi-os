import { Worker } from "node:worker_threads";
let worker: Worker | undefined;
let tail: Promise<unknown> = Promise.resolve();
function work(path: string, destination?: string, mode?: string): Promise<any> {
  const next = tail.then(
    () =>
      new Promise<{ checksum: string }>((resolve, reject) => {
        const current = (worker ||= new Worker(
          new URL("./file-worker.js", import.meta.url),
          { execArgv: [] },
        ));
        current.ref();
        let settled = false;
        const timer = setTimeout(() => {
          worker = undefined;
          void current.terminate();
          finish(Error("FILE_WORK_TIMEOUT"));
        }, 60000);
        function finish(error?: Error, value?: any) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          current.off("message", message);
          current.off("error", errorHandler);
          current.off("exit", exit);
          current.unref();
          error ? reject(error) : resolve(value);
        }
        const message = (r: any) =>
          r.error
            ? finish(Object.assign(Error(r.error), { code: r.code }))
            : finish(undefined, r);
        const errorHandler = (e: Error) => {
          worker = undefined;
          finish(e);
        };
        const exit = () => {
          worker = undefined;
          finish(Error("FILE_WORK_INTERRUPTED"));
        };
        current.once("message", message);
        current.once("error", errorHandler);
        current.once("exit", exit);
        current.postMessage({ path, destination, mode });
      }),
  );
  tail = next.catch(() => {});
  return next;
}

export const prepareFile = (
  path: string,
  destination?: string,
): Promise<{ checksum: string }> => work(path, destination);
// Models are independently pinned and exceed the unchanged 50 MiB source limit.
export const checksumModelFile = (
  path: string,
): Promise<{ checksum: string; size: number }> =>
  work(path, undefined, "model-checksum");
export const extractTextFile = (
  path: string,
): Promise<{ passages: any[]; rows: any[] }> =>
  work(path, undefined, "extract");
