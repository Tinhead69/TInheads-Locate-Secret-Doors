import { MODULE_ID, escapeHTML, validateRange } from "./constants.mjs";
import { findSecretDoors } from "./geometry.mjs";

export function gmRecipients() {
  return game.users.filter(user => user.isGM).map(user => user.id);
}

/** Resolve this sheet's token without silently choosing between actor copies. */
export function resolveToken(actor) {
  if (!canvas.ready || !canvas.scene) throw new Error("Open a scene containing this character first.");
  if (actor.isToken) {
    if (actor.token?.parent?.id !== canvas.scene.id) throw new Error("Open this token's scene first.");
    return actor.token;
  }
  const controlled = canvas.tokens.controlled.filter(token => token.actor?.id === actor.id);
  if (controlled.length === 1) return controlled[0].document;
  if (controlled.length > 1) throw new Error("Select just one token belonging to this character.");
  const matches = canvas.tokens.placeables.filter(token => token.actor?.id === actor.id);
  if (matches.length !== 1) throw new Error("Place this character on the scene and select its token.");
  return matches[0].document;
}

/** Players submit intent only. Secret wall data is evaluated exclusively by a GM. */
export async function requestSearch(actor, { item, activityId } = {}) {
  if (!actor?.isOwner || actor.type !== "character") throw new Error("You must own the searching character.");
  if (!game.users.activeGM) throw new Error("A GM with Locate Secret Doors enabled must be connected.");
  const token = resolveToken(actor);
  if (item && (item.actor?.uuid !== actor.uuid || !activityId)) throw new Error("Invalid search item.");
  const request = { sceneId: token.parent.id, tokenId: token.id };
  if (item) Object.assign(request, { itemId: item.id, activityId });

  const message = await foundry.documents.ChatMessage.create({
    content: `<p>${escapeHTML(actor.name)} requests a secret-door search.</p>`,
    whisper: gmRecipients(),
    flags: { [MODULE_ID]: { request } }
  });
  ui.notifications.info("Secret-door search sent privately to the GM.");
  return message;
}

/** Validate the creator and read the authoritative token, item, and range as GM. */
export function validateRequest(message, userId) {
  const request = message.getFlag(MODULE_ID, "request");
  const requester = game.users.get(userId);
  if (!request || !requester || message.author?.id !== userId) return null;
  const scene = game.scenes.get(request.sceneId);
  const token = scene?.tokens.get(request.tokenId);
  const actor = token?.actor;
  if (!actor || actor.type !== "character"
    || !actor.testUserPermission(requester, "OWNER")) return null;

  let range = game.settings.get(MODULE_ID, "range");
  let item;
  if (request.itemId || request.activityId) {
    item = actor.items.get(request.itemId);
    const config = item?.getFlag(MODULE_ID, "search");
    const activity = item?.system.activities?.get(request.activityId);
    if (!config || config.mode === "automatic" || config.activityId !== request.activityId
      || activity?.type !== "utility") return null;
    range = config.range;
  }
  validateRange(range);
  return { scene, token, actor, item, range };
}

export async function processRequest(message, userId) {
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
  const context = validateRequest(message, userId);
  if (!context) return;
  return reportSearch(context, { requestId: message.id });
}

export function detectDoors({ scene, token, range }) {
  const size = scene.grid.size;
  const unitDistance = scene.grid.distance;
  if (!(size > 0) || !(unitDistance > 0)) throw new Error("Invalid scene grid scale.");
  const origin = { x: token.x + token.width * size / 2, y: token.y + token.height * size / 2 };
  return findSecretDoors({
    walls: scene.walls, origin, pixelsPerUnit: size / unitDistance,
    range, secretDoorType: CONST.WALL_DOOR_TYPES.SECRET
  });
}

export async function reportSearch(context, { requestId, automatic = false, doors = detectDoors(context) } = {}) {
  const { scene, actor, item, range } = context;
  const units = escapeHTML(scene.grid.units || "units");
  const rows = doors.map((door, index) => `<li>
    Door ${index + 1}: ${door.distance.toFixed(1)} ${units}
    <small>(wall ${escapeHTML(door.wallId)})</small>
    <button type="button" data-lsd-action="locate" data-wall-id="${escapeHTML(door.wallId)}">Show on map</button>
    <button type="button" data-lsd-action="reveal" data-wall-id="${escapeHTML(door.wallId)}">Reveal to everyone</button>
  </li>`).join("");
  return foundry.documents.ChatMessage.create({
    content: `<section class="locate-secret-doors-result"><h3>${automatic ? "Automatic secret-door detection" : "Secret-door search"}</h3>
      <p><strong>${escapeHTML(actor.name)}</strong>${item ? ` using ${escapeHTML(item.name)}` : ""}
      searched within ${range} ${units} in ${escapeHTML(scene.name)}.</p>
      ${doors.length ? `<ol>${rows}</ol>` : "<p>No secret doors found within range.</p>"}
      <p>GM only. Doors remain secret until you choose to reveal them.</p></section>`,
    whisper: gmRecipients(),
    flags: { [MODULE_ID]: { result: { ...(requestId ? { requestId } : {}), sceneId: scene.id, doors } } }
  });
}

export function registerSearchRequests() {
  const seen = new Set();
  Hooks.on("createChatMessage", (message, options, userId) => {
    if (!game.user.isGM || !message.getFlag(MODULE_ID, "request") || seen.has(message.id)) return;
    if (game.users.activeGM?.id !== game.user.id) return;
    seen.add(message.id);
    if (seen.size > 500) seen.delete(seen.values().next().value);
    void processRequest(message, userId).catch(error => {
      console.error(`${MODULE_ID} | GM search failed`, error);
      ui.notifications.error(`Secret-door search failed: ${error.message}`);
    });
  });
}

export function registerResultButtons() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    if (!game.user.isGM || !message.author?.isGM) return;
    const result = message.getFlag(MODULE_ID, "result");
    if (!result) return;
    for (const button of html.querySelectorAll("button[data-lsd-action]")) {
      button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        const door = result.doors.find(entry => entry.wallId === button.dataset.wallId);
        const scene = game.scenes.get(result.sceneId);
        const wall = door && scene?.walls.get(door.wallId);
        if (!wall) return ui.notifications.warn("This door or scene no longer exists.");
        button.disabled = true;
        try {
          if (button.dataset.lsdAction === "reveal") {
            if (wall.door === CONST.WALL_DOOR_TYPES.SECRET) await wall.update({ door: CONST.WALL_DOOR_TYPES.DOOR });
            button.textContent = "Revealed";
          } else {
            if (canvas.scene?.id !== scene.id) await scene.view();
            const [x1, y1, x2, y2] = wall.c;
            await canvas.animatePan({ x: (x1 + x2) / 2, y: (y1 + y2) / 2 });
            button.disabled = false;
          }
        } catch (error) {
          button.disabled = false;
          ui.notifications.error(`Door action failed: ${error.message}`);
        }
      });
    }
  });
}
