# Daily inputs

`daily --input options.json --json` accepts:

```json
{"date":"2026-10-19","timezone":"Europe/Paris","owner":"Alex (fictional)","workStart":"09:00","workEnd":"18:00","prepMinutes":30,"bufferMinutes":15}
```

Use the actual requested date/owner, not these fixture values. Optional projectId is the operational project ID returned by `project list`. Defaults are Monday–Friday. CLI weekdays accepts integers 0–6, Sunday=0. Date-only deadlines remain dates.

Optional coverage: `{ "from": "ISO datetime with offset", "to": "ISO datetime with offset", "checkedAt": "ISO datetime with offset", "complete": true }`. It must cover the whole seven-day window and be checked within 24 hours. Do not invent an attestation; omit coverage when unknown.

`intake list` locates imported events; `daily meeting INTAKE_ID` prepares the exact current instance. Calendar imports need explicit calendar.start/end/participants, timezone, stable remoteId and recurrenceId. A calendar event is not proof of a promise or deadline.

The local app owns its workspace lock. Use its authenticated UI while running, or stop it before CLI mutations. Do not remove active locks. The Projects & Tasks and Today views share the same reviewed records. Review proposals only when the user authorizes that exact decision.
