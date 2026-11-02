import { expect, test } from "@playwright/test";
import { signUpViaApi } from "./helpers";

test("builds a team and shares it", async ({ page, browser, baseURL }) => {
  const owner = await signUpViaApi(page);

  await page.goto("/teams/new");
  await page.getByLabel("Team name").fill("E2E starters");
  await page.getByLabel("Search Pokémon to add").fill("bulbasaur");
  await page.getByRole("button", { name: /bulbasaur/i }).click();
  await expect(page.getByRole("heading", { level: 3, name: /bulbasaur/i })).toBeVisible();

  const firstMove = page.getByLabel("Move 1");
  await expect(firstMove).toBeEnabled();
  await firstMove.selectOption({ index: 1 });

  await page.getByLabel(/^Public/).check();
  await page.getByRole("button", { name: "Save team" }).click();

  await expect(page).toHaveURL(/\/teams$/);
  const card = page.getByRole("listitem").filter({ hasText: "E2E starters" });
  await expect(card.getByText("Public", { exact: true })).toBeVisible();

  const teamsResponse = await page.request.get("/api/teams");
  const teams: { name: string; shareId: string }[] = await teamsResponse.json();
  const shareId = teams.find((team) => team.name === "E2E starters")?.shareId;
  expect(shareId).toBeDefined();

  const visitor = await browser.newContext({ baseURL });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/t/${shareId}`);
  await expect(visitorPage.getByRole("heading", { level: 1, name: "E2E starters" })).toBeVisible();
  await expect(visitorPage.getByText(`A team by ${owner.displayName}`)).toBeVisible();
  await visitor.close();
});