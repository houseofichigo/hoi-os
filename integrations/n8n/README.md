# HOI n8n integration pack

These portable workflow templates are **inactive, uninstalled and not live-certified**. They contain no credentials. The available n8n connector in the implementation environment exposes search, details and execution, but not node-type discovery, workflow validation, creation or publication. Node parameter shapes were inspected in the official n8n source. Target-instance validation and execution remain required; do not treat local structural checks as n8n validation.

1. Run HOI and n8n on the same trusted host/network namespace. HOI binds loopback only. Containers have distinct loopback interfaces; use a deliberately configured private connection, not a public general-engine endpoint.
2. Review and enable one HOI automation. Create its scoped credential through Configuration → Automations, or `automation credential --input review.json --output <private-file>`.
3. In n8n create an HTTP Bearer Auth credential (explicit type for these templates); bind it to each HTTP Request node. Never paste tokens into node fields, workflow JSON, prompts or export files.
4. Import the error workflow first. Publish it only after validation and testing. Select its real workflow ID in each trigger workflow's error-workflow setting. Placeholder IDs intentionally prevent a claim of readiness.
5. Replace `REPLACE_WITH_ENGINE_PORT` in each HTTP URL with the reviewed engine port. This non-secret configuration uses no paid instance-variable feature. Check the endpoint after engine restart. Set the workflow timezone to the workspace timezone. Defaults are illustrative Europe/Paris.
6. Validate each node against your installed n8n version; validate the workflow, read back its saved connections, test against a fictional workspace, then publish explicitly. No private source is required for this rehearsal.
7. Read back schedule state and save the real identity through `automation observe`. Pause HOI first when stopping work; separately pause and verify the n8n workflow.

`trigger.json`: a 15-minute schedule, idempotent dispatch and safe-status read. Change cadence to daily 08:00 or Friday 16:00 only with the definition's matching cadence. `export.json`: a manually invoked example; replace its input with a reviewed tool's normalized snapshot. It is not a live connector. `status.json`: a safe read. `error.json`: leaves a failed execution in n8n's history with a bounded non-secret error. No notification messages are sent.

Retries retain the same execution trigger ID. Automatic retries are bounded; the engine coalesces scheduled slots and does not replay uncertain paid jobs. Status may still say running after dispatch. Use subsequent status checks, not additional paid runs, to observe completion.

The template pack includes no hosted service, shell node or model node. The API path uses HOI's configured provider, disclosure checks and automatic-analysis budget. Without configuration, mechanical work still runs and AI drafting reports why it is waiting.

Sources inspected 2026-10-19 (parameter references, no copied implementation):

- https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Schedule/ScheduleTrigger.node.ts
- https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/HttpRequest/V3/Description.ts
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/

## Independent health monitor (schema 21)

`health-monitor.json` is a separate inactive 15-minute status workflow. Bind a status-only credential (`automation credential` with `access: status`), which does not revoke the trigger credential and cannot POST a run. `requireHealthy=1` returns 503 for delayed, partial, failed or unknown health. The HTTP error and existing error workflow record the failure without sending notifications. Run this independently of the intake workflow; a same-host outage still prevents self-monitoring. The health response has safe operational status only. Target-instance node/workflow validation, saved-connection inspection, fictional tests, credential binding and explicit publication remain required. No live monitor was activated during implementation.

The monitoring template was checked against the [official Schedule Trigger source](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Schedule/ScheduleTrigger.node.ts) and [HTTP Request documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/). The available connector exposes no node-schema or workflow-validation tool, so target-instance validation, saved-connection inspection and a fictional execution remain required before activation.
