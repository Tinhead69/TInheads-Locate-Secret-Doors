// Optional real-DOM regression check: requires Playwright and a Chromium browser.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const root = new URL("../", import.meta.url);
const server = createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  try {
    if (path === "/") {
      response.setHeader("Content-Type", "text/html");
      response.end(`<!doctype html><link rel="stylesheet" href="/styles/module.css">
        <style>.tab:not(.active){display:none}body{width:650px;font:16px sans-serif}</style>
        <form id="item" class="window-content"><nav><button type="button" id="activities-link">Activities</button></nav>
          <section class="description tab active" data-tab="description">Weapon description</section>
          <section class="activities tab" data-tab="activities"><ol id="activity-list"><li>Attack</li></ol></section>
        </form>`);
    } else if (/^\/(scripts\/[a-z-]+\.mjs|styles\/module\.css)$/.test(path)) {
      response.setHeader("Content-Type", path.endsWith(".mjs") ? "text/javascript" : "text/css");
      response.end(await readFile(new URL(path.slice(1), root)));
    } else { response.writeHead(404).end(); }
  } catch (error) { response.writeHead(500).end(error.message); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async () => {
    const hooks = new Map();
    window.Hooks = { on: (name, callback) => hooks.set(name, callback) };
    window.game = { user: { isGM: true }, settings: { get: () => 30 } };
    window.foundry = { utils: { randomID: () => "searchactivity01" } };
    window.ui = { notifications: { info() {}, error(message) { throw new Error(message); } } };
    window.config = null;
    const activities = new Map([["attack", { id: "attack", type: "attack" }]]);
    const item = { documentName: "Item", system: { activities }, getFlag: () => window.config,
      update: async updates => {
        window.config = updates["flags.locate-secret-doors.search"];
        for (const [key, value] of Object.entries(updates)) {
          if (key.startsWith("system.activities.")) {
            activities.set(value._id, { ...value, id: value._id });
            const li = document.createElement("li");
            li.textContent = value.name;
            document.querySelector("#activity-list").append(li);
          }
        }
      }
    };
    const { registerItemConfiguration } = await import("/scripts/items.mjs");
    registerItemConfiguration();
    window.renderItem = html => hooks.get("renderApplicationV2")({ document: item }, html);
    window.renderLegacy = html => hooks.get("renderItemSheet")({ object: item }, { 0: html });
    window.renderItem(document.querySelector("#item"));
    document.querySelector("#activities-link").onclick = () => {
      document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.tab === "activities"));
    };
  });
  const panel = page.locator('[data-tab="activities"] .locate-secret-doors-config');
  assert.equal(await panel.count(), 1);
  assert.equal(await panel.isVisible(), false);
  await page.click("#activities-link");
  assert.equal(await panel.isVisible(), true);
  await panel.locator("[data-lsd-range]").fill("60");
  await panel.locator("[data-lsd-mode]").selectOption("automatic");
  await panel.locator("[data-lsd-save]").click();
  await page.waitForFunction(() => window.config?.range === 60);
  assert.deepEqual(await page.evaluate(() => window.config), {
    activityId: "searchactivity01", range: 60, mode: "automatic"
  });
  assert.deepEqual(await page.locator("#activity-list li").allTextContents(), ["Attack", "Locate Secret Doors"]);
  await page.evaluate(() => {
    window.renderItem(document.querySelector("#item"));
    window.renderItem(document.querySelector('[data-tab="activities"]'));
  });
  assert.equal(await panel.count(), 1, "full and partial rerenders must not duplicate the panel");
  await page.evaluate(() => {
    // D&D 5e's play-mode rerender disables controls unless explicitly interactive.
    document.querySelectorAll('.window-content :is(input,select,button):not(.always-interactive)')
      .forEach(control => { control.disabled = true; });
  });
  assert.equal(await panel.locator("[data-lsd-range]").isEnabled(), true);
  assert.equal(await panel.locator("[data-lsd-mode]").isEnabled(), true);
  assert.equal(await panel.locator("[data-lsd-save]").isEnabled(), true);
  await page.evaluate(() => {
    document.querySelector(".locate-secret-doors-config").remove();
    window.game.user.isGM = false;
    window.renderItem(document.querySelector("#item"));
  });
  assert.equal(await panel.count(), 0, "players must not receive GM configuration controls");
  await page.evaluate(() => {
    window.game.user.isGM = true;
    window.renderLegacy(document.querySelector("#item"));
  });
  assert.equal(await panel.count(), 1, "legacy sheet hook should also populate Activities");
  assert.deepEqual(errors, []);
  console.log("PASS: Activities panel renders; saves range/mode; preserves attacks; avoids duplicate panels; supports legacy sheets; is GM-only.");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
