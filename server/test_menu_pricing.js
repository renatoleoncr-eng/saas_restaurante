const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\6178961d-574c-4f0b-977f-8564c53c362f';

async function logScreenshot(page, name) {
    const ts = Date.now();
    const filename = `precio_individual_menu_${name}_${ts}.webp`;
    const filepath = path.join(ARTIFACT_DIR, filename);
    await page.screenshot({ path: filepath, quality: 80, type: 'webp' });
    console.log(`[Screenshot] Saved ${name}: ${filename}`);
}

(async () => {
    // Launch browser
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    try {
        console.log("Navigating to login...");
        await page.goto('http://localhost:5174');

        // Wait for login or auto-login
        try {
            await page.waitForSelector('input[placeholder="Usuario"]', { timeout: 3000 });
            console.log("Filling login...");
            await page.fill('input[placeholder="Usuario"]', 'admin');
            await page.fill('input[placeholder="Contraseña"]', 'admin123');
            await page.click('button:has-text("Ingresar")');
            await page.waitForNavigation();
        } catch (e) {
            console.log("Already logged in or login form not found.");
        }

        // --- 1. GO TO ADMIN (Configuración) ---
        console.log("Navigating to Admin...");
        await page.goto('http://localhost:5174/admin');
        await page.waitForTimeout(1000);
        await page.click('button:has-text("Menú")');
        await page.waitForTimeout(1000);
        await page.click('button:has-text("Opciones Menú")');
        await page.waitForTimeout(1000);
        await logScreenshot(page, 'admin_menu_options');

        // Let's create an "Entrada" to test the form
        console.log("Opening new Entrada form...");
        // Click the first Plus button (for Entradas)
        const plusButtons = await page.$$('button:has(svg.lucide-plus)');
        if (plusButtons.length > 0) {
            await plusButtons[0].click();
            await page.waitForTimeout(1000);
            await logScreenshot(page, 'admin_new_entrada_form');

            console.log("Filling Entrada form...");
            await page.fill('input[placeholder="Nombre de la Entrada"]', 'Test Entrada Suelta');
            await page.fill('input[placeholder="Precio"]', '4.50');
            await page.click('label:has-text("Libre")');
            await logScreenshot(page, 'admin_filled_entrada_form');

            // Find and click the purple Save button inside the form
            await page.click('button:has-text("Guardar")');
            await page.waitForTimeout(2000); // give it time to save
        } else {
            console.log("Could not find Plus button for entries.");
        }

        // --- 2. GO TO SALON (POS) ---
        console.log("Navigating to POS (Salon)...");
        await page.goto('http://localhost:5174/salon');
        await page.waitForTimeout(2000);

        // Find Mesa 1 and click it
        console.log("Opening Mesa 1...");
        const mesas = await page.$$('.cursor-pointer');
        for (let mesa of mesas) {
            const text = await mesa.innerText();
            if (text.includes('1')) {
                await mesa.click();
                break;
            }
        }
        await page.waitForTimeout(1000);

        // Click on Menús tab
        console.log("Opening Menús tab...");
        await page.click('button:has-text("Menús")');
        await page.waitForTimeout(1000);

        // Click on the Menú del Día card
        const menuCard = await page.$('div:has-text("Menú del Día")');
        if (menuCard) {
            await menuCard.click();
            await page.waitForTimeout(1000);
            await logScreenshot(page, 'pos_armar_menu_open');

            // Select an entry
            console.log("Selecting an Entry...");
            const entries = await page.$$('button:has-text("S/")'); // Entries show prices now
            if (entries.length > 0) {
                // Pick the first entry
                await entries[0].click();
                await page.waitForTimeout(1000);
                await logScreenshot(page, 'pos_armar_menu_entry_selected');

                // Note the Add button text
                const addBtn = await page.$('button:has-text("Agregar")');
                if (addBtn) {
                    const btnText = await addBtn.innerText();
                    console.log(`[POS] Button text with ONLY entry selected: ${btnText}`);
                }

                // Select a main
                console.log("Selecting a Main...");
                // The mains are also buttons with prices, let's just click the 2nd or 3rd one we find
                if (entries.length > 1) {
                    await entries[entries.length - 1].click(); // Assuming last one is a main
                    await page.waitForTimeout(1000);
                    await logScreenshot(page, 'pos_armar_menu_combo_selected');

                    const addBtnCombo = await page.$('button:has-text("Agregar")');
                    if (addBtnCombo) {
                        const btnTextCombo = await addBtnCombo.innerText();
                        console.log(`[POS] Button text with COMBO selected: ${btnTextCombo}`);
                    }
                }
            } else {
                console.log("No menu options found to select.");
            }
        } else {
            console.log("Menu card not found in POS.");
        }

    } catch (e) {
        console.error("Test failed:", e);
        await logScreenshot(page, 'error_state');
    } finally {
        await browser.close();
        console.log("Test finished.");
    }
})();
