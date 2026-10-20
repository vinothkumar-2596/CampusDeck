import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

async function downloadEditor(page: Page, format: "pptx" | "pdf") {
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name:
        format === "pptx"
          ? "PowerPoint (.pptx) Fully editable text, shapes & charts"
          : "PDF document Ready to share and print",
    })
    .click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
  return readFile((await file.path())!);
}

const slidePaths = (zip: JSZip) =>
  Object.keys(zip.files).filter((path) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(path),
  );
const nativeText = (xml: string) =>
  [...xml.matchAll(/<a:t>(.*?)<\/a:t>/gs)].map((match) => match[1]).join(" ");

test("homepage hero shows a wall of real template covers that open their templates", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Present Your Best Work.", exact: true }),
  ).toBeVisible();
  const cards = page.locator(".cd-wall-card");
  await expect(cards).toHaveCount(16);
  const names = await page
    .locator(".cd-wall-name")
    .evaluateAll((labels) => labels.map((label) => label.textContent || ""));
  expect(names.every((name) => / template$/.test(name))).toBeTruthy();
  expect(new Set(names).size).toBeGreaterThanOrEqual(12);
  await expect(cards.first().locator(".slide-view")).toBeVisible();
  const card = page.getByRole("link", {
    name: "Meridian template",
    exact: true,
  });
  await card.hover();
  await expect(card.locator(".cd-wall-name")).toHaveCSS("opacity", "1");
  await card.click();
  await expect(page).toHaveURL(/\/templates\/meridian$/);
  await expect(page.locator("h1")).toHaveText("Meridian");
  await page.goBack();
  await page
    .locator(".cd-wall-content")
    .getByRole("link", { name: "Explore Templates", exact: true })
    .click();
  await expect(page).toHaveURL(/\/templates$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  // Covers render once the catalogue loads, so wait rather than count once.
  await expect
    .poll(() => page.locator(".cd-wall-card:visible").count())
    .toBeGreaterThanOrEqual(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("blank creation starts truly empty, survives guest reload, and exports editable content after design changes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("link", { name: "Create a Presentation", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(
    page.getByRole("heading", { name: "What will you create?", exact: true }),
  ).toBeVisible();
  // First visits open the tutorial as a lightbox; skipping it clears the way.
  const tour = page.getByRole("dialog", {
    name: "How your document becomes slides",
  });
  await expect(tour).toBeVisible();
  await tour.getByRole("button", { name: "Skip tutorial", exact: true }).click();
  await expect(tour).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Browse all templates", exact: true }),
  ).toHaveAttribute("href", "/templates");
  await expect(page.locator(".cd-create-template")).toHaveCount(6);
  await page.screenshot({
    path: "artifacts/create-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/create-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("textbox", { name: /^Presentation name/ })
    .fill("Blank Guest Verification");
  await page
    .getByRole("button", { name: "Start blank presentation", exact: true })
    .click();
  await expect(
    page.getByLabel("Presentation name", { exact: true }),
  ).toHaveValue("Blank Guest Verification");
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Content", { exact: true })).toHaveValue("");
  await expect(
    page.getByLabel("Subtitle / label", { exact: true }),
  ).toHaveValue("");
  await expect(page.locator(".slides-list > button")).toHaveCount(1);
  await expect(
    page.locator(".editor-canvas svg > rect").first(),
  ).toHaveAttribute("fill", /#ffffff/i);
  await expect(page.locator(".editor-canvas svg text")).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/blank-editor-empty.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("button", { name: "Delete slide", exact: true }),
  ).toBeDisabled();
  const blankPptx = await JSZip.loadAsync(await downloadEditor(page, "pptx"));
  expect(slidePaths(blankPptx)).toHaveLength(1);
  expect(
    nativeText(await blankPptx.file("ppt/slides/slide1.xml")!.async("string")),
  ).toBe("");
  expect(
    Object.keys(blankPptx.files).some((path) =>
      /^ppt\/charts\/chart\d+\.xml$/.test(path),
    ),
  ).toBeFalsy();
  expect((await downloadEditor(page, "pdf")).subarray(0, 5).toString()).toBe(
    "%PDF-",
  );

  await page
    .getByLabel("Presentation name", { exact: true })
    .fill("Blank Guest Verification");
  await page
    .getByLabel("Heading", { exact: true })
    .fill("An idea from a blank slide");
  await page
    .getByLabel("Content", { exact: true })
    .fill("The first editable point\nThe second editable point");
  const draftUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(draftUrl);
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "An idea from a blank slide",
  );
  await expect(page.getByLabel("Content", { exact: true })).toHaveValue(
    "The first editable point\nThe second editable point",
  );
  await page.getByRole("button", { name: "Add slide", exact: true }).click();
  await page
    .getByRole("dialog")
    .locator(".layout-picker button")
    .filter({ has: page.getByText("blank", { exact: true }) })
    .click();
  await expect(page.locator(".slides-list > button")).toHaveCount(2);
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue("");
  await expect(page.locator(".editor-canvas svg text")).toHaveCount(0);
  await page
    .getByLabel("Heading", { exact: true })
    .fill("A second blank canvas");
  await page
    .getByLabel("Content", { exact: true })
    .fill("Second slide content stays editable");
  await page.locator(".slides-list > button").first().click();
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await page
    .getByRole("button", { name: "Use design Meridian", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use theme Teal", exact: true })
    .click();
  await expect(page.locator(".editor-deck-meta")).toContainText(
    "Meridian · Teal theme · 2 slides",
  );
  await page.getByRole("tab", { name: "Content", exact: true }).click();
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "An idea from a blank slide",
  );
  await expect(page.getByLabel("Content", { exact: true })).toHaveValue(
    "The first editable point\nThe second editable point",
  );
  await page.reload();
  await expect(page.locator(".editor-deck-meta")).toContainText(
    "Meridian · Teal theme · 2 slides",
  );
  const editedPptx = await JSZip.loadAsync(await downloadEditor(page, "pptx"));
  expect(slidePaths(editedPptx)).toHaveLength(2);
  const firstXml = await editedPptx
    .file("ppt/slides/slide1.xml")!
    .async("string");
  const secondXml = await editedPptx
    .file("ppt/slides/slide2.xml")!
    .async("string");
  expect(nativeText(firstXml)).toContain("An idea from a blank slide");
  expect(nativeText(firstXml)).toContain("The second editable point");
  expect(nativeText(secondXml)).toContain("A second blank canvas");
  expect(nativeText(secondXml)).toContain(
    "Second slide content stays editable",
  );
  expect(firstXml).toContain("<p:sp>");
  expect((await downloadEditor(page, "pdf")).subarray(0, 5).toString()).toBe(
    "%PDF-",
  );
  expect(errors).toEqual([]);
});

test("new visitors get the tutorial as a lightbox, and once skipped it stays on the page", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/create");
  const tour = page.getByRole("dialog", {
    name: "How your document becomes slides",
  });
  await expect(tour).toBeVisible();
  await expect(tour.getByText("Step 1 of 6")).toBeVisible();
  await expect(tour.locator(".cd-learn-stage .slide-view")).toHaveAttribute(
    "aria-label",
    "Why it matters",
  );
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  await expect(tour.getByRole("tab", { name: /^Steps/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  await expect(tour.getByText("Step 3 of 6")).toBeVisible();
  await expect(tour.locator(".cd-learn-stage .slide-view")).toHaveAttribute(
    "aria-label",
    "Results",
  );
  await tour.getByRole("button", { name: "Back", exact: true }).click();
  await expect(tour.getByText("Step 2 of 6")).toBeVisible();
  // The last step offers the sample report or a start.
  await tour.getByRole("tab", { name: /^Questions/ }).click();
  await expect(tour.getByRole("button", { name: "Start creating" })).toBeVisible();
  await expect(tour.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
  await tour.getByRole("tab", { name: /^Numbers/ }).click();

  await tour.getByRole("button", { name: "Skip tutorial", exact: true }).click();
  await expect(tour).toHaveCount(0);
  // The tutorial is still on the page, showing the step the visitor reached.
  const inline = page.locator("section.cd-learn");
  await expect(inline.getByRole("tab", { name: /^Numbers/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(inline.locator(".cd-learn-stage .slide-view")).toHaveAttribute(
    "aria-label",
    "Results",
  );
  await page
    .getByRole("button", { name: "Start blank presentation", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Start blank presentation", exact: true }),
  ).toBeEnabled();

  // Returning visitors aren't interrupted again.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What will you create?", exact: true }),
  ).toBeVisible();
  await expect(inline.getByRole("tab", { name: /^Headings/ })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // "Start creating" on the last step closes it the same way.
  await page.evaluate(() => localStorage.removeItem("cd-create-tour-seen"));
  await page.reload();
  await expect(tour).toBeVisible();
  await tour.getByRole("tab", { name: /^Questions/ }).click();
  await tour.getByRole("button", { name: "Start creating" }).click();
  await expect(tour).toHaveCount(0);
  expect(errors).toEqual([]);
});
