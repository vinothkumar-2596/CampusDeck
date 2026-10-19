import { test, expect } from "@playwright/test";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
test("browse → preview → personalise → edit → PPTX and PDF downloads → account save and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Present Your Best Work.",
    }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
  await page
    .getByRole("link", { name: "Explore Templates", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Explore templates", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search templates", exact: true })
    .fill("meridian");
  await expect(
    page.locator(".cd-market-results .cd-template-card"),
  ).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Search templates", exact: true })
    .fill("not-a-real-design");
  await expect(
    page.getByRole("heading", { name: "No templates match these filters" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear all filters" }).click();
  await expect(
    page.locator(".cd-market-results .cd-template-card"),
  ).toHaveCount(12);
  await page.getByRole("link", { name: /^Meridian\b/ }).click();
  await expect(
    page.getByRole("heading", { name: "Meridian", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next slide", exact: true }).click();
  await expect(page.locator(".cd-detail-stage .slide-view")).toHaveAttribute(
    "aria-label",
    "Contents",
  );
  await page.getByRole("button", { name: "Open fullscreen preview" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const ready = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download PowerPoint", exact: true })
    .click();
  const original = await ready;
  expect(original.suggestedFilename()).toMatch(/\.pptx$/);
  await original.saveAs("artifacts/browser-original.pptx");
  await page
    .getByRole("link", { name: "Add presentation details first" })
    .click();
  await page
    .getByLabel("Presentation title", { exact: true })
    .fill("My Verified Campus Project");
  await page
    .getByLabel("College / organisation name")
    .fill("Example Engineering College");
  await page.getByLabel("Department", { exact: true }).fill("Computer Science");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Student / team names").fill("Asha QA, Ravi QA");
  await page.getByLabel("Register numbers").fill("QA001, QA002");
  await page.getByLabel("Guide / supervisor").fill("Dr Example");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Objectives", { exact: true })
    .fill("Build a verifiable export\nKeep the slides fully editable");
  await page.getByRole("button", { name: "Open in editor" }).click();
  await expect(
    page.getByLabel("Presentation name", { exact: true }),
  ).toHaveValue("My Verified Campus Project");
  await page
    .getByLabel("Heading", { exact: true })
    .fill("My Edited Presentation");
  await page
    .getByRole("button", { name: "Duplicate slide", exact: true })
    .click();
  await expect(page.locator(".slides-heading")).toContainText("18");
  await page
    .getByRole("button", { name: "Move slide down", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete slide", exact: true }).click();
  await page.getByRole("button", { name: "Remove slide", exact: true }).click();
  await expect(page.locator(".slides-heading")).toContainText("17");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".slides-heading")).toContainText("18");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator(".slides-heading")).toContainText("17");
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await page.getByLabel("Presentation font").selectOption("Georgia");
  await page
    .getByRole("button", { name: "Use accent #3567a5", exact: true })
    .click();
  await page.screenshot({
    path: "artifacts/editor-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const exported = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "PowerPoint (.pptx) Fully editable text, shapes & charts",
    })
    .click();
  const file = await exported;
  await file.saveAs("artifacts/browser-edited.pptx");
  const zip = await JSZip.loadAsync(
    await readFile("artifacts/browser-edited.pptx"),
  );
  const cover = await zip.file("ppt/slides/slide1.xml")!.async("string");
  const editableText = [...cover.matchAll(/<a:t>(.*?)<\/a:t>/gs)]
    .map((match) => match[1])
    .join(" ");
  expect(editableText).toContain("My Edited Presentation");
  expect(cover).toContain("Example Engineering College");
  expect(cover).toContain("Asha QA");
  expect(cover).toContain("3567A5");
  await page.reload();
  await expect(page.locator(".editor-canvas .slide-view")).toHaveAttribute(
    "aria-label",
    "My Edited Presentation",
  );
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const pdfPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "PDF document Ready to share and print" })
    .click();
  const pdf = await pdfPromise;
  await pdf.saveAs("artifacts/browser-edited.pdf");
  expect(
    (await readFile("artifacts/browser-edited.pdf")).subarray(0, 5).toString(),
  ).toBe("%PDF-");
  await page
    .getByRole("button", { name: "Save to account", exact: true })
    .click();
  await page.getByRole("link", { name: "Create account", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Campus QA");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(process.env.E2E_EMAIL || "qa@campusdeck.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_PASSWORD || "Very-strong-test-password-2026");
  await page
    .getByRole("button", { name: "Create your account", exact: true })
    .click();
  await expect(
    page.getByLabel("Presentation name", { exact: true }),
  ).toHaveValue("My Verified Campus Project");
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Presentation name", { exact: true }),
  ).toHaveValue("My Verified Campus Project");
  await expect(page.locator(".editor-canvas svg")).toHaveAttribute(
    "aria-label",
    "My Edited Presentation",
  );
  await page
    .getByRole("link", { name: "Back to workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hello, Campus." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "My Verified Campus Project",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/workspace-desktop.png",
    fullPage: true,
  });
  // Public deployment verification uses a normal account; admin mutation is
  // covered against isolated SQLite and MongoDB databases instead.
  if (process.env.E2E_BASE_URL) {
    expect(errors).toEqual([]);
    return;
  }
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("link", { name: "Administration", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A considered collection." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create template", exact: true })
    .click();
  await page
    .getByLabel("Template name", { exact: true })
    .fill("QA Published Design");
  await page.getByLabel("Publish to the marketplace").check();
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(
    page.getByText("QA Published Design", { exact: true }),
  ).toBeVisible();
  await page.goto("/explore?q=QA%20Published");
  await expect(
    page.getByRole("heading", { name: "QA Published Design", exact: true }),
  ).toBeVisible();
  // Restore the catalogue after exercising publication so other journeys
  // observe the same public library, regardless of test order.
  await page.goto("/admin");
  await page
    .getByRole("button", { name: "Edit QA Published Design", exact: true })
    .click();
  await page.getByLabel("Publish to the marketplace").uncheck();
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await page.goto("/templates?q=QA%20Published");
  await expect(
    page.getByRole("heading", { name: "No templates match these filters" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile browsing, filtering, preview and responsive editor have no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Present Your Best Work.",
    }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("link", { name: "Explore Templates", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByRole("checkbox", { name: /^Minimal/ }).click();
  await expect(page.getByRole("checkbox", { name: /^Minimal/ })).toBeChecked();
  await expect(
    page.locator(".cd-market-results .cd-template-card"),
  ).toHaveCount(7);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.screenshot({
    path: "artifacts/explore-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/customise/the-final-year");
  await page
    .getByRole("button", { name: "I’ll add the details in the editor" })
    .click();
  await expect(page.getByLabel("Heading", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "artifacts/editor-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
