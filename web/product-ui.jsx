import React, { useRef } from "react";
import { Dialog, Tabs, Tooltip } from "radix-ui";
export function SkillIcon({ kind = "knowledge" }) {
  const paths = {
    delivery: "M4 7h16v13H4z M8 7V4h8v3 M8 12h8 M8 16h5",
    knowledge: "M12 5C8 2 4 4 3 5v15c3-2 6-2 9 0 3-2 6-2 9 0V5c-3-2-6-2-9 0v15",
    governance: "M12 3 3 7v6c0 4 5 7 9 9 4-2 9-5 9-9V7z M8 12l3 3 5-6",
    setup: "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6",
  };
  return (
    <svg
      className={"skill-icon tone-" + kind}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind] || paths.knowledge} />
    </svg>
  );
}
export function Drawer({ title, children, onClose, returnFocus }) {
  const opener = useRef(returnFocus || document.activeElement);
  return (
    <Dialog.Root open onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="product-overlay" />
        <Dialog.Content
          className="product-drawer"
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
            else document.getElementById("workspace-main")?.focus();
          }}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ProductTabs({ label, values, value, onChange }) {
  return (
    <Tabs.Root value={value} onValueChange={onChange}>
      <Tabs.List className="view-tabs" aria-label={label}>
        {values.map((x) => (
          <Tabs.Trigger key={x} value={x} aria-pressed={value === x}>
            {x}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
export function Hint({ label, children }) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="product-tooltip" sideOffset={6}>
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
