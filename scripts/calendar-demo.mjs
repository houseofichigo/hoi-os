import { seedDailyDemo } from "./daily-demo.mjs";
import { Store } from "../dist/core/store.js";
import { proposeCalendar } from "../dist/core/calendar.js";
const demo = await seedDailyDemo(process.argv[2]);
const s = new Store(demo.workspace);
try {
  const p = s.one("SELECT * FROM passages LIMIT 1");
  const start = new Date(Date.now() + 86400000);
  start.setUTCMinutes(0, 0, 0);
  const r = proposeCalendar(
    s,
    {
      calendarId: "synthetic-calendar-no-provider",
      title: "Prepare Cedar review (synthetic)",
      start: start.toISOString(),
      end: new Date(+start + 1800000).toISOString(),
      timezone: "Europe/Paris",
      evidence: [
        {
          revisionId: p.revision_id,
          passageId: p.id,
          quote: p.text.slice(0, 60),
        },
      ],
    },
    "local",
  );
  console.log(
    JSON.stringify({
      ...demo,
      calendarAction: r.id,
      note: "Fictional calendar proposal; writes disabled.",
    }),
  );
} finally {
  s.close();
}
