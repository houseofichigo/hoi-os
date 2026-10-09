import test from "node:test";
import assert from "node:assert/strict";
import {
  embeddingUnitKey,
  validCachedSegments,
} from "../dist/core/embedding-cache.js";
import { sha } from "../dist/core/files.js";
const text = "abcdef",
  key = embeddingUnitKey({ revision: "r1" }, text, "model1");
function rows() {
  return [0, 1].map((i) => {
    const embedding = Buffer.from(new Float32Array([1, 0]).buffer);
    return {
      embedding,
      checksum: sha(text.slice(i * 3, i * 3 + 3)),
      payload: JSON.stringify({
        unitKey: key,
        segmentCount: 2,
        segmentIndex: i,
        start: i * 3,
        end: i * 3 + 3,
        vectorChecksum: sha(embedding),
      }),
    };
  });
}
test("cache requires exact content, revision, model and a complete segment set", () => {
  assert.ok(validCachedSegments(rows(), text, key, 2));
  assert.equal(validCachedSegments(rows().slice(0, 1), text, key, 2), null);
  for (const other of [
    embeddingUnitKey({ revision: "r2" }, text, "model1"),
    embeddingUnitKey({ revision: "r1" }, text, "model2"),
  ])
    assert.equal(validCachedSegments(rows(), text, other, 2), null);
  assert.equal(validCachedSegments(rows(), "abcxyz", key, 2), null);
});
test("corrupt vectors, invalid metadata and incomplete checkpoint coverage are not reused", () => {
  let r = rows();
  r[0].embedding[0] = 123;
  assert.equal(validCachedSegments(r, text, key, 2), null);
  r = rows();
  r[0].payload = "invalid";
  assert.equal(validCachedSegments(r, text, key, 2), null);
  r = rows();
  r[0].embedding = Buffer.alloc(8);
  r[0].payload = JSON.stringify({
    ...JSON.parse(r[0].payload),
    vectorChecksum: sha(r[0].embedding),
  });
  assert.equal(validCachedSegments(r, text, key, 2), null);
});
