import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initialize, Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
import { configureAI } from "../../dist/core/ai.js";
import { sendChat } from "../../dist/core/chat-send.js";
let root, s, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-connected-ui-"));
  initialize(join(root, "workspace"));
  s = new Store(join(root, "workspace"));
  await configureAI(
    s,
    {
      provider: "openai",
      model: "fictional",
      inputPerMillion: 0.1,
      outputPerMillion: 0.1,
      pricingDate: new Date().toISOString().slice(0, 10),
      allowWorkspaceContext: true,
      sourceIds: [],
      confirm: true,
    },
    "local",
  );
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
});
test.afterAll(async () => {
  await new Promise((ok) => running.server.close(ok));
  s.close();
  rmSync(root, { recursive: true, force: true });
});
test("Home and Hub share a direct-send chat with saved history and explicit scopes", async ({
  page,
}) => {
  await page.route("**/api/chat/send", async (route) => {
    const result = await sendChat(s, route.request().postDataJSON(), "local", {
      key: "fictional",
      stream: async () => ({
        text: JSON.stringify({
          type: "answer",
          text: "No relevant work is recorded in this fictional workspace.",
          citations: [],
        }),
        usage: { input_tokens: 20, output_tokens: 20 },
      }),
    });
    await route.fulfill({ json: result });
  });
  await page.goto(running.url);
  await expect(page.getByLabel("home chat")).toBeVisible();
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Keep this Home draft");
  await page
    .getByRole("button", { name: "Knowledge Hub", exact: true })
    .click();
  await page.getByRole("button", { name: "Context", exact: true }).click();
  await expect(page.getByLabel("Context scope")).toHaveValue("knowledge");
  await page.keyboard.press("Escape");
  const composer = await page.getByLabel("knowledge chat").boundingBox(),
    tabs = await page
      .getByRole("tablist", { name: "Knowledge Hub views" })
      .boundingBox();
  expect(composer.y + composer.height).toBeLessThanOrEqual(tabs.y + 2);
  await page
    .getByLabel("Your message", { exact: true })
    .fill("What is recorded in my knowledge?");
  await page.getByRole("tab", { name: "Sources", exact: true }).click();
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
    "What is recorded in my knowledge?",
  );
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page.getByLabel("Response mode").selectOption("openai");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page).toHaveURL(/view=chat.*conversation=/);
  await expect(
    page.getByText("No relevant work is recorded in this fictional workspace."),
  ).toBeVisible();
  const conversationUrl = page.url();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
    "Keep this Home draft",
  );
  await page.goto(conversationUrl);
  await expect(
    page.getByText("No relevant work is recorded in this fictional workspace."),
  ).toBeVisible();
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
});

test("compact composer matches the reference and menus preserve keyboard focus", async ({
  page,
}) => {
  await page.goto(running.url);
  await page
    .getByRole("button", { name: "Knowledge Hub", exact: true })
    .click();
  const form = page.locator(".connected-composer");
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByPlaceholder("Ask anything — notes, emails, meetings…"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Hide connectors", exact: true })
    .click();
  await expect(form.locator(".composer-connections")).toHaveCount(0);
  await page.getByRole("button", { name: "Context", exact: true }).click();
  await page.getByLabel("Show connectors", { exact: true }).check();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Context", exact: true }),
  ).toBeFocused();
  await expect(form.locator(".composer-connections")).toBeVisible();
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "Assistant", exact: true }).click();
    await expect(page.getByLabel("Response mode")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Assistant", exact: true }),
    ).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (width >= 1280) {
      const box = await form.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(150);
      expect(box.height).toBeLessThan(190);
    }
    await form.screenshot({ path: `test-results/composer-${width}.png` });
  }
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Line one\nLine two\nLine three\nLine four\nLine five");
  expect((await form.boundingBox()).height).toBeGreaterThan(190);
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page.getByLabel("Response mode").selectOption("");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Choose and configure an assistant",
  );
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
    /Line five/,
  );
});
