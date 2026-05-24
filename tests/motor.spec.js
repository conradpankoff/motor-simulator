// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('BLDC Motor Simulator', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ── Page load ──────────────────────────────────────────────────────────────

  test('page title is correct', async ({ page }) => {
    await expect(page).toHaveTitle('BLDC Motor Simulator');
  });

  test('app title is visible', async ({ page }) => {
    await expect(page.locator('.app-title')).toHaveText('BLDC Motor Simulator');
  });

  test('SVG motor visualisation is present', async ({ page }) => {
    await expect(page.locator('#motorSvg')).toBeVisible();
  });

  test('stator coil arcs are rendered (6 paths)', async ({ page }) => {
    // motor.js builds 6 coil paths inside #statorCoils on init
    const count = await page.locator('#statorCoils path').count();
    expect(count).toBe(6);
  });

  test('rotor poles are rendered for default 2 pole-pairs (4 paths)', async ({ page }) => {
    const count = await page.locator('#rotorPoles path').count();
    expect(count).toBe(4);
  });

  // ── Control panel elements ─────────────────────────────────────────────────

  test('all four commutation mode buttons are present', async ({ page }) => {
    await expect(page.locator('[data-cm="manual"]')).toBeVisible();
    await expect(page.locator('[data-cm="openLoop"]')).toBeVisible();
    await expect(page.locator('[data-cm="closedLoop"]')).toBeVisible();
    await expect(page.locator('[data-cm="sensorless"]')).toBeVisible();
  });

  test('both signal mode buttons are present', async ({ page }) => {
    await expect(page.locator('[data-sm="sinusoidal"]')).toBeVisible();
    await expect(page.locator('[data-sm="trapezoidal"]')).toBeVisible();
  });

  test('all four pole-pair buttons are present', async ({ page }) => {
    for (const pp of ['1', '2', '3', '4']) {
      await expect(page.locator(`[data-pp="${pp}"]`)).toBeVisible();
    }
  });

  test('throttle slider is present with default value 30', async ({ page }) => {
    const slider = page.locator('#sThrottle');
    await expect(slider).toBeVisible();
    await expect(slider).toHaveValue('30');
  });

  test('advance angle slider is present with default value 15', async ({ page }) => {
    await expect(page.locator('#sAdvance')).toHaveValue('15');
  });

  test('telemetry readout boxes are present', async ({ page }) => {
    await expect(page.locator('#dSpeed')).toBeVisible();
    await expect(page.locator('#dTorque')).toBeVisible();
    await expect(page.locator('#dElec')).toBeVisible();
    await expect(page.locator('#dRotor')).toBeVisible();
  });

  test('phase voltage bars are present', async ({ page }) => {
    await expect(page.locator('#phU')).toBeAttached();
    await expect(page.locator('#phV')).toBeAttached();
    await expect(page.locator('#phW')).toBeAttached();
  });

  test('pause/resume button is present and labelled PAUSE initially', async ({ page }) => {
    await expect(page.locator('#runBtn')).toContainText('PAUSE');
  });

  // ── Default active states ──────────────────────────────────────────────────

  test('Closed Loop button is active by default', async ({ page }) => {
    await expect(page.locator('[data-cm="closedLoop"]')).toHaveClass(/on/);
  });

  test('FOC / Sine button is active by default', async ({ page }) => {
    await expect(page.locator('[data-sm="sinusoidal"]')).toHaveClass(/on/);
  });

  test('2 pp button is active by default', async ({ page }) => {
    await expect(page.locator('[data-pp="2"]')).toHaveClass(/on-G/);
  });

  // ── Commutation mode switching ─────────────────────────────────────────────

  test('clicking Manual activates that button and deactivates Closed Loop', async ({ page }) => {
    await page.locator('[data-cm="manual"]').click();
    await expect(page.locator('[data-cm="manual"]')).toHaveClass(/on/);
    await expect(page.locator('[data-cm="closedLoop"]')).not.toHaveClass(/\bon\b/);
  });

  test('manual angle slider is enabled only in Manual mode', async ({ page }) => {
    // Initially muted (not manual mode)
    await expect(page.locator('#sManual')).toHaveClass(/muted/);

    // Switch to Manual → slider becomes active
    await page.locator('[data-cm="manual"]').click();
    await expect(page.locator('#sManual')).not.toHaveClass(/muted/);

    // Switch back to Closed Loop → slider is muted again
    await page.locator('[data-cm="closedLoop"]').click();
    await expect(page.locator('#sManual')).toHaveClass(/muted/);
  });

  test('clicking Open Loop activates that button', async ({ page }) => {
    await page.locator('[data-cm="openLoop"]').click();
    await expect(page.locator('[data-cm="openLoop"]')).toHaveClass(/on/);
  });

  test('clicking Sensorless activates that button', async ({ page }) => {
    await page.locator('[data-cm="sensorless"]').click();
    await expect(page.locator('[data-cm="sensorless"]')).toHaveClass(/on/);
  });

  // ── Signal mode switching ──────────────────────────────────────────────────

  test('clicking 6-Step / Trap switches signal mode', async ({ page }) => {
    await page.locator('[data-sm="trapezoidal"]').click();
    await expect(page.locator('[data-sm="trapezoidal"]')).toHaveClass(/on/);
    await expect(page.locator('[data-sm="sinusoidal"]')).not.toHaveClass(/\bon\b/);
  });

  // ── Pole pair switching ────────────────────────────────────────────────────

  test('switching to 1 pp rebuilds rotor with 2 pole paths', async ({ page }) => {
    await page.locator('[data-pp="1"]').click();
    await expect(page.locator('[data-pp="1"]')).toHaveClass(/on-G/);
    const count = await page.locator('#rotorPoles path').count();
    expect(count).toBe(2);
  });

  test('switching to 3 pp rebuilds rotor with 6 pole paths', async ({ page }) => {
    await page.locator('[data-pp="3"]').click();
    const count = await page.locator('#rotorPoles path').count();
    expect(count).toBe(6);
  });

  test('switching to 4 pp rebuilds rotor with 8 pole paths', async ({ page }) => {
    await page.locator('[data-pp="4"]').click();
    const count = await page.locator('#rotorPoles path').count();
    expect(count).toBe(8);
  });

  // ── Throttle slider ────────────────────────────────────────────────────────

  test('throttle display updates when slider changes', async ({ page }) => {
    await page.locator('#sThrottle').fill('75');
    await page.locator('#sThrottle').dispatchEvent('input');
    await expect(page.locator('#dThrottle')).toHaveText('75%');
  });

  test('throttle display shows 0% at minimum', async ({ page }) => {
    await page.locator('#sThrottle').fill('0');
    await page.locator('#sThrottle').dispatchEvent('input');
    await expect(page.locator('#dThrottle')).toHaveText('0%');
  });

  // ── Advance angle slider ───────────────────────────────────────────────────

  test('advance angle display updates when slider changes', async ({ page }) => {
    await page.locator('#sAdvance').fill('30');
    await page.locator('#sAdvance').dispatchEvent('input');
    await expect(page.locator('#dAdvance')).toHaveText('30°');
  });

  // ── Manual angle slider ────────────────────────────────────────────────────

  test('manual angle display updates when in Manual mode', async ({ page }) => {
    await page.locator('[data-cm="manual"]').click();
    await page.locator('#sManual').fill('180');
    await page.locator('#sManual').dispatchEvent('input');
    await expect(page.locator('#dManual')).toHaveText('180°');
  });

  // ── Pause / Resume ─────────────────────────────────────────────────────────

  test('clicking Pause changes button to RESUME', async ({ page }) => {
    await page.locator('#runBtn').click();
    await expect(page.locator('#runBtn')).toContainText('RESUME');
    await expect(page.locator('#runBtn')).toHaveClass(/paused/);
  });

  test('clicking Resume changes button back to PAUSE', async ({ page }) => {
    await page.locator('#runBtn').click(); // pause
    await page.locator('#runBtn').click(); // resume
    await expect(page.locator('#runBtn')).toContainText('PAUSE');
    await expect(page.locator('#runBtn')).not.toHaveClass(/paused/);
  });

  // ── Simulation running ─────────────────────────────────────────────────────

  test('rotor angle advances over time when running with throttle', async ({ page }) => {
    // Ensure full throttle for a measurable result
    await page.locator('#sThrottle').fill('100');
    await page.locator('#sThrottle').dispatchEvent('input');

    const before = await page.locator('#dRotor').textContent();

    // Wait for a few animation frames
    await page.waitForTimeout(300);

    const after = await page.locator('#dRotor').textContent();
    // The rotor should have moved
    expect(before).not.toEqual(after);
  });

  test('simulation stops updating rotor angle when paused', async ({ page }) => {
    // Ensure running with some throttle
    await page.locator('#sThrottle').fill('100');
    await page.locator('#sThrottle').dispatchEvent('input');
    await page.waitForTimeout(200);

    // Pause
    await page.locator('#runBtn').click();
    await page.waitForTimeout(50);

    const before = await page.locator('#dRotor').textContent();
    await page.waitForTimeout(200);
    const after = await page.locator('#dRotor').textContent();

    expect(before).toEqual(after);
  });

  // ── External asset loading ─────────────────────────────────────────────────

  test('style.css loads without errors', async ({ page }) => {
    const cssStatuses = [];
    page.on('response', r => {
      if (r.url().includes('style.css')) cssStatuses.push(r.status());
    });
    await page.reload();
    // 200 (fresh) or 304 (cached) are both successful
    expect(cssStatuses.some(s => s === 200 || s === 304)).toBe(true);
  });

  test('motor.js loads without errors', async ({ page }) => {
    const jsStatuses = [];
    page.on('response', r => {
      if (r.url().includes('motor.js')) jsStatuses.push(r.status());
    });
    await page.reload();
    // 200 (fresh) or 304 (cached) are both successful
    expect(jsStatuses.some(s => s === 200 || s === 304)).toBe(true);
  });

});
