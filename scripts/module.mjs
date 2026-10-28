import { MODULE_ID, DEFAULT_RANGE, validateRange, escapeHTML } from "./constants.mjs";
import { findSecretDoors } from "./geometry.mjs";

/** Called by the item's Midi-QOL on-use macro. */
export async function scan(tokenUuid, range = DEFAULT_RANGE) {
  validateRange(range);
  const token = typeof tokenUuid === "string" ? await fromUuid(tokenUuid) : null;
  if (token?.documentName !== "Token" || !token.actor?.isOwner) {
    throw new Error("Use the item from its character's token, or select that token first.");
  }
  if (!game.users.activeGM) throw new Error("A GM must be connected for a secret-door search.");
  return foundry.documents.ChatMessage.create({
    content: `<p>${escapeHTML(token.name)} searches for secret doors.</p>`,
    whisper: game.users.filter(user => user.isGM).map(user => user.id),
    flags: { [MODULE_ID]: { request: { sceneId: token.parent.id, tokenId: token.id, range } } }
  });
}

/** The primary GM validates and evaluates requests; players receive no door data. */
export async function processRequest(message, userId) {
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
  const request = message.getFlag(MODULE_ID, "request");
  const user = game.users.get(userId);
  if (!request || !user || message.author?.id !== userId) return;
  validateRange(request.range);
  const scene = game.scenes.get(request.sceneId);
  const token = scene?.tokens.get(request.tokenId);
  if (!token?.actor?.testUserPermission(user, "OWNER")) return;
  const size = scene.grid.size;
  if (!(size > 0) || !(scene.grid.distance > 0)) throw new Error("Invalid scene distance scale.");
  const doors = findSecretDoors({
    walls: scene.walls,
    origin: { x: token.x + token.width * size / 2, y: token.y + token.height * size / 2 },
    pixelsPerUnit: size / scene.grid.distance, range: request.range,
    secretDoorType: CONST.WALL_DOOR_TYPES.SECRET
  });
  const units = escapeHTML(scene.grid.units || "units");
  const details = doors.length
    ? `<ul>${doors.map(door => `<li>${door.distance.toFixed(1)} ${units} away
      (wall ${escapeHTML(door.wallId)}, map position ${Math.round(door.x)}, ${Math.round(door.y)})</li>`).join("")}</ul>`
    : "<p>No secret doors in range.</p>";
  return foundry.documents.ChatMessage.create({
    content: `<h3>Secret-door search</h3><p>${escapeHTML(token.name)}:
      ${doors.length} secret door(s) within ${request.range} ${units}, in ${escapeHTML(scene.name)}.</p>
      ${details}<p>GM only. Doors have not been revealed.</p>`,
    whisper: game.users.filter(user => user.isGM).map(user => user.id),
    flags: { [MODULE_ID]: { result: { sceneId: scene.id, doors } } }
  });
}

/** Draw locally on each GM's canvas. Never broadcast secret locations to players. */
export async function showGMPings(message, userId) {
  if (!game.user.isGM || !message.author?.isGM || message.author.id !== userId) return;
  const result = message.getFlag(MODULE_ID, "result");
  if (!result || !canvas.ready || result.sceneId !== canvas.scene?.id) return;
  for (const door of result.doors) {
    if (!Number.isFinite(door.x) || !Number.isFinite(door.y)) continue;
    // drawPing is local; canvas.ping would broadcast to the other clients.
    void canvas.controls.drawPing({ x: door.x, y: door.y }, {
      style: "pulse", color: "#ffcc33", duration: 2500
    }).catch(error => console.error(`${MODULE_ID} | Ping failed`, error));
  }
}

Hooks.once("init", () => {
  game.modules.get(MODULE_ID).api = Object.freeze({ scan });
  Hooks.on("createChatMessage", (message, options, userId) => {
    const task = message.getFlag(MODULE_ID, "request")
      ? processRequest(message, userId) : showGMPings(message, userId);
    void task.catch(error => {
      console.error(`${MODULE_ID} | Search failed`, error);
      if (game.user.isGM) ui.notifications.error(error.message);
    });
  });
});
