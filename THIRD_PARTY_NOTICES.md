# Third-party notices

Dependency versions and integrity hashes are pinned in package-lock.json. Preserve the license files supplied in node_modules when redistributing dependencies or binaries.

| Component | License |
|---|---|
| Electron / bundled Chromium | MIT and bundled third-party notices; desktop builds retain electron-LICENSE and electron-LICENSES.chromium.html in licenses/ |
| React / React DOM | MIT |
| react-force-graph-3d / force-graph stack | MIT |
| Three.js | MIT |
| better-sqlite3 | MIT; SQLite is public domain |
| Zod | MIT |
| @napi-rs/keyring / keyring-node | MIT; retain notices shipped with native bindings |
| YAML | ISC |
| JSZip | MIT (selected from its dual MIT/GPL distribution) |
| fast-xml-parser | MIT |
| PDF.js | Apache-2.0 |
| Vite | MIT |
| TypeScript | Apache-2.0 |
| Fraunces / Inter Tight / JetBrains Mono fonts | SIL Open Font License 1.1 |

Bundled font license texts are included in licenses/. Fonts retain their original names and notices. House of Ichigo's name, logo and brand assets remain its property and are not licensed as third-party trademarks.

AIS-OS is an architectural reference. No AIS-OS code or named trademark frameworks are redistributed by this implementation. If upstream code is added later, retain Nate Herk's MIT copyright/license notice alongside it.

Radix UI primitives are used under the MIT license. Copyright (c) 2022 WorkOS. The full notice is retained in `licenses/radix-ui-LICENSE.txt`.

## Optional local retrieval (unreleased)

- `sqlite-vec` 0.1.9: MIT option, Copyright (c) 2024 Alex Garcia. Full notice: `licenses/sqlite-vec-MIT.txt`. Native platform packages are pinned in the lockfile.
- `@huggingface/transformers` 4.3.1: Apache-2.0, notice retained in `licenses/transformers-js-LICENSE.txt`. Preserve bundled ONNX Runtime and transitive dependency notices when packaging.
- Opt-in model: `intfloat/multilingual-e5-small`, revision `614241f622f53c4eeff9890bdc4f31cfecc418b3`. The upstream model card declares MIT. HOI uses the upstream ONNX artifact without conversion; exact file sizes and SHA-256 values are in `src/local-model.ts`. Model weights are not included in the skills package. Runtime model loading is local-only. [Pinned model card](https://huggingface.co/intfloat/multilingual-e5-small/blob/614241f622f53c4eeff9890bdc4f31cfecc418b3/README.md).

Cerebras, Mem0, Graphiti and Letta are design references; no code or runtime from those projects was incorporated in this upgrade. Their benchmarks are not HOI verification evidence.
