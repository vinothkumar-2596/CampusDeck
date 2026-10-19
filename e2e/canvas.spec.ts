import { test, expect } from "@playwright/test";

test("text is edited on the slide itself, with list, undo and keyboard support", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/editor/meridian");
  const panelHeading = page
    .locator(".inspector")
    .getByLabel("Heading", { exact: true });
  await expect(panelHeading).toBeVisible();
  const original = await panelHeading.inputValue();

  // Select, then edit in place; the panel follows along.
  const heading = page.locator('[data-region="title"]');
  await heading.click();
  await expect(heading).toHaveClass(/is-selected/);
  await expect(
    page.getByRole("toolbar", { name: "Heading tools" }),
  ).toBeVisible();
  await heading.dblclick();
  const field = page.getByRole("textbox", { name: "Heading, on the slide" });
  await expect(field).toBeFocused();
  await field.fill("Edited on the artboard");
  await expect(panelHeading).toHaveValue("Edited on the artboard");
  await expect(page.locator(".editor-canvas svg")).toHaveAttribute(
    "aria-label",
    "Edited on the artboard",
  );
  await page.keyboard.press("Escape");
  await expect(field).toHaveCount(0);

  // One undo reverts the whole run of typing.
  await page.keyboard.press("Escape");
  await page.locator("body").press("Control+z");
  await expect(panelHeading).toHaveValue(original);
  await page.locator("body").press("Control+Shift+z");
  await expect(panelHeading).toHaveValue("Edited on the artboard");

  // Lists: Enter starts a new point right where the caret is.
  for (let i = 0; i < 3; i++) await page.locator("body").press("PageDown");
  await expect(page.locator(".canvas-bottom span").first()).toContainText(
    "Slide 4",
  );
  const before = await page
    .locator(".inspector")
    .getByLabel("Content", { exact: true })
    .inputValue();
  await page.locator('[data-region="body.0"]').dblclick();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("A point typed on the slide");
  await expect(page.locator(".cd-region.is-editing")).toHaveAttribute(
    "data-region",
    "body.1",
  );
  const lines = (
    await page
      .locator(".inspector")
      .getByLabel("Content", { exact: true })
      .inputValue()
  ).split("\n");
  expect(lines[1]).toBe("A point typed on the slide");
  expect(lines.length).toBe(before.split("\n").length + 1);
  await page.keyboard.press("Escape");

  // The canvas keeps a single slide drawing, and nothing errors.
  await expect(page.locator(".editor-canvas svg")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("blank slides take typing straight onto their placeholders", async ({
  page,
}) => {
  await page.goto("/editor/blank");
  const heading = page.locator('[data-region="title"]');
  await expect(heading).toHaveAttribute("data-ghost", "Click to add heading");
  await heading.dblclick();
  await page.keyboard.type("Typed on a blank slide");
  await page.keyboard.press("Tab");
  await page.keyboard.type("With a subtitle");
  await page.keyboard.press("Escape");
  const panel = page.locator(".inspector");
  await expect(panel.getByLabel("Heading", { exact: true })).toHaveValue(
    "Typed on a blank slide",
  );
  await expect(
    panel.getByLabel("Subtitle / label", { exact: true }),
  ).toHaveValue("With a subtitle");
});
