import { MODULE_ID, validateRange } from "./constants.mjs";
import { requestSearch, resolveToken } from "./search.mjs";
import { registerDocumentSheetRender } from "./sheets.mjs";

export async function configureItem(item, { range = game.settings.get(MODULE_ID, "range"), mode = "manual" } = {}) {
  if (!game.user.isGM) throw new Error("Only the GM can configure secret-door detection.");
  if (!item?.system.activities) throw new Error("This item does not support D&D 5e activities.");
  validateRange(range);
  if (!["manual", "automatic"].includes(mode)) throw new Error("Choose Manual or Automatic detection.");
  const previous = item.getFlag(MODULE_ID, "search");
  const existing = previous && item.system.activities.get(previous.activityId);
  const activityId = existing?.type === "utility" ? existing.id : foundry.utils.randomID();
  const updates = { [`flags.${MODULE_ID}.search`]: { activityId, range, mode } };
  if (!existing || existing.type !== "utility") {
    updates[`system.activities.${activityId}`] = {
      _id: activityId, type: "utility", name: "Locate Secret Doors",
      activation: { type: "action", value: 1, override: true },
      range: { override: true, units: "self" },
      target: { override: true, prompt: false },
      consumption: { targets: [], spellSlot: false },
      roll: { formula: "", prompt: false, visible: false }
    };
  }
  await item.update(updates);
  return item.system.activities.get(activityId);
}

export function registerItemActivities() {
  Hooks.on("dnd5e.preUseActivity", activity => {
    const config = activity.item?.getFlag(MODULE_ID, "search");
    if (config?.activityId !== activity.id) return;
    if (config.mode === "automatic") {
      ui.notifications.info("This item's secret-door detection is automatic when its token moves.");
      return false;
    }
    // Stop before D&D 5e consumes any configured charges if a search cannot run.
    try {
      if (!activity.item.actor?.isOwner || activity.item.actor.type !== "character") {
        throw new Error("The search item must belong to a character you own.");
      }
      if (!game.users.activeGM) throw new Error("A GM must be connected to process this search.");
      resolveToken(activity.item.actor);
    } catch (error) {
      ui.notifications.warn(error.message);
      return false;
    }
  });
  Hooks.on("dnd5e.postUseActivity", activity => {
    const item = activity.item;
    const config = item?.getFlag(MODULE_ID, "search");
    if (!config || config.mode === "automatic" || config.activityId !== activity.id) return;
    // Activity use runs on the initiating client, rather than broadcasting a use hook.
    void requestSearch(item.actor, { item, activityId: activity.id }).catch(error => {
      console.error(`${MODULE_ID} | Item search failed`, error);
      ui.notifications.error(error.message);
    });
  });
}

export function registerItemConfiguration() {
  function renderConfiguration(sheet, root, item) {
    if (!game.user.isGM) return;
    if (!item.system.activities) return;
    const selector = '.tab[data-tab="activities"], .tab.activities';
    const activitiesTab = root.matches(selector) ? root : root.querySelector(selector);
    if (!activitiesTab || activitiesTab.querySelector(".locate-secret-doors-config")) return;
    const config = item.getFlag(MODULE_ID, "search");
    const section = document.createElement("fieldset");
    section.className = "locate-secret-doors-config";
    section.innerHTML = `<legend>Locate Secret Doors</legend>
      <label>Range (scene units) <input type="number" min="0" step="any" class="always-interactive" data-lsd-range></label>
      <label>Detection mode <select class="always-interactive" data-lsd-mode>
        <option value="manual">Manual — use item action</option>
        <option value="automatic">Automatic — when token moves</option>
      </select></label>
      <button type="button" class="always-interactive" data-lsd-save></button>
      <p>Creates a separate activity below, preserving attacks. Results go privately to the GM.
      Automatic mode is active while the item is carried.</p>`;
    const rangeInput = section.querySelector("[data-lsd-range]");
    const modeInput = section.querySelector("[data-lsd-mode]");
    const button = section.querySelector("[data-lsd-save]");
    rangeInput.value = config?.range ?? game.settings.get(MODULE_ID, "range");
    modeInput.value = config?.mode ?? "manual";
    button.textContent = config ? "Save detection settings" : "Add Locate Secret Doors action";
    // These unnamed controls save through our own button, not the item's form.
    section.addEventListener("change", event => event.stopPropagation());
    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      button.disabled = true;
      try {
        if (!rangeInput.value.trim()) throw new Error("Enter a search range.");
        await configureItem(item, { range: Number(rangeInput.value), mode: modeInput.value });
        button.textContent = "Save detection settings";
        ui.notifications.info("Locate Secret Doors settings saved.");
      } catch (error) {
        ui.notifications.error(error.message);
      } finally {
        button.disabled = false;
      }
    });
    // The modern D&D 5e sheet uses a multi-column layout. Add controls inside
    // its Activities tab, rather than adding a new top-level layout column.
    activitiesTab.prepend(section);
  }
  registerDocumentSheetRender("Item", renderConfiguration);
}
