import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

test("new category routes, filters, URL restoration, keyboard menus and header search", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/templates");
  await expect(page.locator(".cd-results-count")).toContainText("41 templates");
  await expect(
    page.locator(".cd-market-results .cd-template-card"),
  ).toHaveCount(12);
  await page
    .getByRole("button", { name: "Show more templates", exact: true })
    .click();
  await expect(
    page.locator(".cd-market-results .cd-template-card"),
  ).toHaveCount(24);
  await page
    .getByRole("button", { name: "Compact cards", exact: true })
    .click();
  await expect(
    page.locator(".cd-market-results .cd-template-grid"),
  ).toHaveClass(/cd-compact-grid/);
  await page.getByRole("button", { name: "College 22", exact: true }).click();
  await expect(
    page.locator(".cd-market-results .cd-template-card"),
  ).toHaveCount(12);
  await page
    .getByRole("button", { name: "Project Review", exact: true })
    .click();
  await expect(page.locator(".cd-results-count")).toContainText(
    "2 templates in College",
  );
  await page
    .getByRole("combobox", { name: "Sort templates" })
    .selectOption("az");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Project Review", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Sort templates" }),
  ).toHaveValue("az");
  await expect(page.locator(".cd-results-count")).toContainText(
    "22 templates in College",
  );
  const categoryCounts = {
    college: 22,
    corporate: 5,
    business: 5,
    healthcare: 3,
    research: 3,
    events: 3,
  };
  for (const [category, count] of Object.entries(categoryCounts)) {
    await page.goto("/" + category);
    await expect(page.locator(".cd-results-count")).toContainText(
      `${count} templates`,
    );
    await expect(page.locator(".cd-showcase-grid")).toBeVisible();
    await expect(
      page.locator(".cd-market-results .cd-template-card"),
    ).toHaveCount(Math.min(count, 12));
  }
  await page.goto("/healthcare?q=review");
  await expect(
    page.getByRole("heading", { name: "No templates match these filters" }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("textbox", { name: "Search all templates", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("textbox", { name: "Search all templates", exact: true })
    .fill("meridian");
  await page
    .getByRole("link", { name: "Search all templates for “meridian”" })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Search templates", exact: true }),
  ).toHaveValue("meridian");
  await expect(
    page.locator(".cd-market-results .cd-template-card"),
  ).toHaveCount(1);
  const collegeMenu = page.getByRole("button", {
    name: "College PPTs",
    exact: true,
  });
  await collegeMenu.focus();
  await expect(collegeMenu).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(collegeMenu).toHaveAttribute("aria-expanded", "false");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open menu", exact: true }),
  ).toBeFocused();
  await page.goto("/college?dept=cse&style=Academic");
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(
    page.getByRole("checkbox", { name: /^Computer Science/ }),
  ).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /^Academic/ })).toBeChecked();
  await expect(page.locator(".cd-results-count")).toContainText("2 templates");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("theme carries into the editor, design changes preserve content, sample reset undoes, and exports remain editable", async ({
  page,
}) => {
  await page.goto("/templates/meridian");
  await page.getByRole("radio", { name: "Teal", exact: true }).click();
  await expect(page).toHaveURL(/theme=1/);
  await expect(
    page.locator(".cd-detail-stage > svg > rect").first(),
  ).toHaveAttribute("fill", "#0B3B3A");
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "Teal", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("link", { name: "Customise this template", exact: true })
    .click();
  await expect(page.locator(".editor-deck-meta")).toContainText(
    "Meridian · Teal theme · 17 slides",
  );
  await page
    .getByLabel("Heading", { exact: true })
    .fill("Design changes keep this title");
  await page
    .getByLabel("Student / team names", { exact: true })
    .fill("Asha QA, Ravi QA");
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await page
    .getByRole("button", { name: "Use design Kepler", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Use design Kepler", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".editor-canvas .slide-view")).toHaveAttribute(
    "aria-label",
    "Design changes keep this title",
  );
  await expect(page.locator(".slides-heading")).toContainText("17");
  await page
    .getByRole("button", { name: "Use theme Amber", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Headline typeface", exact: true })
    .selectOption("serif");
  await page.getByRole("tab", { name: "Content", exact: true }).click();
  await expect(
    page.getByLabel("Student / team names", { exact: true }),
  ).toHaveValue("Asha QA, Ravi QA");
  await page.getByRole("button", { name: "Sample text", exact: true }).click();
  await page
    .getByRole("button", { name: "Restore sample text", exact: true })
    .click();
  await expect(page.getByLabel("Heading", { exact: true })).not.toHaveValue(
    "Design changes keep this title",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "Design changes keep this title",
  );
  await expect(
    page.getByLabel("Student / team names", { exact: true }),
  ).toHaveValue("Asha QA, Ravi QA");
  await page.getByRole("button", { name: "Present", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("dialog").locator(".preview-controls"),
  ).toContainText("2 / 17");
  await page.keyboard.press("PageDown");
  await expect(
    page.getByRole("dialog").locator(".preview-controls"),
  ).toContainText("3 / 17");
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("dialog").locator(".preview-controls"),
  ).toContainText("4 / 17");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator(".editor-deck-meta")).toContainText(
    "Kepler · Amber theme · 17 slides",
  );
  await expect(page.getByLabel("Heading", { exact: true })).toHaveValue(
    "Design changes keep this title",
  );
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "PowerPoint (.pptx) Fully editable text, shapes & charts",
    })
    .click();
  const file = await pending;
  const zip = await JSZip.loadAsync(await readFile((await file.path())!));
  const cover = await zip.file("ppt/slides/slide1.xml")!.async("string");
  expect(
    [...cover.matchAll(/<a:t>(.*?)<\/a:t>/gs)]
      .map((match) => match[1])
      .join(" "),
  ).toContain("Design changes keep this title");
  expect(cover).toContain("Instrument Serif");
  expect(cover).toContain("FFB547");
  expect(
    Object.keys(zip.files).filter((path) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(path),
    ),
  ).toHaveLength(17);
});

