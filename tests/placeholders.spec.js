const { test, expect } = require("@playwright/test");

const RETIRED_PHONE_HREF = "tel:+491636193240";
const RETIRED_PHONE_TEXT = "+49 163 6193240";
const PHONE_PENDING_TEXT = "Telefonnummer folgt in Kürze";
const ADDRESS = ["Yoldas Güden", "Tiller Straße 30a", "47546 Kalkar"];

const OPEN_PLACEHOLDERS = {
  "/": ["einzugsgebiet", "email", "erreichbarkeit", "telefon"],
  "/impressum.html": [
    "email",
    "kammer",
    "kleinunternehmer",
    "rechtsform",
    "steuer",
    "telefon",
    "versicherung",
  ],
  "/datenschutz.html": ["email", "telefon"],
};

test.describe("placeholder inventory", () => {
  for (const [path, expected] of Object.entries(OPEN_PLACEHOLDERS)) {
    test(`${path} marks exactly the details that are still open`, async ({
      page,
    }) => {
      await page.goto(path);
      const found = await page
        .locator("[data-placeholder]")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.dataset.placeholder),
        );
      expect([...new Set(found)].sort()).toEqual([...expected].sort());
    });
  }
});

test.describe("confirmed contact data", () => {
  for (const path of Object.keys(OPEN_PLACEHOLDERS)) {
    test(`${path} offers no telephone link while the number is pending`, async ({
      page,
    }) => {
      await page.goto(path);
      expect(await page.locator('a[href^="tel:"]').count()).toBe(0);
      const body = await page.locator("body").innerText();
      expect(body).not.toContain(RETIRED_PHONE_TEXT);
      expect(body).toContain(PHONE_PENDING_TEXT);
    });

    test(`${path} marks the pending number as a placeholder`, async ({
      page,
    }) => {
      await page.goto(path);
      const marked = page.locator('[data-placeholder="telefon"]');
      expect(await marked.count()).toBeGreaterThan(0);
      await expect(marked.first()).toContainText(PHONE_PENDING_TEXT);
    });
  }

  test("the start page shows the pending hint instead of a number", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".hero__card-phone")).toHaveCount(0);
    await expect(page.locator(".hero__card-hint")).toHaveText(
      PHONE_PENDING_TEXT,
    );
  });

  test("no page still links the retired number", async ({ page }) => {
    for (const path of Object.keys(OPEN_PLACEHOLDERS)) {
      await page.goto(path);
      expect(await page.locator(`a[href="${RETIRED_PHONE_HREF}"]`).count()).toBe(
        0,
      );
    }
  });

  for (const path of ["/impressum.html", "/datenschutz.html"]) {
    test(`${path} states the confirmed business address`, async ({ page }) => {
      await page.goto(path);
      const address = page.locator(".legal-address");
      await expect(address).toBeVisible();
      await expect(address).not.toHaveAttribute("data-placeholder", /.*/);
      for (const line of ADDRESS) {
        await expect(address).toContainText(line);
      }
    });
  }

  test("the structured data carries no telephone while it is pending", async ({
    page,
  }) => {
    await page.goto("/");
    const data = JSON.parse(
      await page.locator('script[type="application/ld+json"]').innerText(),
    );
    expect(data.telephone).toBeUndefined();
  });
});
