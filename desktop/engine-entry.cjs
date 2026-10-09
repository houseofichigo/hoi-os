// Keep the initial IPC request until asynchronous engine imports attach their listener.
const pending = [];
const queue = (message) => pending.push(message);
process.on("message", queue);
import("./engine.mjs")
  .then(() => {
    process.off("message", queue);
    for (const message of pending) process.emit("message", message);
  })
  .catch(() => {
    process.off("message", queue);
    process.send?.({
      type: "error",
      message:
        "ENGINE_BOOT_FAILED: The bundled engine could not load. Reinstall the matching desktop build; your workspace has not been opened.",
    });
    process.on("message", (message) => {
      if (message?.type === "stop") process.exit(0);
    });
    process.on("disconnect", () => process.exit(0));
    if (pending.some((message) => message?.type === "stop")) process.exit(0);
  });
