import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedDailyDemo } from "../../scripts/daily-demo.mjs";
import { Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
let root, s, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-chat-ui-"));
  const demo = await seedDailyDemo(join(root, "workspace"));
  s = new Store(demo.workspace);
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
});
test.afterAll(async () => {
  await new Promise((ok) => running.server.close(ok));
  s.close();
  rmSync(root, { recursive: true, force: true });
});
test("handoff streams validated answers, resumes saved chats, cites sources and cancels late responses", async ({
  page,
}) => {
  await page.goto(running.url);
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(
    page.getByText(/One conversation with your knowledge/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Context", exact: true }).click();
  await page
    .getByLabel("Chat project", { exact: true })
    .selectOption({ index: 1 });
  await page.keyboard.press("Escape");
  await page
    .getByLabel("Your message", { exact: true })
    .fill("What is the Cedar proposal task?");
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page
    .getByLabel("Response mode", { exact: true })
    .selectOption("handoff");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Prepare request", exact: true })
    .click();
  await expect(page.getByLabel("Chat request", { exact: true })).toBeVisible();
  const request = JSON.parse(
    await page.getByLabel("Chat request", { exact: true }).inputValue(),
  );
  const e = request.context[0].search.recordResults.find(
    (r) => r.recordKind === "task",
  ).evidence[0];
  const url = new URL(running.url),
    token = url.hash.slice(1);
  const result = await page.request.post(`${url.origin}/api/chat/submit`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      runId: request.runId,
      expectedVersion: request.expectedVersion,
      response: {
        type: "answer",
        text: "Cedar work is recorded in the approved tasks.",
        citations: [e],
      },
    },
  });
  expect(result.ok()).toBeTruthy();
  await expect(
    page.getByRole("region", { name: "Chat conversation" }),
  ).toContainText("Cedar work is recorded");
  await page
    .getByRole("button", { name: "Read chat source 1", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Chat source passage" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Live records", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Evidence", exact: true }),
  ).toContainText("Current recorded properties");
  await page.reload();
  await expect(page).toHaveURL(/conversation=/);
  await expect(
    page.getByRole("region", { name: "Chat conversation" }),
  ).toContainText("Cedar work is recorded");
  await page.getByLabel("Your message", { exact: true }).fill("Follow up");
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page
    .getByLabel("Response mode", { exact: true })
    .selectOption("handoff");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Prepare request", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel chat", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Chat conversation" }),
  ).toContainText("cancelled");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: "test-results/chat-mobile.png",
    fullPage: true,
  });
});

test("workspace conversations rename, archive, scope reset and malformed responses remain recoverable", async ({
  page,
}) => {
  await page.goto(running.url);
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page.getByLabel("Your message", { exact: true }).fill("Cedar context");
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page
    .getByLabel("Response mode", { exact: true })
    .selectOption("handoff");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Prepare request", exact: true })
    .click();
  await expect(page.getByLabel("Chat request", { exact: true })).toBeVisible();
  await page.getByLabel("Assistant response JSON").fill("{bad json");
  await page.getByRole("button", { name: "Submit assistant response" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByLabel("Conversation title").fill("Fictional planning");
  await page.getByRole("button", { name: "Save title" }).click();
  await expect(
    page.getByRole("heading", { name: "Fictional planning", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel chat", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Chat conversation" }),
  ).toContainText("cancelled");
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Prepare request" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.getByLabel("Your message", { exact: true }).fill("A new question");
  await expect(
    page.getByRole("button", { name: "Prepare request" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Context", exact: true }).click();
  await page
    .getByLabel("Chat project", { exact: true })
    .selectOption({ index: 1 });
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/conversation=/);
  await expect(
    page.getByRole("heading", { name: "Talk with your work.", exact: true }),
  ).toBeVisible();
});

test("long transcripts retain ordered turns and evidence remains keyboard dismissible on mobile", async ({
  page,
}) => {
  const { createConversation, appendConversation, submitChat } =
    await import("../../dist/core/chat.js");
  let c = createConversation(
    s,
    { title: "Long fictional conversation", host: "codex" },
    "local",
  );
  for (let i = 1; i <= 30; i++) {
    c = appendConversation(
      s,
      {
        id: c.id,
        expectedVersion: c.version,
        message: `Fictional question ${i}`,
      },
      "local",
    );
    const r = c.turns.at(-1);
    submitChat(
      s,
      r.id,
      r.version,
      {
        type: "answer",
        text: `Fictional response ${i}. No factual assertion.`,
        citations: [],
      },
      "local",
    );
  }
  const url = new URL(running.url);
  url.searchParams.set("view", "chat");
  url.searchParams.set("conversation", c.id);
  await page.goto(url.toString());
  const transcript = page.getByRole("region", { name: "Chat conversation" });
  await expect(transcript.locator(".chat-turn")).toHaveCount(30);
  await expect(transcript).toContainText("Fictional response 30");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Inspect turn 30 evidence", exact: true })
    .click();
  const panel = page.getByRole("complementary", {
    name: "Evidence",
    exact: true,
  });
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
