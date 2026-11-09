const { test, expect } = require("@playwright/test");

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

test.describe("header", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("brand links back to the top of the page", async ({ page }) => {
    const brand = page.locator(".brand");
    await expect(brand).toHaveAttribute("href", "#top");
    await expect(brand.locator("svg")).toHaveCount(1);
    await expect(brand).toContainText("PowerClean");
  });

  test("primary navigation points at the page sections", async ({ page }) => {
    const links = page.locator("#primary-nav a");
    await expect(links).toHaveCount(3);
    const targets = await links.evaluateAll((items) =>
      items.map((item) => item.getAttribute("href")),
    );
    for (const href of targets) {
      expect(href).toMatch(/^#/);
      await expect(page.locator(href)).toHaveCount(1);
    }
  });

  test("skip link is the first focusable element", async ({ page }) => {
    // Safari macht Links nicht per Tab fokussierbar, solange die
    // Vollstaendige-Tastaturnavigation aus ist. Geprueft wird deshalb die
    // Dokumentreihenfolge, nicht das Verhalten einer Browsereinstellung.
    const first = await page.evaluate(() => {
      const element = document.querySelector(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      return {
        className: element.className,
        href: element.getAttribute("href"),
      };
    });
    expect(first.className).toContain("skip-link");
    expect(first.href).toBe("#main");
    await expect(page.locator("#main")).toHaveCount(1);

    await page.locator(".skip-link").focus();
    const focused = await page.evaluate(
      () => document.activeElement.className,
    );
    expect(focused).toContain("skip-link");
  });

  test("menu button is hidden on desktop and shown on mobile", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await expect(page.locator(".nav-toggle")).toBeHidden();
    await expect(page.locator("#primary-nav")).toBeVisible();

    await page.setViewportSize(MOBILE);
    await expect(page.locator(".nav-toggle")).toBeVisible();
  });

  test("menu button carries the state attributes it needs", async ({
    page,
  }) => {
    const toggle = page.locator(".nav-toggle");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAttribute("aria-controls", "primary-nav");
    await expect(toggle).toHaveAttribute("aria-label", /Men/);
    await expect(toggle).toHaveAttribute("type", "button");
  });

  test("header stays opaque enough to read over scrolled content", async ({
    page,
  }) => {
    const background = await page
      .locator(".site-header")
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    const alpha = Number(background.match(/[\d.]+\)$/)?.[0].slice(0, -1) ?? 1);
    expect(alpha).toBeGreaterThanOrEqual(0.6);
  });

  test("anchor targets clear the sticky header", async ({ page }) => {
    const padding = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
    );
    const headerHeight = await page
      .locator(".site-header")
      .evaluate((element) => element.getBoundingClientRect().height);
    expect(padding).toBeGreaterThanOrEqual(headerHeight);
  });
});
