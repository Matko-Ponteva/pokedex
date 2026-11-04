import { expect, test, type Page } from "@playwright/test";
import { newTrainer } from "./helpers";

async function createTeam(page: Page, members: { pokemonId: number; moves: string[] }[]) {
  const response = await page.request.post("/api/teams", { data: { name: "Replace team", members, isPublic: false } });
  expect(response.ok()).toBe(true);
}

test("a trainer chooses their next Pokémon after one faints", async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const [ash, brock] = await Promise.all([newTrainer(browser, baseURL), newTrainer(browser, baseURL)]);
  // Mewtwo's Psychic knocks out Caterpie in one hit
  await createTeam(ash.page, [{ pokemonId: 150, moves: ["psychic"] }]);
  await createTeam(brock.page, [
    { pokemonId: 10, moves: ["tackle"] },
    { pokemonId: 13, moves: ["poison-sting"] },
    { pokemonId: 129, moves: ["tackle"] },
  ]);

  await ash.page.goto("/lobby");
  await brock.page.goto("/lobby");
  const brockRow = ash.page.locator(".online-list li").filter({ hasText: brock.user.displayName });
  await brockRow.getByRole("button", { name: "Challenge" }).click();
  await brockRow.getByLabel("Battle with").selectOption({ label: "Replace team (1 Pokémon)" });
  await brockRow.getByRole("button", { name: "Send challenge" }).click();
  const incoming = brock.page.locator(".request-card.incoming");
  await incoming.getByRole("combobox").selectOption({ label: "Replace team (3 Pokémon)" });
  await incoming.getByRole("button", { name: "Accept" }).click();
  await expect(brock.page).toHaveURL(/\/battle\//);

  await ash.page.getByRole("button", { name: /Psychic/ }).click();
  await brock.page.getByRole("button", { name: /Tackle/ }).click();

  await expect(brock.page.getByRole("heading", { name: "Choose your next Pokémon" })).toBeVisible({ timeout: 15_000 });
  await expect(ash.page.getByText(/send out their next Pokémon/)).toBeVisible({ timeout: 15_000 });
  await expect(ash.page.getByRole("button", { name: /Psychic/ })).toBeDisabled();
  await expect(brock.page.getByRole("button", { name: "Send in Caterpie" })).toBeDisabled();

  await brock.page.getByRole("button", { name: "Send in Magikarp" }).click();
  for (const page of [ash.page, brock.page]) {
    await expect(page.locator(".battle-log").getByText(/sent out Magikarp!/)).toBeVisible();
  }
  await expect(ash.page.getByText("What will Mewtwo do?")).toBeVisible({ timeout: 15_000 });
  await expect(brock.page.getByText("What will Magikarp do?")).toBeVisible({ timeout: 15_000 });

  await Promise.all([ash.context.close(), brock.context.close()]);
});
