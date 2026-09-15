import { Page } from '@playwright/test';

export async function waitForLoad(page: Page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch (e) {
    // ignore timeout
  }
  await page.waitForTimeout(500);
}

export async function clickIfVisible(page: Page, selector: string) {
  const isVisible = await page.isVisible(selector);
  if (isVisible) {
    await page.click(selector);
    return true;
  }
  return false;
}

export async function setLanguage(page: Page, language: 'en' | 'hi') {
  await page.addInitScript((lang) => {
    localStorage.setItem('patient_language', lang);
  }, language);
}
