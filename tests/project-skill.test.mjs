import test from "node:test";
import assert from "node:assert/strict";
import {
  schema,
  validate,
} from "../skills/hoi-project-intake/scripts/validate.mjs";
import { definition } from "../skills/hoi-project-intake/scripts/action-definition.mjs";
const valid = () => ({
  ...Object.fromEntries(
    schema.required.map((k) => [k, "Explicit fictional fact"]),
  ),
  priority: "High",
  status: "Planning",
  start_date: "2028-02-29",
  due_date: "2028-03-10",
  tags: "training, consulting",
});
test("project skill validates exact keys, string types, explicit enums and real dates", () => {
  assert.equal(schema.required.length, 17);
  assert.deepEqual(validate(valid()), []);
  for (const key of schema.required) {
    for (const bad of ["", "   ", null, undefined, [], {}, "TBD", "N/A"])
      assert.ok(
        validate({ ...valid(), [key]: bad }).some((e) => e.field === key),
      );
    const x = valid();
    delete x[key];
    assert.ok(validate(x).some((e) => e.field === key));
  }
  assert.ok(validate({ ...valid(), projectTitle: "Alias" }).length);
  for (const x of [
    "2027-02-29",
    "2028-02-30",
    "2028-13-01",
    "2028-2-01",
    "0000-01-01",
  ])
    assert.ok(validate({ ...valid(), start_date: x }).length);
  for (const x of ["high", " High", "Urgent"])
    assert.ok(validate({ ...valid(), priority: x }).length);
  for (const x of ["Done", "in progress", ""])
    assert.ok(validate({ ...valid(), status: x }).length);
  for (const x of ["a,,b", "a,", " ,b", "a, TBD"])
    assert.ok(validate({ ...valid(), tags: x }).length);
});
test("Action definition derives its exact body from the same contract and requires HTTPS", () => {
  const d = definition("https://example.invalid/project");
  const body =
    d.paths["/project"].post.requestBody.content["application/json"].schema;
  assert.deepEqual(body.required, schema.required);
  assert.deepEqual(body.properties, schema.properties);
  assert.equal(body.additionalProperties, false);
  assert.equal(d.paths["/project"].post["x-openai-isConsequential"], true);
  assert.throws(() => definition("http://example.invalid/project"));
  assert.throws(() => definition("https://user:pass@example.invalid/project"));
});
