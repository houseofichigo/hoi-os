import { extract } from "./extract.js";
try {
  const passages = await extract(process.argv[2]);
  process.send?.({ passages });
} catch (e) {
  process.send?.({ error: (e as Error).message });
} finally {
  process.disconnect?.();
}
