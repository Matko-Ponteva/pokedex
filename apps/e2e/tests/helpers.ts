import { expect, type Browser, type Page } from "@playwright/test";

export type TestUser = {
  email: string;
  displayName: string;
  password: string;
};

export function newUser(): TestUser {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    email: `e2e-${id}@example.com`,
    displayName: `Trainer ${id.slice(-6)}`,
    password: "e2e-password",
  };
}

export async function signUpViaApi(page: Page, user = newUser()): Promise<TestUser> {
  const response = await page.request.post("/api/auth/signup", { data: user });
  expect(response.ok()).toBe(true);
  return user;
}

export async function newTrainer(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const user = await signUpViaApi(page);
  return { context, page, user };
}