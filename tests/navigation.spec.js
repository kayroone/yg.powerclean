const { test, expect } = require("@playwright/test");

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight / 2);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((resume) => setTimeout(resume, 40));
    }
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
  });
  await page.waitForTimeout(300);
}

test.use({ viewport: { width: 390, height: 844 } });

test.describe("mobile navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("menu is closed on load", async ({ page }) => {
    await expect(page.locator("#primary-nav")).toBeHidden();
    await expect(page.locator(".nav-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test("button opens and closes the menu", async ({ page }) => {
    const toggle = page.locator(".nav-toggle");
    await toggle.click();
    await expect(page.locator("#primary-nav")).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAttribute("aria-label", /schließen/i);

    await toggle.click();
    await expect(page.locator("#primary-nav")).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAttribute("aria-label", /öffnen/i);
  });

  test("choosing a destination closes the menu", async ({ page }) => {
    await page.locator(".nav-toggle").click();
    await page.locator('#primary-nav a[href="#leistungen"]').click();
    await expect(page.locator("#primary-nav")).toBeHidden();
  });

  test("escape closes the menu and returns focus to the button", async ({
    page,
  }) => {
    const toggle = page.locator(".nav-toggle");
    await toggle.click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#primary-nav")).toBeHidden();
    expect(
      await page.evaluate(() => document.activeElement.className),
    ).toContain("nav-toggle");
  });
});

test.describe("scroll animations", () => {
  test("script marks the document so css can take over", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/\bjs\b/);
  });

  test("sections become visible once scrolled into view", async ({ page }) => {
    await page.goto("/");
    const target = page.locator(".animate-on-scroll").first();
    await target.scrollIntoViewIfNeeded();
    await expect(target).toHaveClass(/is-visible/);
    await expect(target).toBeVisible();
  });

  test("every animated section appears on the smallest phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/");
    await scrollThrough(page);

    const hidden = await page
      .locator(".animate-on-scroll")
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => !node.classList.contains("is-visible"))
          .map((node) => node.id || node.className),
      );
    expect(hidden, "Sektion bleibt unsichtbar").toEqual([]);
  });

  test("a section taller than the viewport still appears", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/");

    // Die Schwelle darf nicht an der Sektionshoehe haengen: drei Karten mehr,
    // und eine relative Schwelle wird auf 320 px nie mehr erreicht.
    await page.evaluate(() => {
      const grid = document.querySelector(".services__grid");
      const cards = [...grid.querySelectorAll(".service-card")];
      cards.slice(0, 6).forEach((card) => grid.appendChild(card.cloneNode(true)));
    });
    await scrollThrough(page);

    const section = page.locator("#leistungen");
    await expect(section).toHaveClass(/is-visible/);
    const opacity = await section.evaluate(
      (element) => getComputedStyle(element).opacity,
    );
    expect(parseFloat(opacity)).toBe(1);
  });

  test("content stays readable when motion is reduced", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const target = page.locator(".animate-on-scroll").first();
    await target.scrollIntoViewIfNeeded();
    const opacity = await target.evaluate(
      (element) => getComputedStyle(element).opacity,
    );
    expect(parseFloat(opacity)).toBe(1);
  });
});
