import { sha } from "./files.js";
// Bump when chunking, prefixes, pooling or normalization changes.
export const EMBEDDING_RECIPE_VERSION = 1;
export function embeddingUnitKey(
  reference: unknown,
  text: string,
  model: string,
) {
  return sha(
    JSON.stringify([EMBEDDING_RECIPE_VERSION, model, reference, sha(text)]),
  );
}
export function validCachedSegments(
  rows: any[],
  text: string,
  unitKey: string,
  dimensions: number,
) {
  if (!rows.length) return null;
  try {
    const segments = rows
      .map((row) => ({ ...row, meta: JSON.parse(row.payload) }))
      .sort((a, b) => a.meta.segmentIndex - b.meta.segmentIndex);
    let end = 0;
    for (let i = 0; i < segments.length; i++) {
      const r = segments[i],
        m = r.meta;
      if (
        m.unitKey !== unitKey ||
        m.segmentCount !== segments.length ||
        m.segmentIndex !== i ||
        m.start !== end ||
        !Number.isInteger(m.end) ||
        m.end <= m.start ||
        m.end > text.length ||
        !Buffer.isBuffer(r.embedding) ||
        r.embedding.length !== dimensions * 4
      )
        return null;
      if (
        sha(text.slice(m.start, m.end)) !== r.checksum ||
        sha(r.embedding) !== m.vectorChecksum
      )
        return null;
      let norm = 0;
      for (let n = 0; n < dimensions; n++) {
        const x = r.embedding.readFloatLE(n * 4);
        if (!Number.isFinite(x)) return null;
        norm += x * x;
      }
      if (Math.abs(norm - 1) > 0.02) return null;
      end = m.end;
    }
    return end === text.length ? segments : null;
  } catch {
    return null;
  }
}
