import { expect, test, type Page } from "@playwright/test";
import { newTrainer } from "./helpers";

async function createTeam(page: Page, name: string, members: { pokemonId: number; moves: string[] }[]) {
  const response = await page.request.post("/api/teams", { data: { name, members, isPublic: false } });
  expect(response.ok()).toBe(true);
}

test("two trainers fight a double battle, aiming moves and replacing a fainted Pokémon", async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const [ash, brock] = await Promise.all([newTrainer(browser, baseURL), newTrainer(browser, baseURL)]);
  // Mewtwo's Psychic knocks out Caterpie in one hit; Magikarp only splashes
  await createTeam(ash.page, "Doubles team", [
    { pokemonId: 150, moves: ["psychic"] },
    { pokemonId: 129, moves: ["splash"] },
  ]);
  await createTeam(brock.page, "Doubles team", [
    { pokemonId: 10, moves: ["tackle"] },
    { pokemonId: 13, moves: ["poison-sting"] },
    { pokemonId: 129, moves: ["tackle"] },
    { pokemonId: 16, moves: ["tackle"] },
  ]);

  await ash.page.goto("/lobby");
  await brock.page.goto("/lobby");
  const brockRow = ash.page.locator(".online-list li").filter({ hasText: brock.user.displayName });
  await brockRow.getByRole("button", { name: "Challenge" }).click();
  await brockRow.getByLabel("Battle with").selectOption({ label: "Doubles team (2 Pokémon)" });
  await brockRow.getByLabel("Rules").selectOption({ label: "Doubles" });
  await brockRow.getByRole("button", { name: "Send challenge" }).click();
  const incoming = brock.page.locator(".request-card.incoming");
  await incoming.getByRole("combobox").selectOption({ label: "Doubles team (4 Pokémon)" });
  await incoming.getByRole("button", { name: "Accept" }).click();
  await expect(brock.page).toHaveURL(/\/battle\//);

  // Ash aims Psychic at Caterpie, then picks Magikarp's move
  await expect(ash.page.getByText("What will Mewtwo do?")).toBeVisible();
  await ash.page.getByRole("button", { name: /Psychic/ }).click();
  await ash.page.getByRole("button", { name: "Foe: Caterpie (left)" }).click();
  await expect(ash.page.getByText("What will Magikarp do?")).toBeVisible();
  await ash.page.getByRole("button", { name: /Splash/ }).click();

  // Brock aims both his Pokémon at Mewtwo
  await brock.page.getByRole("button", { name: /Tackle/ }).click();
  await brock.page.getByRole("button", { name: "Foe: Mewtwo (left)" }).click();
  await brock.page.getByRole("button", { name: /Poison Sting/ }).click();
  await brock.page.getByRole("button", { name: "Foe: Mewtwo (left)" }).click();

  await expect(brock.page.getByRole("heading", { name: "Choose who replaces Caterpie" })).toBeVisible({ timeout: 20_000 });
  await brock.page.getByRole("button", { name: "Send in Magikarp" }).click();
  for (const page of [ash.page, brock.page]) {
    await expect(page.locator(".battle-log").getByText(/sent out Magikarp!/)).toBeVisible({ timeout: 15_000 });
  }
  await expect(ash.page.getByText("What will Mewtwo do?")).toBeVisible({ timeout: 15_000 });
  await expect(brock.page.getByText("What will Magikarp do?")).toBeVisible({ timeout: 15_000 });

  await Promise.all([ash.context.close(), brock.context.close()]);
});
