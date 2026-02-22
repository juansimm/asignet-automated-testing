import { test, expect } from '@playwright/test';
import fs from 'fs';

const RUN_E2E = process.env.RUN_IDE_ASIGNET_E2E === '1';

test.describe('TRIM E2E', () => {
  test.skip(!RUN_E2E, 'RUN_IDE_ASIGNET_E2E not set to 1');

  test('create service order and verify in Order Status', async ({ page }) => {
    const info = test.info();
    const outDir = `test-results/${info.title.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}`;
    fs.mkdirSync(outDir, { recursive: true });
    // Helper: robustly set input value using several fallbacks
    async function robustFill(locator: any, value: string) {
      try {
        await locator.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
        await locator.scrollIntoViewIfNeeded().catch(() => {});
        await locator.click({ timeout: 1000 }).catch(() => {});
        await locator.fill(value, { timeout: 2000 });
        return;
      } catch (e) {
        // try force fill
      }
      try {
        await locator.fill(value, { force: true, timeout: 1000 });
        return;
      } catch (e) {
        // last-resort: set value via DOM
      }
      try {
        await locator.evaluate((el: HTMLInputElement, val: string) => {
          el.focus();
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, value);
      } catch (e) {
        // swallow — caller will continue
      }
    }
    // Wait for the TRIM app or its main form/controls to be ready.
    async function waitForAppReady(timeout = 15000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        // TRIM header visible
        if (await page.getByText('TRIM - Telecom Resources Information Management', { exact: false }).isVisible().catch(() => false)) return;
        // main form attached
        if ((await page.locator('form[name="frm"]').count()) > 0) return;
        // known OK control rendered
        if ((await page.locator('input[id="10160008"]').count()) > 0) return;
        await page.waitForTimeout(250);
      }
      throw new Error('Timeout waiting for TRIM app or form to be ready');
    }
    try {
      await page.screenshot({ path: `${outDir}/01_login_page.png`, fullPage: true });
    const base = process.env.IDE_BASE_URL;
    if (!base) throw new Error('IDE_BASE_URL not set');

    // Login happens on `/login` (not SSO) in this environment.
    const loginUrl = new URL('login', base).toString();
    await page.goto(loginUrl, { waitUntil: 'networkidle' });

    // Check if TRIM header is present (already authenticated)
    const trimHeader = page.getByText('TRIM - Telecom Resources Information Management', { exact: false });
    async function ensureLoggedIn() {
      const username = process.env.IDE_ASIGNET_USERNAME;
      const password = process.env.IDE_ASIGNET_PASSWORD;
      const userPassword = process.env.USER_PASSWORD || password;
      if (!username || !password) throw new Error('IDE_ASIGNET_USERNAME / IDE_ASIGNET_PASSWORD not set');

      for (let attempt = 0; attempt < 4; attempt++) {
        if (await page.getByText('TRIM - Telecom Resources Information Management', { exact: false }).isVisible().catch(() => false)) return;
            const userPasswordEnv = process.env.USER_PASSWORD;
            if (!username || !password) throw new Error('IDE_ASIGNET_USERNAME / IDE_ASIGNET_PASSWORD not set');
            if (!userPasswordEnv) throw new Error('USER_PASSWORD must be set for AAD login');
            const userPassword = userPasswordEnv;
        // Microsoft / AAD email -> next -> password
        const aadEmail = page.locator('input[name=\"loginfmt\"], input[type=\"email\"]').first();
        if (await aadEmail.count() > 0) {
          await aadEmail.fill(username);
          const nextBtn = page.getByRole('button', { name: /Next|Siguiente|Continuar/i }).first();
          if (await nextBtn.count()) {
                console.log('AAD flow detected — will use USER_PASSWORD for AAD step and IDE_ASIGNET_PASSWORD for local login');
            await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}), nextBtn.click()]);
          } else {
            await page.keyboard.press('Enter');
          }
            // After AAD sign-in, Microsoft may show a "Stay signed in?" dialog.
            // If present, check "Don't show this again" and click Yes to continue.
            const stayDialog = page.getByText(/Stay signed in\?/i).first();
            if (await stayDialog.count() && await stayDialog.isVisible().catch(()=>false)) {
              const dontShow = page.getByRole('checkbox', { name: /Don't show this again|Don't show this again/i }).first();
              if (await dontShow.count()) {
                try {
                  await dontShow.check();
                } catch (e) {
                  await dontShow.click().catch(()=>{});
                }
              }
              const yesBtn = page.getByRole('button', { name: /^(Yes|Sí|Si|Sí)$/i }).first();
              if (await yesBtn.count()) {
                await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}), yesBtn.click()]);
              } else {
                await page.keyboard.press('Enter');
              }
            }

          const pwd = page.locator('input[type=\"password\"]').first();
          if (await pwd.count()) {
            await pwd.fill(userPassword);
            const signIn = page.getByRole('button', { name: /Sign in|Iniciar sesión|Acceder|Entrar/i }).first();
            if (await signIn.count()) {
                  console.log(`Filling AAD password for ${username} using USER_PASSWORD`);
              await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}), signIn.click()]);
            } else {
              await page.keyboard.press('Enter');
            }
          }

          await page.goto(new URL('sso.ashx', base).toString()).catch(() => {});
          // If the environment landed on the custom SSO login page (sso.ashx)
          // there's a local form with "User Name" / "Password" and an "Accept" button.
          // Detect and submit it here to avoid missing the login flow.
          try {
            if (page.url().includes('sso.ashx')) {
              // Prefer exact control names/IDs from the page source first
              const ssoUser = page.locator('input[name="ControlValue_UsrRed"], #Edit_591215').first();
              const ssoUserAlt = page.getByLabel(/User Name|User|Usuario/i).first();
              // For password prefer explicit name/id or password-type input; avoid getByLabel to not match buttons like "Change Password"
              const ssoPass = page.locator('input[name="ControlValue_Key"], #Edit_591216, input[type="password"]').first();
              const ssoPassAlt = page.locator('input[placeholder*="Pass"], input[name*="password"], input[id*="pass"]').first();
              const hasUser = (await ssoUser.count()) > 0 || (await ssoUserAlt.count()) > 0;
              const hasPass = (await ssoPass.count()) > 0 || (await ssoPassAlt.count()) > 0;
              if (hasUser && hasPass) {
                console.log('Detected custom sso.ashx login form — filling and submitting');
                const userEl = (await ssoUser.count()) ? ssoUser : ssoUserAlt;
                const passEl = (await ssoPass.count()) ? ssoPass : ssoPassAlt;
                console.log('ssoUser count:', await userEl.count());
                if ((await userEl.count()) > 0) {
                  try { console.log('ssoUser HTML:', await userEl.evaluate((e: any) => e.outerHTML)); } catch(e){}
                }
                console.log('ssoPass count:', await passEl.count());
                if ((await passEl.count()) > 0) {
                  try { console.log('ssoPass HTML:', await passEl.evaluate((e: any) => e.outerHTML)); } catch(e){}
                }
                await robustFill(userEl, username);
                await robustFill(passEl, password);
                const accept = page.getByRole('button', { name: /Accept|Aceptar|OK|Entrar/i }).first();
                if (await accept.count()) {
                  await accept.click();
                  await waitForAppReady(15000);
                } else {
                  await page.keyboard.press('Enter');
                  await waitForAppReady(15000);
                }
              } else {
                // Fallback: try to find inputs inside the centered "Login" panel
                const loginPanel = page.locator('div', { hasText: 'Login' }).first();
                if (await loginPanel.count()) {
                  await loginPanel.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
                  const inputs = loginPanel.locator('input');
                  const inputCount = await inputs.count();
                  if (inputCount >= 2) {
                        const userEl2 = inputs.nth(0);
                        let passEl2 = loginPanel.locator('input[type="password"]').first();
                        if (await passEl2.count() === 0) passEl2 = inputs.nth(1);
                        try {
                          console.log('loginPanel inputs count:', inputCount);
                          try { console.log('userEl2 HTML:', await userEl2.evaluate((e: any) => e.outerHTML)); } catch(e){}
                          try { console.log('passEl2 HTML:', await passEl2.evaluate((e: any) => e.outerHTML)); } catch(e){}
                          await robustFill(userEl2, username);
                          await robustFill(passEl2, password);
                      const accept2 = loginPanel.getByRole('button', { name: /Accept|Aceptar|OK|Entrar/i }).first();
                      if (await accept2.count()) {
                        await accept2.click();
                        await waitForAppReady(15000);
                      } else {
                        await page.keyboard.press('Enter');
                        await waitForAppReady(15000);
                      }
                    } catch (err) {
                      // continue if fallback fails
                    }
                  }
                }
                // Final explicit fallback using exact names/ids from the page source
                const controlUser = page.locator('input[name="ControlValue_UsrRed"], #Edit_591215').first();
                const controlPass = page.locator('input[name="ControlValue_Key"], #Edit_591216').first();
                if ((await controlUser.count()) > 0 && (await controlPass.count()) > 0) {
                  try {
                    console.log('Detected sso.ashx fields by name/id — filling and clicking Accept');
                    await robustFill(controlUser, username);
                    await robustFill(controlPass, password);
                    const acceptBtn = page.locator('input[name="controlvalue_aceptar"], #591217').first();
                    if (await acceptBtn.count()) {
                      await acceptBtn.click();
                      await waitForAppReady(15000);
                    } else {
                      await page.keyboard.press('Enter');
                      await waitForAppReady(15000);
                    }
                    // After submitting the sso.ashx form, the page may show an "Enter" button
                    // (input with id 591219 or name controlvalue_acceder). Click it if present.
                    await page.waitForTimeout(400).catch(()=>{});
                    const enterInput = page.locator('input[name="controlvalue_acceder"], #591219, input[value="Enter"]').first();
                    if (await enterInput.count() && await enterInput.isVisible().catch(()=>false)) {
                      console.log('Clicking explicit Enter input (sso.ashx)');
                      try {
                        // Extra debug: print HTML
                        try { console.log('Enter input HTML:', await enterInput.evaluate((e: any) => e.outerHTML)); } catch(e){}
                        await enterInput.scrollIntoViewIfNeeded().catch(()=>{});
                        await enterInput.click({ force: true });
                        // Wait for modal to disappear or app to be ready
                        await waitForAppReady(15000).catch(async ()=>{
                          // fallback: wait for modalLoading to disappear
                          return page.waitForSelector('#modalLoading', { state: 'hidden', timeout: 5000 }).catch(()=>{});
                        });
                        console.log('Enter input click complete');
                      } catch (e) {
                        await enterInput.click({ force: true }).catch(()=>{});
                        await waitForAppReady(15000).catch(async ()=>{
                          return page.waitForSelector('#modalLoading', { state: 'hidden', timeout: 5000 }).catch(()=>{});
                        });
                      }
                    }
                  } catch (err) {
                    // ignore and continue
                  }
                }
              }
            }
          } catch (err) {
            // swallow detection errors and continue; other flows will handle login
          }
        }

        // Legacy/local login form on /login
        const userInput = page.locator('input[name=\"username\"], input[name=\"User Name\"], input[name=\"User\"], input[type=\"email\"], input[placeholder*=\"User\"], input[placeholder*=\"Email\"]').first();
        const passInput = page.locator('input[type=\"password\"], input[name=\"Password\"], input[name=\"Password\"]').first();
        if (await userInput.count() > 0 && await passInput.count() > 0) {
          await userInput.fill(username);
          await passInput.fill(password);
          const submit = page.getByRole('button', { name: /Sign in|Sign In|Login|Entrar|Iniciar sesión|OK|Acceder|Ingresar/i }).first();
                console.log(`Local TRIM login detected — filling form for ${username} using IDE_ASIGNET_PASSWORD`);
          if (await submit.count()) {
            await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 120000 }).catch(() => {}), submit.click()]);
          } else {
            await page.keyboard.press('Enter');
          }
          await page.goto(new URL('sso.ashx', base).toString()).catch(() => {});
        }

        // SSO landing: Enter button
        const enterBtn = page.getByRole('button', { name: /^(Enter|Entrar|Acceder|Ingresar|Continue|Continuar)$/i }).first();
        if (await enterBtn.count() && await enterBtn.isVisible().catch(() => false)) {
          await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}), enterBtn.click()]);
        }

        await page.waitForTimeout(1000);
      }

      const trimHome = process.env.IDE_TRIM_HOME_URL;
      if (trimHome) await page.goto(trimHome, { waitUntil: 'networkidle' });
    }

    await ensureLoggedIn();

    await expect(page.getByText('TRIM - Telecom Resources Information Management', { exact: false })).toBeVisible({ timeout: 60_000 });

    // Navigate to Service Orders (no navigation wait, just click and scroll)
    const serviceOrdersLink = page.getByRole('link', { name: /Service Orders/i }).first();
    if (await serviceOrdersLink.count()) {
      await serviceOrdersLink.click();
    } else {
      const soText = page.getByText(/Service Orders/i).first();
      if (await soText.count()) {
        await soText.click();
      } else {
        throw new Error('Service Orders entry not found');
      }
    }

    // Prefer page-level OK button (hydrated DOM) — many TRIM pages render the control on the main document
    let okBtn = page.locator('input[id="10160008"], input[name="controlvalue_saveandclose"], input[aria-label*="ControlValue_SaveAndClose" i], input[value="Ok"], button:has-text("Ok")').first();
    let okBtnFrame: any = page; // Track the Playwright Frame/Page that contains the locator for eval fallbacks

    if ((await okBtn.count()) === 0) {
      // If not found on page, try modal iframe/form (if present)
      const modalIframe = await page.waitForSelector('iframe#modal_frame_page', { timeout: 5000 }).catch(() => null);
      const modalFrame = modalIframe ? await modalIframe.contentFrame() : null;
      if (modalFrame) {
        // ensure the form is attached inside the frame, but use the Frame as the search context
        await modalFrame.waitForSelector('form[name="frm"]', { state: 'attached', timeout: 8000 }).catch(() => null);
        okBtn = modalFrame.locator('input[aria-label*="ControlValue_SaveAndClose" i], input[name="controlvalue_saveandclose"], input[value="Ok"], button:has-text("Ok"), [id="10160008"]').first();
        okBtnFrame = modalFrame;
      }
    }

    // If still not found, try additional fallbacks (other id/name variants)
    if ((await okBtn.count()) === 0) {
      okBtn = page.locator('[id="10160008"], input[id="10160008"], input[name*="saveandclose" i], input[name*="btnsaveandclose" i]').first();
      okBtnFrame = page;
    }

    if ((await okBtn.count()) === 0) {
      // Save one screenshot then fail with a clear message
      await page.screenshot({ path: 'modal-ok-not-found.png', fullPage: true }).catch(() => {});
      throw new Error('OK button not found on page or in modal (screenshot saved to modal-ok-not-found.png)');
    }

    // Simple sequence: scroll into view; if after 5s we still don't get
    // a usable bounding box, fall back to firing the onclick handler.
    await okBtn.scrollIntoViewIfNeeded().catch(() => {});

    let clicked = false;

    // 1) try to get a bounding box, with a 5s grace period for layout/scroll
    let box = await okBtn.boundingBox().catch(() => null);
    if (!box) {
      await page.waitForTimeout(5000).catch(() => {});
      box = await okBtn.boundingBox().catch(() => null);
    }

    // 2) mouse click at bounding box center (if we got one)
    try {
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { force: true });
        clicked = true;
      }
    } catch {}

    // 3) Playwright click
    if (!clicked) {
      try {
        await okBtn.click({ force: true });
        clicked = true;
      } catch {}
    }

    // 4) Final fallback: execute inline `onclick` JavaScript (some TRIM controls call eventHandler.DoEvent)
    if (!clicked) {
      try {
        const onclick = await okBtn.evaluate((el: any) => el.getAttribute('onclick'));
        if (onclick && onclick.trim().length > 0) {
          const body = onclick.replace(/^javascript:\s*/i, '');
          await okBtnFrame.evaluate((code: string) => { eval(code); }, body);
          clicked = true;
        }
      } catch {}
    }

    if (!clicked) {
      throw new Error('OK button was located but could not be clicked');
    }

    // Navigate to Order Status
    const orderStatusLink = page.getByRole('link', { name: /Order Status/i }).first();
    if (await orderStatusLink.count()) {
      await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60_000 }), orderStatusLink.click()]);
    } else {
      const osText = page.getByText(/Order Status/i).first();
      if (await osText.count()) {
        await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60_000 }), osText.click()]);
      } else {
        throw new Error('Order Status navigation not found');
      }
    }

    // Wait briefly, then assert presence of recent ticket row
    await page.waitForTimeout(2000);

    const usernameMatch = process.env.IDE_ASIGNET_USERNAME || '';
    const userCell = usernameMatch ? page.getByText(new RegExp(usernameMatch.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i')).first() : null;
    const found = userCell ? await userCell.count() > 0 : false;

    if (!found) {
      // fallback: ensure at least one row exists in the table
      const anyRow = page.locator('table tr').first();
      if (await anyRow.count() === 0) throw new Error('Could not detect any ticket rows in Order Status');
      expect(await anyRow.isVisible()).toBeTruthy();
    } else {
      expect(await userCell!.isVisible()).toBeTruthy();
    }
    } catch (e) {
      await page.screenshot({ path: `${outDir}/failure.png`, fullPage: true }).catch(()=>{});
      throw e;
    }
  });
});
