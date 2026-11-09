const { test, expect } = require("@playwright/test");

const CATEGORIES = [
  "Haushalts- und Wohnungsreinigung",
  "Fenster- und Glasreinigung",
  "Büro- und Gewerbereinigung",
  "Treppenhaus- und Flurreinigung",
  "Außenflächen- und Hochdruckreinigung",
  "Restaurants und Gasträume",
  "Reinigung nach Umzug und Renovierung",
  "Regelmäßige Reinigungsdienste",
];

test.describe("services", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows the eight categories from the flyer in order", async ({
    page,
  }) => {
    const titles = page.locator("#leistungen .service-card h3");
    await expect(titles).toHaveCount(8);
    expect(await titles.allInnerTexts()).toEqual(CATEGORIES);
  });

  test("every card carries an icon and at least four services", async ({
    page,
  }) => {
    const cards = page.locator("#leistungen .service-card");
    for (let index = 0; index < (await cards.count()); index += 1) {
      const card = cards.nth(index);
      await expect(card.locator("svg.pc-icon")).toHaveCount(1);
      expect(
        await card.locator(".pc-check-list li").count(),
        `Karte ${index + 1} hat zu wenige Positionen`,
      ).toBeGreaterThanOrEqual(4);
    }
  });

  test("no service is hidden behind a disclosure widget", async ({ page }) => {
    await expect(page.locator("#leistungen details")).toHaveCount(0);
    const hidden = await page
      .locator("#leistungen .pc-check-list li")
      .evaluateAll((items) =>
        items.filter((item) => item.offsetParent === null).length,
      );
    expect(hidden).toBe(0);
  });
});

test.describe("grid", () => {
  test("stays even when categories are added or removed", async ({ page }) => {
    await page.goto("/");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => {
      document
        .querySelectorAll("#leistungen .service-card")
        .forEach((card, index) => {
          if (index >= 6) card.remove();
        });
    });
    const cards = page.locator("#leistungen .service-card");
    await expect(cards).toHaveCount(6);
    const widths = await cards.evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().width)),
    );
    expect(new Set(widths).size).toBe(1);
  });
});

test.describe("without javascript", () => {
  test.use({ javaScriptEnabled: false });

  test("every service stays readable", async ({ page }) => {
    await page.goto("/");
    const items = page.locator("#leistungen .pc-check-list li");
    expect(await items.count()).toBeGreaterThanOrEqual(40);
    await expect(items.first()).toBeVisible();
    await expect(items.last()).toBeVisible();
  });

  test("all eight categories are present", async ({ page }) => {
    await page.goto("/");
    const titles = page.locator("#leistungen .service-card h3");
    await expect(titles).toHaveCount(8);
    expect(await titles.allInnerTexts()).toEqual(CATEGORIES);
  });

  test("the scroll animation hides nothing", async ({ page }) => {
    await page.goto("/");
    const opacities = await page
      .locator(".animate-on-scroll")
      .evaluateAll((nodes) =>
        nodes.map((node) => parseFloat(getComputedStyle(node).opacity)),
      );
    expect(opacities.length).toBeGreaterThan(0);
    expect(opacities.every((value) => value === 1)).toBe(true);
  });
});
