import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  lazy,
  Suspense,
  Component,
} from "react";
import { createRoot } from "react-dom/client";
import "./tokens.css";
import "./style.css";
import KnowledgeMap from "./map.jsx";
const ForceGraph = lazy(() => import("react-force-graph-3d"));
const token =
  location.hash.slice(1) || sessionStorage.getItem("hoi-map-token") || "";
if (location.hash) {
  sessionStorage.setItem("hoi-map-token", token);
  history.replaceState(null, "", location.pathname);
}
async function api(path) {
  let r;
  try {
    r = await fetch(`/api/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw Error(
      "The local server is unavailable. Restart npm start and open its new URL, then refresh records.",
    );
  }
  if (!r.ok)
    throw Error(
      r.status === 401
        ? "This map session has expired. Open the new URL printed by the map command."
        : "The requested record is unavailable for this host.",
    );
  return r;
}
createRoot(document.getElementById("root")).render(<KnowledgeMap api={api} />);
