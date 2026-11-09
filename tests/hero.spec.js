const { test, expect } = require("@playwright/test");

test.describe("hero", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("carries exactly one visible h1 naming the business", async ({
    page,
  }) => {
    const headings = page.locator("h1");
    await expect(headings).toHaveCount(1);
    await expect(headings.first()).toBeVisible();
    await expect(headings.first()).toContainText(/Sauberkeit|Reinigung/);
  });

  test("shows the claim from the design system", async ({ page }) => {
    await expect(page.locator(".hero .pc-script")).toHaveText(
      "Sauber. Stark. Zuverlässig.",
    );
  });

  test("names both private and commercial customers", async ({ page }) => {
    const copy = await page.locator(".hero__copy").innerText();
    expect(copy).toMatch(/[Pp]rivat/);
    expect(copy).toMatch(/[Gg]ewerb|[Uu]nternehmen/);
  });

  test("offers a primary and a secondary call to action", async ({ page }) => {
    const actions = page.locator(".hero__actions .pc-button");
    await expect(actions).toHaveCount(2);
    await expect(actions.nth(0)).toHaveAttribute("href", "#kontakt");
    await expect(actions.nth(1)).toHaveAttribute("href", "#leistungen");
  });

  test("logo is inline svg with an accessible name, not a raster image", async ({
    page,
  }) => {
    const logo = page.locator(".hero__logo");
    await expect(logo).toHaveCount(1);
    expect(await logo.evaluate((element) => element.tagName.toLowerCase())).toBe(
      "svg",
    );
    await expect(logo.locator("title")).toContainText("YG PowerClean");
  });

  test("claims no qualification the owner does not hold", async ({ page }) => {
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/Meisterbetrieb/i);
    expect(text).not.toMatch(/Reinigungsmeister/i);
    expect(text).not.toMatch(/Gebäudereinigermeister/i);
  });

  test("placeholder phone number is marked as a placeholder", async ({
    page,
  }) => {
    const placeholders = page.locator("[data-placeholder]");
    expect(await placeholders.count()).toBeGreaterThan(0);
  });
});
