import { test, expect, type Page, type Download } from "@playwright/test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import AxeBuilder from "@axe-core/playwright";

const exportChunk = /\/assets\/export-[^/]+\.js(?:\?|$)/;
const pdfChunk = /\/assets\/jspdf\.es\.min-[^/]+\.js(?:\?|$)/;
const routeChunk = /\/assets\/Explore-[^/]+\.js(?:\?|$)/;
const recoveryTitle = "Saved Vertex";

async function missingChunk(page: Page, pattern: RegExp, persistent = false) {
  let failures = 0;
  await page.route(pattern, async (route) => {
    if (persistent || failures === 0) {
      failures++;
      await route.fulfill({
        status: 404,
        contentType: "text/plain",
        body: "This deployment asset no longer exists.",
      });
    } else {
      await route.continue();
    }
  });
  return () => failures;
}

function navigationCounter(page: Page) {
  let count = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      count++;
  });
  return () => count;
}

async function editVertex(page: Page) {
  await page.goto("/editor/vertex?theme=1");
  await expect(page.getByLabel("Heading", { exact: true })).toBeVisible();
  await page.getByLabel("Heading", { exact: true }).fill(recoveryTitle);
  await page
    .getByLabel("Presentation name", { exact: true })
    .fill("Vertex recovery verification");
  await page
    .getByLabel("Student / team names", { exact: true })
    .fill("Recovery Student");
  await page
    .getByLabel("College / organisation", { exact: true })
    .fill("Recovery College");
  const meta = await page.locator(".editor-deck-meta").innerText();
  const count = await page.locator(".slides-list > button").count();
  return { url: page.url(), meta, count };
}

async function chooseDownload(page: Page, format: "pptx" | "pdf") {
  await page.getByRole("button", { name: "Download", exact: true }).click();
  await page
    .getByRole("button", {
      name:
        format === "pptx"
          ? "PowerPoint (.pptx) Fully editable text, shapes & charts"
          : "PDF document Ready to share and print",
    })
    .click();
}

async function verifyFile(
  file: Download,
  format: "pptx" | "pdf",
  count: number,
) {
  expect(file.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
  const bytes = await readFile((await file.path())!);
  expect(bytes.length).toBeGreaterThan(1000);
  if (format === "pdf") {
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const source = bytes.toString("latin1");
    expect(source.toLowerCase()).toContain(recoveryTitle.toLowerCase());
    expect(source).toContain("Recovery Student");
    expect((source.match(/\/Type \/Page\b/g) || []).length).toBe(count);
  } else {
    const zip = await JSZip.loadAsync(bytes);
    const slides = Object.keys(zip.files).filter((path) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(path),
    );
    expect(slides).toHaveLength(count);
    const cover = await zip.file("ppt/slides/slide1.xml")!.async("string");
    const text = [...cover.matchAll(/<a:t>(.*?)<\/a:t>/gs)]
      .map((part) => part[1])
      .join(" ");
    expect(text.toLowerCase()).toContain(recoveryTitle.toLowerCase());
    expect(text.toLowerCase()).toContain("recovery student");
    expect(cover).toContain("Recovery College");
    expect(
      Object.keys(zip.files).some((path) =>
        /^ppt\/charts\/chart\d+\.xml$/.test(path),
      ),
    ).toBeTruthy();
  }
}

for (const format of ["pdf", "pptx"] as const) {
  test(`Vertex ${format.toUpperCase()} recovery preserves the exact guest draft and resumes one download`, async ({
    page,
  }) => {
    const failures = await missingChunk(page, exportChunk);
    const draft = await editVertex(page);
    const navigations = navigationCounter(page);
    let downloads = 0;
    page.on("download", () => downloads++);
    await chooseDownload(page, format);
    await expect(
      page.getByRole("heading", { name: "Finish your download", exact: true }),
    ).toBeVisible();
    const accessibility = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      accessibility.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact || ""),
      ),
    ).toEqual([]);
    expect(failures()).toBe(1);
    expect(navigations()).toBe(0);
    expect(downloads).toBe(0);
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Reload and download", exact: true })
      .click();
    await verifyFile(await pending, format, draft.count);
    await expect(page).toHaveURL(draft.url);
    await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
      recoveryTitle,
    );
    await expect(
      page.getByLabel("Student / team names", { exact: true }),
    ).toHaveValue("Recovery Student");
    await expect(page.locator(".editor-deck-meta")).toHaveText(draft.meta);
    expect(navigations()).toBe(1);
    expect(downloads).toBe(1);
    // The pending request must be consumed so a later normal reload does not download again.
    await page.reload();
    await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
      recoveryTitle,
    );
    await expect(
      page.getByRole("button", { name: "Download", exact: true }),
    ).toBeEnabled();
    expect(downloads).toBe(1);
  });
}

