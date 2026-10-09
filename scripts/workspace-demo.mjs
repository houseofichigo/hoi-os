import { seedDailyDemo } from "./daily-demo.mjs";
import { Store } from "../dist/core/store.js";
import { records, saveRecord } from "../dist/core/workspace.js";
const demo = await seedDailyDemo(process.argv[2]);
const s = new Store(demo.workspace);
try {
  const client = saveRecord(
    s,
    {
      kind: "client",
      expectedVersion: 0,
      record: {
        name: "Cedar Studio (fictional)",
        owner: "Alex",
        notes: "Synthetic client for local interface review.",
        contacts: [{ name: "Robin", email: "robin@example.test" }],
      },
    },
    "local",
  );
  const p = records(s, "project", "local")[0];
  const { id, version, ...record } = p;
  saveRecord(
    s,
    {
      kind: "project",
      id,
      expectedVersion: version,
      record: {
        ...record,
        clientIds: [client.id],
        status: "in-progress",
        priority: "high",
        dueDate: demo.date,
        scope: "Prepare and review the Cedar proposal",
        deliverables: "Cited briefing and reviewed task list",
      },
    },
    "local",
  );
  const begin = new Date(Date.now() + 3 * 86400000);
  saveRecord(
    s,
    {
      kind: "training",
      expectedVersion: 0,
      record: {
        name: "Cedar working session (fictional)",
        projectId: id,
        clientIds: [client.id],
        start: begin.toISOString(),
        end: new Date(+begin + 3600000).toISOString(),
        timezone: "Europe/Paris",
        status: "confirmed",
        owner: "Alex",
      },
    },
    "local",
  );
  console.log(
    JSON.stringify({
      ...demo,
      note: "Synthetic data only. No OAuth credentials or live connections configured.",
    }),
  );
} finally {
  s.close();
}
