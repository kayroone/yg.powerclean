const { test, expect } = require("@playwright/test");

const PHONE_HREF = "tel:+491636193240";
const PHONE_TEXT = "+49 163 6193240";
const ADDRESS = ["Yoldas Güden", "Tiller Straße 30a", "47546 Kalkar"];

const OPEN_PLACEHOLDERS = {
  "/": ["einzugsgebiet", "email", "erreichbarkeit"],
  "/impressum.html": [
    "email",
    "kammer",
    "kleinunternehmer",
    "rechtsform",
    "steuer",
    "versicherung",
  ],
  "/datenschutz.html": ["email"],
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
    test(`${path} carries the real telephone number, unmarked`, async ({
      page,
    }) => {
      await page.goto(path);
      const links = page.locator(`a[href="${PHONE_HREF}"]`);
      expect(await links.count()).toBeGreaterThan(0);
      expect(
        await links.evaluateAll((nodes) =>
          nodes.filter((node) => node.hasAttribute("data-placeholder")).length,
        ),
      ).toBe(0);
      expect(await page.locator("body").innerText()).toContain(PHONE_TEXT);
    });
  }

  test("the start page shows the number without a placeholder hint", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".hero__card-phone")).toHaveText(PHONE_TEXT);
    await expect(page.locator(".hero__card-hint")).toHaveCount(0);
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

  test("the structured data repeats the confirmed number", async ({ page }) => {
    await page.goto("/");
    const data = JSON.parse(
      await page.locator('script[type="application/ld+json"]').innerText(),
    );
    expect(data.telephone.replace(/\s/g, "")).toBe(
      PHONE_HREF.replace("tel:", ""),
    );
  });
});
