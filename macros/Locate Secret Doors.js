// Standalone Midi-QOL On Use macro: postActiveEffects, once per use.
const RANGE = 30; // Scene units, normally feet.
const data = typeof args !== "undefined" ? args[0] : null;
const source = data?.tokenUuid ? await fromUuid(data.tokenUuid)
  : (typeof token !== "undefined" ? token?.document ?? token : null)
    ?? canvas.tokens.controlled[0]?.document;
if (!source?.parent?.walls) return ui.notifications.warn("Select the character's token first.");
if (!game.users.activeGM) return ui.notifications.warn("A GM must be connected.");

const scene = source.parent;
const size = scene.grid.size;
if (!(size > 0) || !(scene.grid.distance > 0)) return ui.notifications.warn("Invalid scene distance scale.");
const origin = { x: source.x + source.width * size / 2, y: source.y + source.height * size / 2 };
const radius = RANGE * size / scene.grid.distance;
const found = [];

for (const wall of scene.walls) {
  if (wall.door !== CONST.WALL_DOOR_TYPES.SECRET) continue;
  const [x1, y1, x2, y2] = wall.c;
  const dx = x2 - x1, dy = y2 - y1;
  const length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1,
    ((origin.x - x1) * dx + (origin.y - y1) * dy) / length2)) : 0;
  const point = { x: x1 + t * dx, y: y1 + t * dy };
  if (Math.hypot(point.x - origin.x, point.y - origin.y) <= radius) found.push(point);
}

const chatData = {
  speaker: { scene: scene.id, token: source.id, actor: source.actor?.id },
  whisper: game.users.filter(user => user.isGM).map(user => user.id),
  content: `<p>Secret doors within ${RANGE} scene units: <strong>${found.length}</strong>.</p>`
    + (found.length ? `<p>Map positions: ${found.map(p => `${Math.round(p.x)}, ${Math.round(p.y)}`).join("; ")}.</p>` : "")
};

if (game.user.isGM) {
  await foundry.documents.ChatMessage.create(chatData);
  if (canvas.ready && canvas.scene?.id === scene.id) {
    await Promise.all(found.map(point => canvas.controls.drawPing(point, {
      style: "pulse", color: "#ffcc33", duration: 2500
    })));
  }
} else {
  // A GM authors the whisper, so the player cannot see its secret locations.
  await MidiQOL.socket().executeAsGM("createChatMessage", { chatData });
}
