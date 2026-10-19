import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("inactive n8n templates use scoped HTTP, credential references and connected named nodes", () => {
  for (const file of ["trigger", "export", "status", "error"]) {
    const raw = readFileSync(`integrations/n8n/${file}.json`, "utf8"),
      workflow = JSON.parse(raw);
    assert.equal(workflow.active, false);
    assert.equal(workflow.settings.timezone, "Europe/Paris");
    const names = new Set(workflow.nodes.map((n) => n.name));
    assert.equal(names.size, workflow.nodes.length);
    for (const [name, outputs] of Object.entries(workflow.connections)) {
      assert.ok(names.has(name));
      for (const branch of Object.values(outputs))
        for (const links of branch)
          for (const link of links) assert.ok(names.has(link.node));
    }
    for (const n of workflow.nodes) {
      assert.ok(!/executeCommand|code|agent|openAi/i.test(n.type));
      if (n.type.endsWith("httpRequest")) {
        assert.equal(n.parameters.authentication, "genericCredentialType");
        assert.equal(n.parameters.genericAuthType, "httpBearerAuth");
        assert.match(
          n.parameters.url,
          /^http:\/\/127\.0\.0\.1:REPLACE_WITH_ENGINE_PORT\/api\/automation-client\/(run|status)$/,
        );
        assert.equal(n.credentials, undefined);
        if (n.parameters.method === "POST") {
          assert.match(n.parameters.jsonBody, /n8n-execution:/);
          assert.equal(n.maxTries, 2);
        }
      }
    }
    assert.doesNotMatch(
      raw,
      /Bearer [a-zA-Z0-9]{16}|"password"|"apiKey"|\$env\./,
    );
    if (file !== "error")
      assert.equal(
        workflow.settings.errorWorkflow,
        "CONFIGURE_REAL_ERROR_WORKFLOW_ID",
      );
  }
  const prompt = readFileSync("integrations/codex/schedule-prompt.md", "utf8");
  assert.match(prompt, /automation trigger/);
  assert.match(prompt, /automation inspect/);
  assert.match(prompt, /do not generate a new trigger/i);
  assert.match(prompt, /disabled until configured/);
});
