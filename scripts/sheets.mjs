/**
 * Register an owned character's search button on modern and legacy sheets.
 * The caller supplies the search workflow so sheet compatibility stays separate
 * from detection rules. Call once during module initialization.
 */
export function registerSheetButton(onSearch) {
  function renderButton(sheet, html) {
    const actor = sheet.actor ?? sheet.document;
    if (actor?.documentName !== "Actor" || actor.type !== "character" || !actor.isOwner) return;

    // V2 supplies an HTMLElement; older sheets supply a jQuery collection.
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root || root.querySelector('[data-locate-secret-doors="search"]')) return;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.locateSecretDoors = "search";
    button.className = "locate-secret-doors-button";
    button.textContent = "Locate Secret Doors";
    button.title = "Search for secret doors using this character";
    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      button.disabled = true;
      try {
        await onSearch(actor, { sheet, event });
      } catch (error) {
        console.error("locate-secret-doors | Search failed", error);
        ui.notifications.error("Secret-door search failed. See the console for details.");
      } finally {
        button.disabled = false;
      }
    });

    const content = root.querySelector(".window-content") ?? root;
    content.prepend(button);
  }

  Hooks.on("renderActorSheetV2", renderButton);
  Hooks.on("renderActorSheet", renderButton);
}
