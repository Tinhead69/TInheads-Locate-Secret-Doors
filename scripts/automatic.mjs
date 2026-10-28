import { MODULE_ID, validateRange } from "./constants.mjs";
import { detectDoors, reportSearch } from "./search.mjs";

/** GM-local state: remember doors in range, and forget them after leaving range. */
export class AutomaticDetector {
  constructor() {
    this.detected = new Map();
    this.queue = Promise.resolve();
  }

  async checkToken(token) {
    if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
    const actor = token.actor;
    if (actor?.type !== "character") return;
    const scene = token.parent;
    for (const item of actor.items) {
      const config = item.getFlag(MODULE_ID, "search");
      if (config?.mode !== "automatic"
        || item.system.activities?.get(config.activityId)?.type !== "utility") continue;
      validateRange(config.range);
      const key = `${scene.id}.${token.id}.${item.id}`;
      const context = { scene, token, actor, item, range: config.range };
      const doors = detectDoors(context);
      const previous = this.detected.get(key) ?? new Set();
      const newlyDetected = doors.filter(door => !previous.has(door.wallId));
      // Only mark success after the GM whisper has been saved.
      if (newlyDetected.length) await reportSearch(context, { automatic: true, doors: newlyDetected });
      this.detected.set(key, new Set(doors.map(door => door.wallId)));
      if (this.detected.size > 1000) this.detected.delete(this.detected.keys().next().value);
    }
  }

  enqueue(tokens) {
    this.queue = this.queue.then(async () => {
      for (const token of tokens) {
        try {
          await this.checkToken(token);
        } catch (error) {
          console.error(`${MODULE_ID} | Automatic detection failed`, error);
          ui.notifications.error(`Automatic secret-door detection failed: ${error.message}`);
        }
      }
    });
    return this.queue;
  }
}

export function registerAutomaticDetection() {
  const detector = new AutomaticDetector();
  const isGM = () => game.user.isGM && game.users.activeGM?.id === game.user.id;
  const scanScene = scene => {
    if (isGM() && scene) void detector.enqueue([...scene.tokens]);
  };
  Hooks.on("canvasReady", canvas => scanScene(canvas.scene));
  Hooks.on("createToken", token => { if (isGM()) void detector.enqueue([token]); });
  Hooks.on("updateToken", (token, changes) => {
    if (isGM() && ["x", "y", "width", "height", "actorId", "delta"].some(key => key in changes)) {
      void detector.enqueue([token]);
    }
  });
  // Recheck when the GM changes an item's mode/range, or scene walls change.
  for (const hook of ["createItem", "updateItem", "deleteItem"]) {
    Hooks.on(hook, item => {
      if (!isGM() || !item.actor) return;
      const tokens = [...game.scenes].flatMap(scene => [...scene.tokens].filter(token => token.actor?.uuid === item.actor.uuid));
      // Leaving automatic mode clears its memory. Unrelated item edits should
      // not repeat notifications for doors which are still in range.
      if (hook === "deleteItem" || item.getFlag(MODULE_ID, "search")?.mode !== "automatic") {
        for (const token of tokens) detector.detected.delete(`${token.parent.id}.${token.id}.${item.id}`);
      }
      void detector.enqueue(tokens);
    });
  }
  for (const hook of ["createWall", "updateWall", "deleteWall"]) Hooks.on(hook, wall => scanScene(wall.parent));
  Hooks.on("userConnected", () => {
    if (isGM()) scanScene(canvas.scene);
  });
  return detector;
}
