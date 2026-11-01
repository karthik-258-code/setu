import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

interface DemoStudent {
  studentId: string;
  firstName: string;
  rollNo: string;
  lang: string;
  pin: string;
}

interface DemoSeed {
  students: DemoStudent[];
  [key: string]: unknown;
}

async function useLargeDemoRoster(page: Page) {
  await page.route("**/demo/seed.json", async (route) => {
    const response = await route.fetch();
    const seed = (await response.json()) as DemoSeed;
    const addedStudents = Array.from(
      { length: Math.max(0, 120 - seed.students.length) },
      (_, index) => {
        const rollNo = String(seed.students.length + index + 1);
        return {
          studentId: `e2e-${rollNo}`,
          firstName: `Browser test ${rollNo}`,
          rollNo,
          lang: "en",
          pin: String(3000 + Number(rollNo)).padStart(4, "0"),
        };
      },
    );
    await route.fulfill({
      response,
      json: { ...seed, students: [...seed.students, ...addedStudents] },
    });
  });
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 720 },
  { name: "mobile-sized", width: 390, height: 844 },
]) {
  test(`Gap Map scrolls through 120 students at ${viewport.name} size`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await useLargeDemoRoster(page);
    await page.goto("/demo");

    const region = page.getByRole("region", { name: "Gap Map" });
    await expect(region).toBeVisible();
    const table = page.getByTestId("gapmap");
    await expect(table).toHaveAttribute("aria-rowcount", "122");

    const firstRow = page.getByTestId("gapmap-row-demo-anjali");
    const rowBox = await firstRow.boundingBox();
    if (!rowBox) throw new Error("The first student row is not laid out");
    expect(rowBox.height).toBeGreaterThanOrEqual(60);
    expect(rowBox.height).toBeLessThan(80);

    const initiallyRenderedRows = await table.getByTestId(/^gapmap-row-/).count();
    expect(initiallyRenderedRows).toBeLessThan(30);
    await expect(page.getByTestId("gapmap-row-e2e-120")).toHaveCount(0);

    await region.evaluate((element) => {
      element.scrollTop = 110 * 64;
      element.dispatchEvent(new Event("scroll"));
    });

    const lastRow = page.getByTestId("gapmap-row-e2e-120");
    await expect(lastRow).toHaveAttribute("aria-rowindex", "122");
    await expect(page.getByTestId("gapmap-row-demo-anjali")).toHaveCount(0);
    expect(await table.getByTestId(/^gapmap-row-/).count()).toBeLessThan(30);
  });
}
