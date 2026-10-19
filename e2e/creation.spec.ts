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

test("homepage presentation controls render real slides and continue into an editable guest deck", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const playground = page.getByRole("region", {
    name: "Interactive presentation preview",
    exact: true,
  });
  await expect(playground).toBeVisible();
  const title = playground.getByRole("textbox", {
    name: "Presentation title",
    exact: true,
  });
  await title.fill("My live presentation from the homepage");
  await expect(
    playground.locator(".cd-playground-stage .slide-view"),
  ).toHaveAttribute("aria-label", "My live presentation from the homepage");
  const backgrounds = new Set<string>();
  for (const name of ["Navy", "Teal", "Plum"]) {
    const theme = playground.getByRole("button", {
      name: `Use ${name} theme`,
      exact: true,
    });
    await theme.click();
    await expect(theme).toHaveAttribute("aria-pressed", "true");
    backgrounds.add(
      (await playground
        .locator(".cd-playground-stage svg > rect")
        .first()
        .getAttribute("fill"))!,
    );
  }
  expect(backgrounds.size).toBe(3);
  for (const design of ["Halcyon", "Meridian", "Kepler"]) {
    const button = playground.getByRole("button", {
      name: `Use ${design} design`,
      exact: true,
    });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(title).toHaveValue("My live presentation from the homepage");
    await expect(playground.locator(".cd-playground-status")).toContainText(
      design,
    );
  }
  await playground
    .getByRole("button", { name: "Use Amber theme", exact: true })
    .click();
  const previewTitles = new Set<string>();
  for (const name of ["problem", "results", "cover"]) {
    const button = playground.getByRole("button", {
      name: `Preview ${name} slide`,
      exact: true,
    });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    previewTitles.add(
      (await playground
        .locator(".cd-playground-stage .slide-view")
        .getAttribute("aria-label"))!,
    );
  }
  expect(previewTitles.size).toBe(3);
  await playground
    .getByRole("button", { name: "Preview results slide", exact: true })
    .click();
  await title.fill("A live title ready for PowerPoint");
  await expect(
    playground.getByRole("button", {
      name: "Preview cover slide",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await playground
    .getByRole("button", { name: "Continue editing", exact: true })
    .click();
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "A live title ready for PowerPoint",
  );
  await expect(
    page.getByLabel("Presentation name", { exact: true }),
  ).toHaveValue("A live title ready for PowerPoint");
  await expect(page.locator(".editor-deck-meta")).toContainText(
    "Kepler · Amber theme",
  );
  const slideCount = await page.locator(".slides-list > button").count();
  expect(slideCount).toBeGreaterThan(10);
  await page.reload();
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "A live title ready for PowerPoint",
  );
  await expect(page.locator(".editor-deck-meta")).toContainText(
    "Kepler · Amber theme",
  );
  const zip = await JSZip.loadAsync(await downloadEditor(page, "pptx"));
  expect(slidePaths(zip)).toHaveLength(slideCount);
  const cover = await zip.file("ppt/slides/slide1.xml")!.async("string");
  expect(nativeText(cover)).toContain("A live title ready for PowerPoint");
  expect(cover).toContain("FFB547");
  expect(
    Object.keys(zip.files).some((path) =>
      /^ppt\/charts\/chart\d+\.xml$/.test(path),
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
