# Codex scheduled trigger template (disabled until configured)

Create an actual schedule only after the user approves its definition, scope, timing and host. Replace each placeholder with reviewed local paths; use shell-safe quoting. Do not add secret values.

> Run the installed HOI CLI for the selected workspace using only this scoped command:
>
> `node <HOI_ENTRYPOINT> automation trigger --workspace <WORKSPACE> --credential-file <PRIVATE_CREDENTIAL_FILE> --input <TRIGGER_INPUT_JSON> --json`
>
> The reviewed input file contains a stable triggerId, for example `codex-schedule:<actual-schedule-id>`. The definition must use its matching non-manual cadence; the engine derives one execution identity per local cadence slot. Retries must retain it. Do not use owner or assistant credentials instead. Do not read arbitrary workspace documents, change policy, expand sources, create providers, or substitute Codex reasoning for HOI API analysis. If the engine is unavailable, report that state. Use `automation inspect` with the same workspace and credential file to read safe status. If the run is uncertain, inspect status; do not generate a new trigger to repeat paid work. A successful trigger acknowledges dispatch, not completed analysis. Report only new findings, failures or required decisions.

The external scheduler owns recurrence. Prepare a unique invocation input with a stable host execution identity; the engine also coalesces daily/weekly/quarter-hour slots in the approved timezone. No shell commands are generated from source content.

Use the host's supported scheduling interface, record the real schedule ID, read it back and record that observation via `automation observe`. A text file does not install a schedule. Local jobs require the computer, host and engine to be available. An approved continuously hosted deployment is a separate setup.

Official reference: https://learn.chatgpt.com/docs/automations?surface=app
