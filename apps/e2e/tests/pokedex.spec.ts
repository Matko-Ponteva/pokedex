import { expect, test } from "@playwright/test";

test("searches the Pokédex and opens a Pokémon", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Search Pokémon").fill("charm");

  const charmander = page.getByRole("link", { name: /charmander/i });
  await expect(charmander).toBeVisible();
  await charmander.click();

  await expect(page).toHaveURL(/\/\/4$/);
  await expect(page.getByRole("heading", { level: 1, name: /charmander/i })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: /charmander/i })).toBeVisible();
});