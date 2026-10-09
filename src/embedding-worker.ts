import { parentPort } from "node:worker_threads";
import { env, pipeline, AutoTokenizer } from "@huggingface/transformers";
env.allowRemoteModels = false;
env.allowLocalModels = true;
let model: any, tokenizer: any, loadedPath: string;
parentPort!.on("message", async ({ path, text, query }) => {
  try {
    if (path !== loadedPath) {
      await model?.dispose();
      tokenizer = await AutoTokenizer.from_pretrained(path, {
        local_files_only: true,
      });
      model = await pipeline("feature-extraction", path, {
        local_files_only: true,
        dtype: "fp32",
        device: "cpu",
        session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 },
      });
      loadedPath = path;
    }
    const prefix = query ? "query: " : "passage: ";
    // Split by tokenizer length while retaining exact character slices for citation mapping.
    const segments: { text: string; start: number; end: number }[] = [];
    function split(value: string, start: number) {
      const ids = tokenizer.encode(prefix + value);
      if (ids.length <= 500) {
        segments.push({ text: value, start, end: start + value.length });
        return;
      }
      let cut = Math.floor(value.length / 2),
        space = value.lastIndexOf(" ", cut);
      if (space > cut / 2) cut = space + 1;
      if (cut < 1) throw Error("EMBEDDING_SEGMENT_INVALID");
      split(value.slice(0, cut), start);
      split(value.slice(cut), start + cut);
    }
    split(text, 0);
    if (query && segments.length > 1) throw Error("SEMANTIC_QUERY_TOO_LONG");
    const out = [];
    for (const segment of segments) {
      const vector = await model(prefix + segment.text, {
        pooling: "mean",
        normalize: true,
      });
      out.push({ ...segment, vector: Array.from(vector.data) });
    }
    parentPort!.postMessage({ segments: out });
  } catch {
    parentPort!.postMessage({ error: "LOCAL_EMBEDDING_FAILED" });
  }
});
