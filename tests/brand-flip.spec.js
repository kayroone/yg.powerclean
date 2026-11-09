const { test, expect } = require("@playwright/test");

const PAGES = ["/", "/impressum.html", "/datenschutz.html"];

test.describe("brand mark flip", () => {
  for (const path of PAGES) {
    test(`${path} spins the mark on hover`, async ({ page }) => {
      await page.goto(path);
      const mark = page.locator(".brand__mark");
      await expect(mark).not.toHaveClass(/is-flipping/);

      await page.locator(".brand").hover();
      await expect(mark).toHaveClass(/is-flipping/);
      expect(
        await mark.evaluate((node) => getComputedStyle(node).animationName),
      ).toBe("brand-flip");
    });
  }

  test("spins on a tap, which is all a phone can do", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const mark = page.locator(".brand__mark");
    await page.locator(".brand").dispatchEvent("click");
    await expect(mark).toHaveClass(/is-flipping/);
  });

  test("cleans up after itself so it can run again", async ({ page }) => {
    await page.goto("/");
    const mark = page.locator(".brand__mark");

    await page.locator(".brand").hover();
    await expect(mark).toHaveClass(/is-flipping/);
    await expect(mark).not.toHaveClass(/is-flipping/, { timeout: 3000 });

    await page.mouse.move(0, 400);
    await page.locator(".brand").hover();
    await expect(mark).toHaveClass(/is-flipping/);
  });

  test("a second trigger mid-flight does not restart the animation", async ({
    page,
  }) => {
    await page.goto("/");
    const mark = page.locator(".brand__mark");
    await page.locator(".brand").hover();
    await page.waitForTimeout(200);
    const first = await mark.evaluate(
      (node) => node.getAnimations()[0].currentTime,
    );
    await page.locator(".brand").dispatchEvent("click");
    const running = await mark.evaluate((node) => ({
      count: node.getAnimations().length,
      currentTime: node.getAnimations()[0].currentTime,
    }));
    expect(running.count).toBe(1);
    expect(running.currentTime).toBeGreaterThanOrEqual(first);
  });

  test("the rotation is a full turn, so the mark ends upright", async ({
    page,
  }) => {
    await page.goto("/");
    const keyframes = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of rules) {
          if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === "brand-flip") {
            return [...rule.cssRules].map((frame) => ({
              offset: frame.keyText,
              transform: frame.style.transform,
            }));
          }
        }
      }
      return null;
    });
    expect(keyframes).not.toBeNull();
    expect(keyframes[keyframes.length - 1].transform).toContain("360deg");
  });

  test("respects a reduced motion preference", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const mark = page.locator(".brand__mark");
    await page.locator(".brand").hover();
    expect(
      await mark.evaluate((node) => getComputedStyle(node).animationDuration),
    ).toBe("0s");
    await expect(mark).not.toHaveClass(/is-flipping/, { timeout: 3000 });
  });

  test("the link still works while the mark spins", async ({ page }) => {
    await page.goto("/");
    await page.locator('.site-footer__links a[href="impressum.html"]').click();
    await page.locator(".brand").click();
    await expect(page).toHaveURL(/index\.html$/);
  });
});
