const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const PAGES = ["/impressum.html", "/datenschutz.html"];

const IMPRESSUM_SECTIONS = [
  /Angaben gemäß § 5 DDG/i,
  /Kontakt/i,
  /Umsatzsteuer|Steuernummer/i,
  /Berufshaftpflicht/i,
  /Handwerkskammer/i,
  /zulassungsfreie[sn]? Handwerk/i,
  /§ 18 Abs\. 2 MStV/i,
  /Streitbeilegung|Streitschlichtung/i,
  /Haftung für Inhalte/i,
];

const DATENSCHUTZ_SECTIONS = [
  /Verantwortlich/i,
  /GitHub Pages/i,
  /Google Fonts/i,
  /Google Analytics/i,
  /Meta Pixel/i,
  /Server-Logfiles/i,
  /Ihre Rechte/i,
  /Widerruf/i,
  /Beschwerderecht/i,
];

test.describe("legal pages", () => {
  for (const path of PAGES) {
    test.describe(path, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(path);
      });

      test("is excluded from the index", async ({ page }) => {
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
          "content",
          /noindex/,
        );
      });

      test("declares a canonical url on the production host", async ({
        page,
      }) => {
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          "href",
          new RegExp(`^https://yg-powerclean\\.de${path.replace(".", "\\.")}$`),
        );
      });

      test("has exactly one heading and leads back to the start page", async ({
        page,
      }) => {
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator('a[href="index.html"]').first()).toBeVisible();
      });

      test("uses the same stylesheet as the start page", async ({ page }) => {
        await expect(page.locator('link[href="css/style.css"]')).toHaveCount(1);
      });

      test("marks every detail that is still missing", async ({ page }) => {
        const marked = page.locator("[data-placeholder]");
        expect(await marked.count()).toBeGreaterThan(0);
        await expect(page.locator(".placeholder-note")).toBeVisible();
      });
    });
  }

  test("impressum covers the mandatory sections", async ({ page }) => {
    await page.goto("/impressum.html");
    const text = await page.locator("main").innerText();
    for (const section of IMPRESSUM_SECTIONS) {
      expect(text, `fehlt: ${section}`).toMatch(section);
    }
  });

  test("impressum states the address the start page withholds", async ({
    page,
  }) => {
    await page.goto("/impressum.html");
    await expect(page.locator(".legal-address")).toBeVisible();
    await expect(page.locator(".legal-address")).toContainText("Tiller Straße 30a");
    await expect(page.locator(".legal-address")).toContainText("47546 Kalkar");
  });

  test("impressum does not link the shut down EU dispute platform", async ({
    page,
  }) => {
    await page.goto("/impressum.html");
    await expect(page.locator('a[href*="consumers/odr"]')).toHaveCount(0);
    await expect(page.locator('a[href*="ec.europa.eu"]')).toHaveCount(0);
  });

  test("impressum avoids claiming a licensed trade", async ({ page }) => {
    await page.goto("/impressum.html");
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/Gebäudereinigermeister|Meisterbetrieb/i);
  });

  test("privacy policy covers every processing described in the code", async ({
    page,
  }) => {
    await page.goto("/datenschutz.html");
    const text = await page.locator("main").innerText();
    for (const section of DATENSCHUTZ_SECTIONS) {
      expect(text, `fehlt: ${section}`).toMatch(section);
    }
  });

  test("privacy policy claims no setting the code does not make", async ({
    page,
  }) => {
    const script = readFileSync(
      resolve(__dirname, "..", "js", "main.js"),
      "utf-8",
    );
    await page.goto("/datenschutz.html");
    const text = await page.locator("main").innerText();

    const claimsAnonymisation = /IP-Anonymisierung ist aktiviert/i.test(text);
    const setsAnonymisation = /anonymize_ip/.test(script);
    expect(
      claimsAnonymisation,
      "anonymize_ip ist ein GA3-Parameter, GA4 ignoriert ihn",
    ).toBe(setsAnonymisation);
  });

  test("impressum claims no conferred professional title", async ({ page }) => {
    await page.goto("/impressum.html");
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/Verliehen in/i);
    expect(text).not.toMatch(/zulassungspflichtig/i);
    expect(text).toMatch(/Anlage B Abschnitt 1 Nummer 33/);
  });

  test("privacy policy names the consent cookie used by the banner", async ({
    page,
  }) => {
    await page.goto("/datenschutz.html");
    await expect(page.locator("main")).toContainText("yg_cookie_consent");
  });

  test("legal pages are reachable from the start page footer", async ({
    page,
  }) => {
    await page.goto("/");
    for (const path of PAGES) {
      await expect(
        page.locator(`.site-footer__links a[href="${path.slice(1)}"]`),
      ).toHaveCount(1);
    }
  });
});