test("a missing nested PDF module recovers without losing Vertex edits", async ({
  page,
}) => {
  const failures = await missingChunk(page, pdfChunk);
  const draft = await editVertex(page);
  await chooseDownload(page, "pdf");
  await expect(
    page.getByRole("heading", { name: "Finish your download", exact: true }),
  ).toBeVisible();
  expect(failures()).toBe(1);
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Reload and download", exact: true })
    .click();
  await verifyFile(await pending, "pdf", draft.count);
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    recoveryTitle,
  );
});

test("a missing route module offers a refresh and keeps the existing guest draft", async ({
  page,
}) => {
  const failures = await missingChunk(page, routeChunk);
  const draft = await editVertex(page);
  await page
    .getByRole("link", { name: "CampusDeck home", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Explore Templates", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", {
      name: "This page needs a refresh",
      exact: true,
    }),
  ).toBeVisible();
  expect(failures()).toBe(1);
  const navigations = navigationCounter(page);
  await page
    .getByRole("button", { name: "Reload CampusDeck", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Explore templates", exact: true }),
  ).toBeVisible();
  expect(navigations()).toBe(1);
  await page.goto(draft.url);
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    recoveryTitle,
  );
  await expect(
    page.getByLabel("Student / team names", { exact: true }),
  ).toHaveValue("Recovery Student");
  await expect(page.locator(".editor-deck-meta")).toHaveText(draft.meta);
});

test("a persistently missing export stays recoverable without automatic reload or download loops", async ({
  page,
}) => {
  const failures = await missingChunk(page, exportChunk, true);
  await editVertex(page);
  const navigations = navigationCounter(page);
  let downloads = 0;
  page.on("download", () => downloads++);
  await chooseDownload(page, "pdf");
  await expect(
    page.getByRole("heading", { name: "Finish your download", exact: true }),
  ).toBeVisible();
  expect(navigations()).toBe(0);
  await page
    .getByRole("button", { name: "Reload and download", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Finish your download", exact: true }),
  ).toBeVisible();
  expect(failures()).toBe(2);
  expect(navigations()).toBe(1);
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await page
    .getByLabel("Heading", { exact: true })
    .fill("Still editing after a failed recovery");
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "Still editing after a failed recovery",
  );
  expect(navigations()).toBe(1);
  expect(downloads).toBe(0);
  // Keeping the editor open cancels the recovery intent; ordinary reload stays in the editor.
  await page.reload();
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "Still editing after a failed recovery",
  );
  await expect(
    page.getByRole("heading", { name: "Finish your download", exact: true }),
  ).toHaveCount(0);
  expect(failures()).toBe(2);
});

test("download history failure does not prevent the completed Vertex PDF from reaching the user", async ({
  page,
}) => {
  let failedHistory = 0;
  await page.route("**/api/downloads", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    failedHistory++;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "History temporarily unavailable" }),
    });
  });
  const draft = await editVertex(page);
  const pending = page.waitForEvent("download");
  await chooseDownload(page, "pdf");
  await verifyFile(await pending, "pdf", draft.count);
  expect(failedHistory).toBe(1);
  await expect(page.getByRole("status")).toContainText(/downloaded/i);
  await expect(page.getByRole("status")).toContainText(/history/i);
  await expect(
    page.getByRole("heading", { name: "Finish your download", exact: true }),
  ).toHaveCount(0);
});
