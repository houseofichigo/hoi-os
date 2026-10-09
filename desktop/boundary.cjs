const path = require("node:path");
const allowed = new Set([
  "status",
  "setup",
  "create-workspace",
  "open-workspace",
  "restart",
  "stop",
  "home",
  "upgrade-copy",
  "choose-source-folder",
]);
function validateAction(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !allowed.has(value.action)
  )
    throw Error("DESKTOP_INPUT_INVALID");
  return value.action;
}
function trustedURL(value, origin) {
  try {
    const u = new URL(value);
    return (
      (u.protocol === "hoi:" &&
        u.host === "desktop" &&
        u.pathname === "/index.html") ||
      (origin && u.origin === origin && u.pathname === "/app")
    );
  } catch {
    return false;
  }
}
function allowedNavigation(value, origin) {
  try {
    const u = new URL(value);
    return (
      trustedURL(value, origin) ||
      (origin &&
        u.origin === origin &&
        ["/", "/index.html"].includes(u.pathname))
    );
  } catch {
    return false;
  }
}
function safeAsset(url, root) {
  const u = new URL(url);
  if (u.protocol !== "hoi:" || u.host !== "desktop")
    throw Error("ASSET_DENIED");
  const names = {
    "/index.html": "index.html",
    "/renderer.js": "renderer.js",
    "/desktop.css": "desktop.css",
    "/inter-tight.woff2": "inter-tight.woff2",
    "/fraunces.woff2": "fraunces.woff2",
    "/jetbrains-mono.woff2": "jetbrains-mono.woff2",
  };
  if (!names[u.pathname]) throw Error("ASSET_DENIED");
  return path.resolve(root, names[u.pathname]);
}
module.exports = { validateAction, trustedURL, allowedNavigation, safeAsset };
