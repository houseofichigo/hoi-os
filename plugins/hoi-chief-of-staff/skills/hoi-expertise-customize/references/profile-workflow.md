# Private profile workflow

Python 3 standard library is optional authoring tooling, not an engine or packaged-Hub dependency. Without it, follow the same reviewed workflow manually. Example files contain fictional records only.

The selection JSON contains `workspaceId`, `clientId` and `packs`. Each pack maps known field names to `{state, value, evidence}`. Evidence is an array of `{recordId, revision, locator}`. Missing and deferred values are null. Confirmed/reported values need exact document or attributed-statement references. Omitted fields become missing, never invented defaults.

Run from this skill directory, using your deliberate private paths:

```sh
python3 scripts/profile.py preview selection.json --output /private/workspace/expertise-draft-v1.json
python3 scripts/profile.py validate /private/workspace/expertise-draft-v1.json
python3 scripts/profile.py compare /private/workspace/expertise-draft-v2.json --previous /private/workspace/expertise-reviewed-v1.json
```

To update, use preview with `--previous` and a new output path. It increments the version, resets review and checks the client/workspace. The selection is the full intended selected-pack set; compare reports removed fields and packs. Output folders must already exist. Writes refuse existing files, symlinks and Git repository destinations. Paths above are illustrative, not built-in locations.

After the user inspects the exact content and explicitly asks to record that review:

```sh
python3 scripts/profile.py review /private/workspace/expertise-draft-v1.json --reviewer 'Fictional owner' --expected-digest DIGEST_FROM_VALIDATE --output /private/workspace/expertise-reviewed-v1.json
```

Use the actual reviewer's supplied identity in real work. The CLI records an attestation, cannot authenticate a person, and grants no engine authority. Do not run review autonomously. Reviewed profiles can still contain gaps; task-specific requirements must be checked at use. Select a profile explicitly in the assistant conversation; there is no background profile loading or new engine storage endpoint.

Never include keys, credentials, account tokens, private documents, unrestricted prompts or cross-client context. Recheck the referenced evidence through supported engine reads before use. A checksum detects changes, not truth or permission.
