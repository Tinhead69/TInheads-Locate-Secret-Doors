import { MODULE_ID, DEFAULT_RANGE } from "./constants.mjs";
import { registerSheetButton } from "./sheets.mjs";
import { configureItem, registerItemActivities, registerItemConfiguration } from "./items.mjs";
import { registerResultButtons, registerSearchRequests, requestSearch } from "./search.mjs";
import { registerAutomaticDetection } from "./automatic.mjs";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "range", {
    name: "Default secret-door search range",
    hint: "Distance in scene units. Each configured item has its own range.",
    scope: "world", config: true, type: Number, default: DEFAULT_RANGE,
    range: { min: 0, max: 1000, step: 1 }
  });
  game.settings.register(MODULE_ID, "showSheetButton", {
    name: "Show standalone character-sheet search button",
    hint: "Optional manual search using the default range, in addition to item activities.",
    scope: "world", config: true, type: Boolean, default: false, requiresReload: true
  });
  game.modules.get(MODULE_ID).api = Object.freeze({ search: requestSearch, configureItem });
  registerItemActivities();
  registerItemConfiguration();
  registerSearchRequests();
  registerResultButtons();
  registerAutomaticDetection();
  if (game.settings.get(MODULE_ID, "showSheetButton")) registerSheetButton(actor => requestSearch(actor));
});
