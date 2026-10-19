import { test, expect, type Page } from "@playwright/test";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const email =
  process.env.E2E_FEATURE_EMAIL || `features-${randomUUID()}@campusdeck.test`;
const password = process.env.E2E_PASSWORD || "Feature-test-password-2026!";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2H1v8AAAAASUVORK5CYII=",
  "base64",
);

async function exportPptx(page: Page, target: string) {
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "PowerPoint (.pptx) Fully editable text, shapes & charts",
    })
    .click();
  await (await pending).saveAs(target);
  return JSZip.loadAsync(await readFile(target));
}

test("every published design downloads a real editable PowerPoint with its advertised slide count", async ({
  page,
  request,
}) => {
  test.setTimeout(300000);
  const response = await request.get("/api/templates");
  expect(response.ok()).toBeTruthy();
  const templates = await response.json();
  expect(
    templates.filter(
      (t: { id: string; handoffId?: string; starter?: boolean }) =>
        t.handoffId === t.id && !t.starter,
    ),
  ).toHaveLength(41);
  expect(
    templates.filter((t: { starter?: boolean }) => t.starter),
  ).toHaveLength(1);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const template of templates.filter(
    (t: { premium: boolean; id: string; starter?: boolean }) =>
      !t.premium && !t.starter && !t.id.startsWith("custom-"),
  )) {
    await test.step(template.name, async () => {
      await page.goto(`/templates/${template.id}`);
      await expect(
        page.getByRole("heading", { name: template.name, exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Download", exact: true }).click();
      const pending = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download PowerPoint", exact: true })
        .click();
      const file = await pending;
      expect(file.suggestedFilename()).toMatch(/\.pptx$/);
      const path = `artifacts/all-designs/${template.id}.pptx`;
      await file.saveAs(path);
      const zip = await JSZip.loadAsync(await readFile(path));
      expect(
        Object.keys(zip.files).filter((p) =>
          /^ppt\/slides\/slide\d+\.xml$/.test(p),
        ),
      ).toHaveLength(template.slides);
      expect(
        await zip.file("ppt/slides/slide1.xml")!.async("string"),
      ).toContain("<a:t>");
      expect(
        Object.keys(zip.files).some((p) =>
          /^ppt\/charts\/chart\d+\.xml$/.test(p),
        ),
      ).toBeTruthy();
      expect(
        Object.keys(zip.files).some((p) => p.endsWith(".xlsx")),
      ).toBeTruthy();
    });
  }
  expect(errors).toEqual([]);
});

test("profile, bookmarks, cloud save, repeat login, rename, duplicate, history and delete", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/auth?mode=register");
  await page
    .getByLabel("Your name", { exact: true })
    .fill("Feature Verification");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create your account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hello, Feature." }),
  ).toBeVisible();
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "campus_session",
  );
  expect(cookie?.httpOnly).toBeTruthy();
  expect(cookie?.sameSite).toBe("Lax");
  if (process.env.E2E_BASE_URL?.startsWith("https:"))
    expect(cookie?.secure).toBeTruthy();
  await page
    .getByRole("button", { name: "Academic profile", exact: true })
    .click();
  await page
    .getByLabel("College / organisation", { exact: true })
    .fill("Verification College");
  await page
    .getByLabel("Student / team names", { exact: true })
    .fill("Verification Student");
  await page.getByLabel("Department", { exact: true }).fill("Computer Science");
  await page
    .getByLabel("Degree / course", { exact: true })
    .fill("B".repeat(150));
  await page
    .getByLabel("Guide / supervisor", { exact: true })
    .fill("G".repeat(150));
  await page
    .getByLabel("Upload profile logo")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText("College logo")).toBeVisible();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "academic profile is saved",
  );
  await page.reload();
  await expect(
    page.getByLabel("College / organisation", { exact: true }),
  ).toHaveValue("Verification College");
  await expect(page.getByLabel("Degree / course", { exact: true })).toHaveValue(
    "B".repeat(80),
  );
  await expect(
    page.getByLabel("Guide / supervisor", { exact: true }),
  ).toHaveValue("G".repeat(100));
  await page.goto("/templates?q=Meridian");
  await page
    .getByRole("button", { name: "Save Meridian", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Remove Meridian from saved",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/workspace?tab=saved");
  await expect(
    page.getByRole("heading", { name: "Meridian", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove Meridian from saved", exact: true })
    .click();
  await expect(page.locator(".cd-template-card")).toHaveCount(0);
  await page.goto("/customise/the-final-year");
  await expect(page.getByLabel("College / organisation name")).toHaveValue(
    "Verification College",
  );
  await page
    .getByLabel("Presentation title", { exact: true })
    .fill("Workspace Verification");
  await page
    .getByRole("button", { name: "I’ll add the details in the editor" })
    .click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Heading", { exact: true })
    .fill("Persistent cloud content");
  await page.getByLabel("Academic year", { exact: true }).fill("2".repeat(100));
  await expect(page.getByLabel("Academic year", { exact: true })).toHaveValue(
    "2".repeat(30),
  );
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  const editorUrl = page.url();
  const projectId = editorUrl.split("/").pop()!;
  const exported = await exportPptx(page, "artifacts/workspace-export.pptx");
  const cover = await exported.file("ppt/slides/slide1.xml")!.async("string");
  expect(
    [...cover.matchAll(/<a:t>(.*?)<\/a:t>/gs)].map((m) => m[1]).join(" "),
  ).toContain("Persistent cloud content");
  expect(cover).toContain("Verification College");
  expect(
    Object.keys(exported.files).some(
      (p) => p.startsWith("ppt/media/") && p.endsWith(".png"),
    ),
  ).toBeTruthy();
  await page
    .getByRole("link", { name: "Back to workspace", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Actions for Workspace Verification",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page
    .getByLabel("Presentation name", { exact: true })
    .fill("Renamed Verification");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await page
    .getByRole("heading", { name: "Renamed Verification", exact: true })
    .click();
  await expect(
    page.getByLabel("Presentation name", { exact: true }),
  ).toHaveValue("Renamed Verification");
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Back to workspace", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Actions for Renamed Verification",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Renamed Verification (copy)",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "My presentations" }).click();
  await page.getByLabel("Search your presentations").fill("(copy)");
  await expect(page.locator(".project-card")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Actions for Renamed Verification (copy)",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete presentation", exact: true })
    .click();
  await expect(page.locator(".project-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Downloads", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download again", exact: true })
    .first()
    .click();
  await (await pending).saveAs("artifacts/history-export.pptx");
  const historical = await JSZip.loadAsync(
    await readFile("artifacts/history-export.pptx"),
  );
  expect(await historical.file("ppt/slides/slide1.xml")!.async("string")).toBe(
    cover,
  );
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect
    .poll(async () =>
      (await page.request.get("/api/me")).json().then((b) => b.user),
    )
    .toBeNull();
  expect((await page.request.get(`/api/projects/${projectId}`)).status()).toBe(
    401,
  );

  // A new browser has neither the old cookies nor the editor's local draft.
  const fresh = await browser.newContext({
    baseURL: new URL(editorUrl).origin,
  });
  try {
    const another = await fresh.newPage();
    await another.goto("/auth");
    await another.getByLabel("Email address", { exact: true }).fill(email);
    await another.getByLabel("Password", { exact: true }).fill(password);
    await another.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      another.getByRole("heading", {
        name: "Renamed Verification",
        exact: true,
      }),
    ).toBeVisible();
    await another
      .getByRole("heading", { name: "Renamed Verification", exact: true })
      .click();
    await expect(another.getByLabel("Heading", { exact: true })).toHaveValue(
      "Persistent cloud content",
    );
    await expect(
      another.getByText("All changes saved", { exact: true }),
    ).toBeVisible();

    // A blank presentation follows the same real account persistence path.
    await another.goto("/editor/blank");
    await expect(another.getByLabel("Heading", { exact: true })).toHaveValue(
      "",
    );
    await expect(another.locator(".slides-list > button")).toHaveCount(1);
    await another
      .getByLabel("Presentation name", { exact: true })
      .fill("Blank Cloud Verification");
    await another
      .getByLabel("Heading", { exact: true })
      .fill("Blank cloud content");
    await another
      .getByLabel("Content", { exact: true })
      .fill("Saved from an empty slide.\nStill editable after sign-in.");
    await expect(
      another.getByText("All changes saved", { exact: true }),
    ).toBeVisible();
    const blankUrl = another.url();
    const blankId = blankUrl.split("/").pop()!;
    const blankExport = await exportPptx(another, "artifacts/blank-cloud.pptx");
    const blankXml = await blankExport
      .file("ppt/slides/slide1.xml")!
      .async("string");
    expect(blankXml).toContain("Blank cloud content");
    expect(blankXml).toContain("Still editable after sign-in.");
    expect(
      Object.keys(blankExport.files).filter((path) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(path),
      ),
    ).toHaveLength(1);
    await another.reload();
    await expect(another.getByLabel("Heading", { exact: true })).toHaveValue(
      "Blank cloud content",
    );
    const cleanBrowser = await browser.newContext({
      baseURL: new URL(blankUrl).origin,
    });
    try {
      const restored = await cleanBrowser.newPage();
      await restored.goto(
        "/sign-in?returnTo=" + encodeURIComponent("/editor/" + blankId),
      );
      await restored.getByLabel("Email address", { exact: true }).fill(email);
      await restored.getByLabel("Password", { exact: true }).fill(password);
      await restored
        .getByRole("button", { name: "Sign in", exact: true })
        .click();
      await expect(restored.getByLabel("Heading", { exact: true })).toHaveValue(
        "Blank cloud content",
      );
      await expect(restored.getByLabel("Content", { exact: true })).toHaveValue(
        "Saved from an empty slide.\nStill editable after sign-in.",
      );
      await expect(restored.locator(".slides-list > button")).toHaveCount(1);
      await expect(
        restored.getByText("All changes saved", { exact: true }),
      ).toBeVisible();
      await restored
        .getByRole("link", { name: "Back to workspace", exact: true })
        .click();
      await restored
        .getByRole("button", {
          name: "Actions for Blank Cloud Verification",
          exact: true,
        })
        .click();
      await restored
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      await restored
        .getByRole("button", { name: "Delete presentation", exact: true })
        .click();
      await expect(
        restored.getByRole("heading", {
          name: "Blank Cloud Verification",
          exact: true,
        }),
      ).toHaveCount(0);
      expect(
        (await restored.request.get("/api/projects/" + blankId)).status(),
      ).toBe(404);
    } finally {
      await cleanBrowser.close();
    }
  } finally {
    await fresh.close();
  }
  await page.goto("/contact");
  await page
    .getByLabel("Your name", { exact: true })
    .fill("Feature Verification");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Automated verification: contact form persistence check.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your message has been saved." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("native tables, charts, images, notes and Unicode survive editor exports", async ({
  page,
}) => {
  await page.goto("/customise/neural");
  await page
    .getByRole("button", { name: "I’ll add the details in the editor" })
    .click();
  await page.getByLabel("Heading", { exact: true }).fill("வணக்கம் CampusDeck");
  await page.getByRole("button", { name: "Add slide", exact: true }).click();
  await page
    .getByRole("dialog")
    .locator(".layout-picker button")
    .filter({ has: page.getByText("table", { exact: true }) })
    .click();
  await page
    .getByLabel("Row 1, column 1", { exact: true })
    .fill("Verified table");
  await page.getByRole("button", { name: "+ Row", exact: true }).click();
  await page.getByRole("button", { name: "+ Column", exact: true }).click();
  await page.getByRole("button", { name: "Add slide", exact: true }).click();
  await page
    .getByRole("dialog")
    .locator(".layout-picker button")
    .filter({ has: page.getByText("chart", { exact: true }) })
    .click();
  await page
    .getByLabel("Data label 1", { exact: true })
    .fill("Verified metric");
  await page.getByLabel("Data value 1", { exact: true }).fill("94");
  await page
    .getByRole("button", { name: "+ Add data point", exact: true })
    .click();
  await page.getByRole("button", { name: "Add slide", exact: true }).click();
  await page
    .getByRole("dialog")
    .locator(".layout-picker button")
    .filter({ has: page.getByText("image", { exact: true }) })
    .click();
  await page
    .getByLabel("Upload slide image")
    .setInputFiles({ name: "diagram.png", mimeType: "image/png", buffer: png });
  await expect(
    page.getByRole("button", { name: "Remove image", exact: true }),
  ).toBeVisible();
  await page.locator(".speaker-notes summary").click();
  await page
    .getByLabel("Speaker notes", { exact: true })
    .fill("Verified presenter notes");
  const zip = await exportPptx(page, "artifacts/data-editor.pptx");
  expect(
    Object.keys(zip.files).filter((p) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(p),
    ),
  ).toHaveLength(19);
  expect(await zip.file("ppt/slides/slide1.xml")!.async("string")).toContain(
    "வணக்கம்",
  );
  expect(await zip.file("ppt/slides/slide2.xml")!.async("string")).toContain(
    "Verified table",
  );
  const charts = await Promise.all(
    Object.keys(zip.files)
      .filter((p) => /^ppt\/charts\/chart\d+\.xml$/.test(p))
      .map((p) => zip.file(p)!.async("string")),
  );
  expect(charts.join(" ")).toContain("Verified metric");
  expect(charts.join(" ")).toContain("94");
  expect(
    await zip.file("ppt/notesSlides/notesSlide4.xml")!.async("string"),
  ).toContain("Verified presenter notes");
  expect(
    Object.keys(zip.files).some(
      (p) => p.startsWith("ppt/media/") && p.endsWith(".png"),
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Download", exact: true }).click();
  await page
    .getByRole("button", { name: "PDF document Ready to share and print" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "PDF currently supports Latin text.",
  );
});

test("public deep links, help, legal pages, unknown routes and admin access", async ({
  page,
  request,
}) => {
  for (const path of ["/about", "/help", "/contact", "/privacy", "/terms"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      "Something needs a fresh start",
    );
    await page.reload();
    await expect(page.locator("h1")).toBeVisible();
  }
  await page.goto("/admin");
  expect((await request.get("/api/admin/users")).status()).toBe(401);
  await expect(page.locator("body")).not.toContainText(
    "A considered collection.",
  );
  await page.goto("/page-that-does-not-exist");
  await expect(page.locator("h1")).toContainText(/not|find|lost|page/i);
  const assets = [
    ["/robots.txt", "text/plain"],
    ["/favicon.svg", "svg"],
  ];
  if (process.env.E2E_BASE_URL)
    assets.push(["/sitemap.xml", "xml"], ["/og.svg", "svg"]);
  for (const [path, type] of assets) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toContain(type);
  }
});
