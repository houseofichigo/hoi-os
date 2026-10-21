import { schema } from "./validate.mjs";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export function definition(endpoint) {
  const url = new URL(endpoint);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error(
      "Use an HTTPS Action endpoint without credentials, query or fragment",
    );
  const { $schema, ...body } = schema;
  return {
    openapi: "3.1.0",
    info: { title: "HOI project creation Action", version: "1.0.0" },
    servers: [{ url: url.origin }],
    paths: {
      [url.pathname]: {
        post: {
          operationId: "createProject",
          summary: "Create a project from a reviewed complete 17-field brief",
          "x-openai-isConsequential": true,
          requestBody: {
            required: true,
            content: { "application/json": { schema: body } },
          },
          responses: {
            200: {
              description:
                "Confirmed project creation; may contain a URL such as NotionUrl",
            },
          },
        },
      },
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    writeFileSync(
      process.argv[2],
      JSON.stringify(definition(process.env.HOI_PROJECT_ACTION_URL), null, 2) +
        "\n",
      { mode: 0o600 },
    );
    console.log("Action definition written; no request sent.");
  } catch {
    console.error("Supply an output file and HOI_PROJECT_ACTION_URL.");
    process.exitCode = 1;
  }
}
