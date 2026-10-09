const bridge = window.hoiDesktop;
async function refresh() {
  const s = await bridge.status();
  document.querySelector("#status").textContent =
    s.state + (s.schema ? " · schema " + s.schema : "");
  document.querySelector("#workspace").textContent =
    s.workspace || "No workspace selected";
  document.querySelector("#error").textContent = s.error || "";
  document.querySelector("#upgrade").hidden = s.state !== "needs-upgrade";
}
for (const [id, method] of Object.entries({
  create: "createWorkspace",
  open: "openWorkspace",
  restart: "restart",
  stop: "stop",
  home: "home",
  upgrade: "upgradeCopy",
}))
  document.getElementById(id).addEventListener("click", async () => {
    document.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      await bridge[method]();
      await refresh();
    } catch (e) {
      document.querySelector("#error").textContent = e.message;
    } finally {
      document.querySelectorAll("button").forEach((b) => (b.disabled = false));
    }
  });
refresh().catch(
  (e) => (document.querySelector("#error").textContent = e.message),
);
setInterval(() => refresh().catch(() => {}), 2000);
