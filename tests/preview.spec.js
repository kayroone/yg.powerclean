const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { PREVIEW, PRODUCTION_ORIGIN } = require("./site-state");

const PAGES = ["/", "/impressum.html", "/datenschutz.html"];

test.describe("preview deployment", () => {
  test.skip(!PREVIEW, "Die Seite ist fuer die Domain freigegeben");

  for (const path of PAGES) {
    test(`${path} asks every crawler to stay out`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/i,
      );
    });
  }

  test("the custom domain stays out of the deployment", () => {
    const ignored = readFileSync(
      resolve(__dirname, "..", ".gitignore"),
      "utf-8",
    );
    expect(ignored).toMatch(/^\/CNAME$/m);
  });

  test("the start page still names the production url it is built for", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://www.yg-powerclean.de/",
    );
  });
});

test.describe("released deployment", () => {
  test.skip(PREVIEW, "Die Seite laeuft noch als Vorschau");

  test("the custom domain is part of the deployment again", async ({
    request,
  }) => {
    const ignored = readFileSync(
      resolve(__dirname, "..", ".gitignore"),
      "utf-8",
    );
    expect(ignored, "/CNAME steht noch in der .gitignore").not.toMatch(
      /^\/CNAME$/m,
    );

    const response = await request.get("/CNAME");
    expect(response.status()).toBe(200);
    expect(`https://${(await response.text()).trim()}`).toBe(PRODUCTION_ORIGIN);
  });
});
