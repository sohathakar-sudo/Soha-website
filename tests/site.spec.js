const { test, expect } = require("@playwright/test");

// The scroll indicator is desktop-only, so its tests skip on the mobile
// project rather than asserting against a hidden element.
const desktopOnly = (testInfo) => testInfo.project.name !== "desktop";

test.describe("scroll indicator", () => {
  test("starts on the first section", async ({ page }, testInfo) => {
    test.skip(desktopOnly(testInfo), "desktop-only UI");
    await page.goto("/");

    await expect(page.getByTestId("indicator-segment-intro")).toHaveAttribute(
      "data-active",
      "true"
    );
  });

  test("follows the section you scroll to", async ({ page }, testInfo) => {
    test.skip(desktopOnly(testInfo), "desktop-only UI");
    await page.goto("/");

    // Land #thoughts inside the detection band (20%–40% down the viewport)
    // rather than merely on-screen — the indicator tracks what you're
    // reading, not what's barely visible at the bottom edge. `instant`
    // sidesteps the page's smooth-scroll animation so the assertion isn't
    // racing it.
    await page.evaluate(() => {
      const el = document.getElementById("thoughts");
      const y = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: y - window.innerHeight * 0.25, behavior: "instant" });
    });

    await expect(page.getByTestId("indicator-segment-thoughts")).toHaveAttribute(
      "data-active",
      "true"
    );
    await expect(page.getByTestId("indicator-segment-intro")).toHaveAttribute(
      "data-active",
      "false"
    );
  });

  test("steps through sections as you scroll down the page", async ({
    page,
  }, testInfo) => {
    test.skip(desktopOnly(testInfo), "desktop-only UI");
    await page.goto("/");

    // Walks the whole page to confirm the observer hands off cleanly between
    // sections, rather than only checking a single resting position.
    for (const id of ["projects", "learned", "thoughts", "contact"]) {
      await page.evaluate((sectionId) => {
        const el = document.getElementById(sectionId);
        const y = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
          top: y - window.innerHeight * 0.25,
          behavior: "instant",
        });
      }, id);

      await expect(page.getByTestId(`indicator-segment-${id}`)).toHaveAttribute(
        "data-active",
        "true"
      );
    }
  });

  test("jumps to a section when a segment is clicked", async ({
    page,
  }, testInfo) => {
    test.skip(desktopOnly(testInfo), "desktop-only UI");
    await page.goto("/");

    await expect(page.locator("#contact")).not.toBeInViewport();
    await page.getByTestId("indicator-segment-contact").click();

    await expect(page.locator("#contact")).toBeInViewport();
  });

  test("reveals inactive labels on hover", async ({ page }, testInfo) => {
    test.skip(desktopOnly(testInfo), "desktop-only UI");
    await page.goto("/");

    // "contact" is not the active section at the top of the page, so its
    // label should be hidden until the indicator is hovered.
    const label = page.getByTestId("indicator-label-contact");
    await expect(label).toHaveCSS("opacity", "0");

    await page.getByTestId("scroll-indicator").hover();
    await expect(label).toHaveCSS("opacity", "1");
  });

  test("lists every section on the page", async ({ page }, testInfo) => {
    test.skip(desktopOnly(testInfo), "desktop-only UI");
    await page.goto("/");

    const sectionCount = await page.locator("[data-section]").count();
    const segmentCount = await page
      .getByTestId("scroll-indicator")
      .locator("button")
      .count();

    expect(segmentCount).toBe(sectionCount);
    expect(sectionCount).toBe(5);
  });
});

test.describe("icon rail", () => {
  test("marks the current page", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("icon-home")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("only lists pages that exist", async ({ page }) => {
    await page.goto("/");

    // The rail never advertises a room you can't walk into: every entry is
    // a real route, so nothing renders disabled.
    const links = page.getByTestId("icon-nav").locator("a");
    await expect(links).toHaveCount(2);
    await expect(page.getByTestId("icon-nav").locator("[aria-disabled]")).toHaveCount(0);
  });

  test("opens the cafe from the Garamond wordmark on the rail", async ({
    page,
  }) => {
    await page.goto("/");

    const door = page.getByTestId("icon-cafe");
    await expect(door).toHaveText("Cafe");
    await expect(door).toHaveCSS("font-style", "italic");

    await door.click();
    await expect(page).toHaveURL(/\/cafe$/);
    await expect(page.getByTestId("icon-cafe")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});

test.describe("work cafe", () => {
  test("renders every section from content/cafe.json and cafe.md", async ({
    page,
  }) => {
    await page.goto("/cafe");

    for (const id of ["welcome", "menu", "rules", "ambience"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    await expect(page.getByTestId("cafe-counter")).toBeVisible();
  });

  test("starts a countdown when you order off the menu", async ({ page }) => {
    await page.goto("/cafe");

    await expect(page.getByTestId("cafe-timer")).toHaveCount(0);

    await page.getByTestId("menu-item-25").click();
    await expect(page.getByTestId("cafe-timer")).toHaveText(/^2[45]:/);
    await expect(page.getByTestId("cafe-status")).toContainText("Brewing");

    // Pause holds the clock, clear puts the table back.
    await page.getByTestId("cafe-toggle").click();
    await expect(page.getByTestId("cafe-status")).toContainText("Paused");
    const held = await page.getByTestId("cafe-timer").textContent();
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("cafe-timer")).toHaveText(held);

    await page.getByTestId("cafe-clear").click();
    await expect(page.getByTestId("cafe-timer")).toHaveCount(0);
  });
});

test.describe("layout", () => {
  test("never scrolls horizontally", async ({ page }) => {
    await page.goto("/");

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("keeps the pane clear of the rail at every desktop width", async ({
    page,
  }, testInfo) => {
    test.skip(desktopOnly(testInfo), "desktop-only layout");

    // Regression: the pane used to be centered in the full viewport rather
    // than offset by the rail, so it slid underneath the navigation at any
    // width below ~1420px and only looked correct by coincidence at 1440.
    for (const width of [1440, 1280, 1180, 1024, 820]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");

      const { railRight, paneLeft } = await page.evaluate(() => {
        const rail = document
          .querySelector("[data-testid=rail]")
          .getBoundingClientRect();
        const pane = document
          .querySelector("[data-testid=content-pane] > div")
          .getBoundingClientRect();
        return { railRight: rail.right, paneLeft: pane.left };
      });

      expect(
        paneLeft,
        `pane overlaps the rail at ${width}px wide`
      ).toBeGreaterThanOrEqual(railRight);
    }
  });

  test("hides the scroll indicator on narrow screens", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile-only");
    await page.goto("/");

    await expect(page.getByTestId("scroll-indicator")).toBeHidden();
    await expect(page.getByTestId("icon-home")).toBeVisible();
  });
});

test.describe("content", () => {
  test("renders each section from its content file", async ({ page }) => {
    await page.goto("/");

    for (const id of [
      "intro",
      "projects",
      "learned",
      "thoughts",
      "contact",
    ]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });

  test("derives 'last updated' from the newest learnings entry", async ({
    page,
  }) => {
    await page.goto("/");

    // learnings.json's newest entry drives this line; the client upgrades it
    // to relative time after mount.
    const updated = page.locator("#learned").getByText(/Last updated/);
    await expect(updated).toBeVisible();
    await expect(updated.locator("time")).toHaveAttribute("datetime", /\d{4}-/);
  });
});