test("redesigned public pages and editor meet serious accessibility checks and responsive bounds", async ({
  page,
}, testInfo) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const routes = [
    "/",
    "/templates",
    "/college",
    "/corporate",
    "/business",
    "/healthcare",
    "/research",
    "/events",
    "/templates/meridian",
    "/how-it-works",
    "/create",
    "/sign-in",
    "/sign-up",
    "/editor/meridian",
    "/editor/blank",
    "/customise/the-final-year",
    "/about",
    "/help",
    "/contact",
    "/privacy",
    "/terms",
  ];
  for (const path of routes) {
    await test.step(path, async () => {
      await page.goto(path);
      await expect(page.locator(".loading-state")).toHaveCount(0);
      if (path.startsWith("/editor/"))
        await expect(page.getByLabel("Heading", { exact: true })).toBeVisible();
      else await expect(page.locator("h1")).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const violations = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact || ""),
      );
      if (violations.length)
        await testInfo.attach("accessibility-" + path.replace(/\W+/g, "-"), {
          body: JSON.stringify(violations, null, 2),
          contentType: "application/json",
        });
      expect
        .soft(
          violations.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            targets: violation.nodes.map((node) => node.target),
          })),
          path,
        )
        .toEqual([]);
    });
  }
  for (const width of [360, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/create",
      "/templates",
      "/college",
      "/templates/meridian",
      "/editor/meridian",
      "/editor/blank",
    ]) {
      await page.goto(path);
      await expect(page.locator(".loading-state")).toHaveCount(0);
      if (path.startsWith("/editor"))
        await expect(page.getByLabel("Heading", { exact: true })).toBeVisible();
      else await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${path} at ${width}px`,
      ).toBeTruthy();
    }
  }
  expect(errors).toEqual([]);
});
