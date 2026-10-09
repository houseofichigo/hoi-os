import React from "react";
import { ProductTabs } from "./product-ui.jsx";
export function PageHeader({ eyebrow, title, children, actions }) {
  return (
    <header className="workspace-page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {children}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
export function ViewTabs({ label, values, value, onChange }) {
  return (
    <ProductTabs
      label={label}
      values={values}
      value={value}
      onChange={onChange}
    />
  );
}

export function StatusLabel({ children, tone = "neutral" }) {
  return <span className={`workspace-status ${tone}`}>{children}</span>;
}
export function EmptyState({ title, children, action }) {
  return (
    <section className="workspace-empty">
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </section>
  );
}
export function RecoveryState({ code = "REQUEST_FAILED", onRetry }) {
  const session = code === "SESSION_REQUIRED" || code === "SESSION_EXPIRED";
  return (
    <section
      className="workspace-recovery"
      role="alert"
      aria-labelledby="recovery-title"
    >
      <p className="eyebrow">WORKSPACE CONNECTION</p>
      <h1 id="recovery-title">
        {session
          ? "Open your secure workspace link"
          : code === "SERVER_UNAVAILABLE"
            ? "The local engine is unavailable"
            : "This view could not load"}
      </h1>
      <p>
        {session
          ? "This tab needs the authenticated URL from the HOI launcher. Open that complete link, including the part after #. A plain /app link cannot sign you in."
          : code === "SERVER_UNAVAILABLE"
            ? "Check that HOI is running. If you restarted the app, open the new workspace link from its launcher."
            : "Your workspace records have not been changed by this display error. Retry the view; if it persists, reopen the app and check Configuration → Workspace & recovery."}
      </p>
      <div className="page-actions">
        <button onClick={onRetry}>Retry connection</button>
        <button className="secondary" onClick={() => location.reload()}>
          Reload this tab
        </button>
      </div>
      <details>
        <summary>Technical details</summary>
        <p className="mono">{code}</p>
        <p>Do not share authenticated links in support reports.</p>
      </details>
    </section>
  );
}
export class ViewErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <RecoveryState
        code="VIEW_RENDER_FAILED"
        onRetry={() => this.setState({ failed: false })}
      />
    ) : (
      this.props.children
    );
  }
}
