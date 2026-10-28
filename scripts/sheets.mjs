/** Register against the common V2 base: D&D 5e item sheets do not inherit ItemSheetV2. */
export function registerDocumentSheetRender(documentName, callback) {
  function render(sheet, html) {
    const doc = sheet.document ?? sheet.object;
    if (doc?.documentName !== documentName) return;
    // A node check also works for sheets detached into another browser window.
    const root = html?.nodeType === 1 ? html : html?.[0];
    if (root) callback(sheet, root, doc);
  }
  Hooks.on("renderApplicationV2", render);
  Hooks.on(`render${documentName}Sheet`, render);
}

/**
 * Register an owned character's search button on modern and legacy sheets.
 * The caller supplies the search workflow so sheet compatibility stays separate
 * from detection rules. Call once during module initialization.
 */
export function registerSheetButton(onSearch) {
  function renderButton(sheet, root, actor) {
    if (actor.type !== "character" || !actor.isOwner) return;

    if (root.querySelector('[data-locate-secret-doors="search"]')) return;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.locateSecretDoors = "search";
    button.className = "locate-secret-doors-button always-interactive";
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

  registerDocumentSheetRender("Actor", renderButton);
}
