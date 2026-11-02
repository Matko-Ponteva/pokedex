import { expect, test } from "@playwright/test";
import { newUser } from "./helpers";

test("signs up, logs out and logs back in", async ({ page }) => {
  const user = newUser();

  await page.goto("/signup");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Display name").fill(user.displayName);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "My team" })).toBeVisible();
  await expect(page.getByText(`Logged in as ${user.displayName}`)).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await page.goto("/teams");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "My teams" })).toBeVisible();
});

test("validates the sign-up form before sending it", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
});