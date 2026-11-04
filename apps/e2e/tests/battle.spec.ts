import { expect, test, type Page } from "@playwright/test";
import { newTrainer } from "./helpers";

async function createTeam(page: Page) {
  const response = await page.request.post("/api/teams", {
    data: { name: "Battle team", members: [{ pokemonId: 4, moves: ["scratch", "ember"] }], isPublic: false },
  });
  expect(response.ok()).toBe(true);
}

async function chat(page: Page, text: string) {
  await page.getByLabel("Chat message").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByLabel("Chat message")).toHaveValue("");
}

test("two trainers battle while a spectator watches and chats", async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const [ash, brock, misty] = await Promise.all([
    newTrainer(browser, baseURL),
    newTrainer(browser, baseURL),
    newTrainer(browser, baseURL),
  ]);
  await Promise.all([createTeam(ash.page), createTeam(brock.page)]);

  await ash.page.goto("/lobby");
  await brock.page.goto("/lobby");
  const brockRow = ash.page.locator(".online-list li").filter({ hasText: brock.user.displayName });
  await brockRow.getByRole("button", { name: "Challenge" }).click();
  await brockRow.getByLabel("Battle with").selectOption({ label: "Battle team (1 Pokémon)" });
  await brockRow.getByRole("button", { name: "Send challenge" }).click();

  const incoming = brock.page.locator(".trade-card.incoming");
  await expect(incoming.getByText("All Pokémon are set to level 50.")).toBeVisible();
  await incoming.getByRole("combobox").selectOption({ label: "Battle team (1 Pokémon)" });
  await incoming.getByRole("button", { name: "Accept" }).click();

  await expect(ash.page).toHaveURL(/\/battle\/[0-9a-f-]+$/);
  await expect(brock.page).toHaveURL(/\/battle\/[0-9a-f-]+$/);
  await expect(ash.page.getByText("Standard · Lv50")).toBeVisible();
  await expect(ash.page.locator(".info-box").first()).toContainText("Lv50");

  // The spectator joins from the lobby
  await misty.page.goto("/lobby");
  await misty.page.locator(".live-battles li").filter({ hasText: ash.user.displayName }).getByRole("link", { name: "Watch" }).click();
  await expect(misty.page).toHaveURL(/\/watch$/);
  await expect(misty.page.getByText("Spectating")).toBeVisible();
  await expect(ash.page.getByText("1 spectator")).toBeVisible();

  // Chats are public by default
  await chat(misty.page, "Go go go!");
  await expect(ash.page.getByText("Go go go!")).toBeVisible();
  await expect(brock.page.getByText("Go go go!")).toBeVisible();

  // Ash goes private and stops seeing the spectator, Brock still does
  await chat(ash.page, "/private");
  await expect(ash.page.locator(".chat-mode")).toHaveText("private");
  await expect(ash.page.getByText("Go go go!")).toBeHidden();
  await chat(misty.page, "Second cheer");
  await expect(brock.page.getByText("Second cheer")).toBeVisible();
  await expect(misty.page.getByText("can't see spectator messages")).toBeVisible();
  await chat(ash.page, "Good luck!");
  await expect(brock.page.getByText("Good luck!")).toBeVisible();
  await expect(misty.page.getByText("Good luck!")).toBeVisible();
  await expect(ash.page.getByText("Second cheer")).toBeHidden();

  // Play a turn; everyone sees it in the log
  await ash.page.getByRole("button", { name: /Scratch/ }).click();
  await brock.page.getByRole("button", { name: /Scratch/ }).click();
  for (const page of [ash.page, brock.page, misty.page]) {
    await expect(page.locator(".battle-log").getByText("Turn 1", { exact: true })).toBeVisible();
    await expect(page.locator(".battle-log").getByText(/used Scratch/).first()).toBeVisible();
  }

  // Ash goes public again and sees the spectator's earlier messages
  await chat(ash.page, "/public");
  await expect(ash.page.getByText("Second cheer")).toBeVisible();

  await Promise.all([ash.context.close(), brock.context.close(), misty.context.close()]);
});
