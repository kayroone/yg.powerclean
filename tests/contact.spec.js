const { test, expect } = require("@playwright/test");

test.describe("benefits", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("section is reachable from the navigation", async ({ page }) => {
    await expect(page.locator("#vorteile")).toHaveCount(1);
    await expect(page.locator("#vorteile h2")).toBeVisible();
  });

  test("lists five benefits, each with an icon", async ({ page }) => {
    const items = page.locator("#vorteile .benefit");
    await expect(items).toHaveCount(5);
    for (let index = 0; index < 5; index += 1) {
      await expect(items.nth(index).locator("svg")).toHaveCount(1);
    }
  });
});

test.describe("contact", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("offers a telephone and an email link", async ({ page }) => {
    const phone = page.locator('#kontakt a[href^="tel:"]');
    const mail = page.locator('#kontakt a[href^="mailto:"]');
    expect(await phone.count()).toBeGreaterThanOrEqual(1);
    expect(await mail.count()).toBeGreaterThanOrEqual(1);
    await expect(phone.first()).toBeVisible();
    await expect(mail.first()).toBeVisible();
  });

  test("telephone href carries no spaces", async ({ page }) => {
    const hrefs = await page
      .locator('#kontakt a[href^="tel:"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
    for (const href of hrefs) {
      expect(href).toMatch(/^tel:\+?[0-9]+$/);
    }
    expect(new Set(hrefs).size, "alle tel-Links müssen dieselbe Nummer tragen").toBe(1);
  });

  test("every unconfirmed detail is marked as a placeholder", async ({
    page,
  }) => {
    const marked = page.locator("#kontakt [data-placeholder]");
    expect(await marked.count()).toBeGreaterThanOrEqual(3);
    for (const value of await marked.evaluateAll((nodes) =>
      nodes.map((node) => node.dataset.placeholder),
    )) {
      expect(value).not.toBe("");
    }
  });

  test("placeholders are visible to a human, not only in the markup", async ({
    page,
  }) => {
    await expect(page.locator(".placeholder-note")).toBeVisible();
    await expect(page.locator(".placeholder-note")).toContainText(
      /Platzhalter/i,
    );
  });

  test("the business address appears nowhere on the start page", async ({
    page,
  }) => {
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+/);
    expect(text).not.toMatch(/[A-ZÄÖÜ][a-zäöüß]+(straße|strasse|weg|platz)\s+\d/i);
  });
});

test.describe("portrait", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("is served as webp with a downscaled fallback", async ({ page }) => {
    const picture = page.locator("#kontakt picture");
    await expect(picture).toHaveCount(1);
    await expect(picture.locator('source[type="image/webp"]')).toHaveAttribute(
      "srcset",
      /yoldas-640\.webp/,
    );
    // Der Fallback darf nicht das 1,6-MB-Original sein
    await expect(picture.locator("img")).toHaveAttribute("src", /yoldas-640\./);
  });

  test("carries an alternative text naming the owner", async ({ page }) => {
    await expect(page.locator("#kontakt picture img")).toHaveAttribute(
      "alt",
      /Yoldas/,
    );
  });

  test("declares its dimensions so the layout does not shift", async ({
    page,
  }) => {
    const image = page.locator("#kontakt picture img");
    await expect(image).toHaveAttribute("width", /\d+/);
    await expect(image).toHaveAttribute("height", /\d+/);
    await expect(image).toHaveAttribute("loading", "lazy");
  });

  test("renders as a circle on the dark background", async ({ page }) => {
    const radius = await page
      .locator(".portrait-frame")
      .evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
    expect(radius).toBe("50%");
  });

  test("the loaded portrait actually decodes", async ({ page }) => {
    const image = page.locator("#kontakt picture img");
    // loading="lazy": WebKit laedt erst, wenn das Bild in Sichtweite kommt
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    const natural = await image.evaluate(async (element) => {
      if (!element.complete) await element.decode().catch(() => {});
      return { width: element.naturalWidth, complete: element.complete };
    });
    expect(natural.complete).toBe(true);
    expect(natural.width).toBeGreaterThan(0);
  });
});
