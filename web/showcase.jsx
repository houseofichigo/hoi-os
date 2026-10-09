import React, { useState } from "react";
import { Drawer, SkillIcon, Hint, ProductTabs } from "./product-ui.jsx";
export default function Showcase() {
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState("Components");
  return (
    <section className="product-showcase">
      <h1>HOI product components</h1>
      <p>Fictional examples · visual review only</p>
      <ProductTabs
        label="Component examples"
        values={["Components", "States"]}
        value={tab}
        onChange={setTab}
      />
      {tab === "Components" ? (
        <>
          <div className="record-toolbar">
            <button onClick={() => setOpen(true)}>Open drawer</button>
            <button className="secondary">Secondary action</button>
            <Hint label="No operation configured in this example">
              <button disabled>Unavailable</button>
            </Hint>
          </div>
          <div className="skill-gallery">
            <article className="skill-tile">
              <div className="skill-tile-head">
                <SkillIcon kind="delivery" />
                <h2>Meeting preparation</h2>
              </div>
              <p>Prepare with documents and open commitments.</p>
              <span className="workspace-status ready">Ready for handoff</span>
              <div className="skill-examples">
                <span>Example requests</span>
                <button className="secondary">Prepare my next meeting ↗</button>
              </div>
            </article>
          </div>
        </>
      ) : (
        <>
          <p role="status">Loading example records…</p>
          <p role="alert">
            Example request failed. Your records are unchanged.
          </p>
          <p>No matching records. Adjust your search.</p>
          <span className="workspace-status warning">Partial coverage</span>
        </>
      )}
      {open && (
        <Drawer title="Example details" onClose={() => setOpen(false)}>
          <h2>Example details</h2>
          <p>Press Escape to close and return focus.</p>
          <button onClick={() => setOpen(false)}>Close example</button>
        </Drawer>
      )}
    </section>
  );
}
