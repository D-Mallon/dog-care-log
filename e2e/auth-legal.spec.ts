import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Keep the shell test fully offline; Supabase is not part of this scenario.
  await page.route("http://127.0.0.1:9/**", (route) => route.abort());
  await page.goto("/");
});

test("unauthenticated shell exposes privacy and terms", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: "Loggi", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();

  await page.getByRole("button", { name: "Terms of service" }).click();
  await expect(
    page.getByRole("heading", { name: "Privacy & terms" }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Terms" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByText("Cancellation, refunds and EU/EEA rights"),
  ).toBeVisible();
  await expect(page.getByText("[COMPANY NAME]")).toHaveCount(0);
  await expect(page.getByText("[CONTACT EMAIL]")).toHaveCount(0);

  await page.getByRole("button", { name: /back/i }).click();
  await expect(
    page.getByRole("heading", { name: "Loggi", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Privacy policy" }).click();
  await expect(
    page.getByRole("heading", { name: "Privacy & terms" }),
  ).toBeVisible();
  await expect(page.getByText("What we collect")).toBeVisible();
  await expect(page.getByText("Who we share it with")).toBeVisible();
  await expect(page.getByText("[REGISTERED ADDRESS]")).toHaveCount(0);
});

test("browser back returns from legal to the auth screen", async ({ page }) => {
  await page.getByRole("button", { name: "Privacy policy" }).click();
  await expect(
    page.getByRole("heading", { name: "Privacy & terms" }),
  ).toBeVisible();

  await page.goBack();

  await expect(
    page.getByRole("heading", { name: "Loggi", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
});
