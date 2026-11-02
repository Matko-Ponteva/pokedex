import { expect, test } from "@playwright/test";
import { newTrainer } from "./helpers";

test("two trainers see each other come and go in the lobby", async ({ browser, baseURL }) => {
  const [first, second] = await Promise.all([
    newTrainer(browser, baseURL),
    newTrainer(browser, baseURL),
  ]);

  await first.page.goto("/lobby");
  await second.page.goto("/lobby");

  await expect(first.page.getByText(second.user.displayName)).toBeVisible();
  await expect(second.page.getByText(first.user.displayName)).toBeVisible();

  await second.context.close();
  await expect(first.page.getByText(second.user.displayName)).toBeHidden({ timeout: 15_000 });

  await first.context.close();
});