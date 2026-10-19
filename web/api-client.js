const incomingToken = /^[a-f0-9]{64}$/.test(location.hash.slice(1))
  ? location.hash.slice(1)
  : "";
export let token =
  incomingToken || sessionStorage.getItem("hoi-map-token") || "";
if (incomingToken) {
  sessionStorage.setItem("hoi-map-token", token);
  history.replaceState(null, "", location.pathname + location.search);
}
// Opening a launcher link in an existing tab can be a same-document navigation.
// Consume new credentials without putting them in routes, logs or persistent storage.
window.addEventListener("hashchange", () => {
  const next = location.hash.slice(1);
  if (!/^[a-f0-9]{64}$/.test(next)) return;
  token = next;
  sessionStorage.setItem("hoi-map-token", next);
  history.replaceState(null, "", location.pathname + location.search);
  window.dispatchEvent(new Event("hoi:authenticated"));
});
function connectionError(code, message) {
  const error = Object.assign(new Error(message), { code });
  window.dispatchEvent(
    new CustomEvent("hoi:connection-error", { detail: code }),
  );
  return error;
}
export async function api(path, body) {
  if (!token)
    throw connectionError(
      "SESSION_REQUIRED",
      "Open the authenticated workspace link from the launcher.",
    );
  let r;
  try {
    r = await fetch(`/api/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw connectionError(
      "SERVER_UNAVAILABLE",
      "The local server is unavailable. Restart the app command and open its new URL.",
    );
  }
  if (r.status === 401)
    throw connectionError(
      "SESSION_EXPIRED",
      "Open the new authenticated workspace link from the launcher.",
    );
  if (!r.ok) {
    let message = "";
    try {
      message = (await r.json()).error;
    } catch {}
    throw Error(
      r.status === 401
        ? "This session has expired. Open the new URL printed by the app command."
        : message || "The requested action is unavailable for this host.",
    );
  }
  const result = await r.json();
  if (body) window.dispatchEvent(new Event("hoi:activity"));
  return result;
}
