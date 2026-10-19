import type { Store } from "./store.js";
export const RETRIEVAL_PROFILE = Object.freeze({
  version: "unified-retrieval-v4",
  channelLimit: 50,
  candidateLimit: 100,
  resultLimit: 10,
  perSource: 3,
  rrfConstant: 60,
  discoveryWeights: [1, 1, 2, 4] as const,
});

export const BASELINE_PROFILE = Object.freeze({
  ...RETRIEVAL_PROFILE,
  version: "unified-retrieval-v3.1",
  discoveryWeights: [1, 1, 1, 1] as const,
});
export function retrievalProfile(s: Store) {
  return s.schemaVersion >= 21 &&
    JSON.parse(
      s.one(
        "SELECT payload FROM knowledge_retrieval_config WHERE id='discovery'",
      )?.payload ?? "{}",
    ).enabled === true
    ? RETRIEVAL_PROFILE
    : BASELINE_PROFILE;
}
