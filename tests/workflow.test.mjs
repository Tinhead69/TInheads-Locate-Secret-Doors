import test from "node:test";
import assert from "node:assert/strict";
import { MODULE_ID } from "../scripts/constants.mjs";
import { requestSearch, processRequest, validateRequest, resolveToken, registerResultButtons } from "../scripts/search.mjs";
import { configureItem, registerItemActivities } from "../scripts/items.mjs";
import { AutomaticDetector, registerAutomaticDetection } from "../scripts/automatic.mjs";

class Collection extends Map {
  [Symbol.iterator]() { return this.values(); }
  filter(fn) { return [...this].filter(fn); }
  map(fn) { return [...this].map(fn); }
}

function setup() {
  const messages = [];
  const gm = { id: "gm", isGM: true, active: true };
  const player = { id: "player", isGM: false, active: true };
  const otherGM = { id: "otherGM", isGM: true, active: true };
  const users = new Collection([[gm.id, gm], [player.id, player], [otherGM.id, otherGM]]);
  users.activeGM = gm;
  const actor = {
    id: "actor", uuid: "Actor.actor", type: "character", name: "<Rogue>", isOwner: true,
    testUserPermission: user => user.id === "player" || user.isGM,
    items: new Collection()
  };
  const config = { range: 10, mode: "manual", activityId: "search" };
  const item = {
    id: "item", name: "Dowsing Sword", actor,
    system: { activities: new Map([["attack", { id: "attack", type: "attack" }], ["search", { id: "search", type: "utility" }]]) },
    getFlag: (scope, key) => scope === MODULE_ID && key === "search" ? config : undefined,
    update: async updates => {
      Object.assign(config, updates[`flags.${MODULE_ID}.search`]);
      for (const [key, value] of Object.entries(updates)) {
        if (key.startsWith("system.activities.")) item.system.activities.set(value._id, { ...value, id: value._id });
      }
    }
  };
  actor.items.set(item.id, item);
  const wall = { id: "secret", door: 2, ds: 2, c: [150, 0, 150, 100], update: async changes => Object.assign(wall, changes) };
  const scene = { id: "scene", name: "Dungeon", grid: { size: 100, distance: 5, units: "ft" }, tokens: new Collection(), walls: new Collection([[wall.id, wall]]) };
  const token = { id: "token", actor, x: 0, y: 0, width: 1, height: 1, parent: scene };
  scene.tokens.set(token.id, token);
  globalThis.game = {
    user: gm, users, scenes: new Collection([[scene.id, scene]]),
    settings: { get: () => 30 }
  };
  globalThis.CONST = { WALL_DOOR_TYPES: { SECRET: 2, DOOR: 1 } };
  globalThis.foundry = {
    documents: { ChatMessage: { create: async data => { messages.push(data); return data; } } },
    utils: { randomID: () => "newactivity000001" }
  };
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
  globalThis.canvas = {
    ready: true, scene,
    tokens: { controlled: [], placeables: [{ actor, document: token }] }
  };
  const hooks = new Map();
  globalThis.Hooks = { on(name, fn) { const entries = hooks.get(name) ?? []; entries.push(fn); hooks.set(name, entries); } };
  const request = { sceneId: scene.id, tokenId: token.id, itemId: item.id, activityId: "search" };
  const message = { id: "request", author: player, getFlag: (scope, key) => key === "request" ? request : undefined };
  return { messages, gm, player, otherGM, actor, item, config, wall, scene, token, message, request, hooks };
}

test("manual search is GM-only, reads the item's range, and never reveals a door", async () => {
  const { messages, wall, message, config } = setup();
  config.range = 4;
  await processRequest(message, "player");
  assert.match(messages[0].content, /No secret doors found/);
  config.range = 5;
  await processRequest(message, "player");
  assert.deepEqual(messages[1].whisper, ["gm", "otherGM"]);
  assert.equal(messages[1].flags[MODULE_ID].result.doors.length, 1);
  assert.match(messages[1].content, /&lt;Rogue&gt;/);
  assert.equal(wall.door, 2);
  assert.equal(wall.ds, 2);
});

test("players and secondary GMs do not evaluate requests", async () => {
  const { messages, player, otherGM, message, scene } = setup();
  Object.defineProperty(scene, "walls", { get: () => { throw new Error("must not read walls"); } });
  game.user = player;
  await processRequest(message, "player");
  game.user = otherGM;
  await processRequest(message, "player");
  assert.equal(messages.length, 0);
});

test("rejects forged authors, nonowners, nonexistent activities, and automatic items", () => {
  const { message, actor, config, request } = setup();
  assert.equal(validateRequest(message, "otherGM"), null);
  actor.testUserPermission = () => false;
  assert.equal(validateRequest(message, "player"), null);
  actor.testUserPermission = () => true;
  request.activityId = "attack";
  assert.equal(validateRequest(message, "player"), null);
  request.activityId = "search";
  config.mode = "automatic";
  assert.equal(validateRequest(message, "player"), null);
});

test("player request contains intent only, with no discovered doors or range override", async () => {
  const { actor, item, player, messages, scene } = setup();
  game.user = player;
  Object.defineProperty(scene, "walls", { get: () => { throw new Error("player must not evaluate doors"); } });
  await requestSearch(actor, { item, activityId: "search", range: 9999 });
  assert.deepEqual(messages[0].whisper, ["gm", "otherGM"]);
  assert.deepEqual(messages[0].flags[MODULE_ID], {
    request: { sceneId: "scene", tokenId: "token", itemId: "item", activityId: "search" }
  });
});

test("manual search refuses missing GMs and ambiguous tokens", async () => {
  const { actor, token } = setup();
  game.users.activeGM = null;
  await assert.rejects(requestSearch(actor), /GM/);
  canvas.tokens.placeables.push({ actor, document: { ...token, id: "duplicate" } });
  assert.throws(() => resolveToken(actor), /select its token/);
  canvas.tokens.controlled = [canvas.tokens.placeables[1]];
  assert.equal(resolveToken(actor).id, "duplicate");
});

test("automatic detection reports once in range and again after leaving and returning", async () => {
  const { config, token, messages } = setup();
  config.mode = "automatic";
  const detector = new AutomaticDetector();
  await detector.checkToken(token);
  await detector.checkToken(token);
  assert.equal(messages.length, 1);
  assert.match(messages[0].content, /Automatic secret-door detection/);
  token.x = 1000;
  await detector.checkToken(token);
  assert.equal(messages.length, 1);
  token.x = 0;
  await detector.checkToken(token);
  assert.equal(messages.length, 2);
});

test("automatic mode ignores manual items and runs only on the primary GM", async () => {
  const { token, config, messages, player, otherGM } = setup();
  const detector = new AutomaticDetector();
  await detector.checkToken(token);
  config.mode = "automatic";
  game.user = player;
  await detector.checkToken(token);
  game.user = otherGM;
  await detector.checkToken(token);
  assert.equal(messages.length, 0);
});

test("saving item settings preserves its attack and reuses its utility activity", async () => {
  const { item, config, player } = setup();
  await configureItem(item, { range: 60, mode: "automatic" });
  assert.equal(item.system.activities.size, 2);
  assert.equal(item.system.activities.get("attack").type, "attack");
  assert.deepEqual(config, { range: 60, mode: "automatic", activityId: "search" });
  await assert.rejects(configureItem(item, { range: -1 }), /range/);
  game.user = player;
  await assert.rejects(configureItem(item), /Only the GM/);
});

test("adding a search action creates only a utility activity and keeps existing attacks", async () => {
  const { item, config } = setup();
  item.system.activities.delete("search");
  await configureItem(item, { range: 15, mode: "manual" });
  assert.equal(item.system.activities.size, 2);
  assert.equal(item.system.activities.get(config.activityId).type, "utility");
  assert.equal(item.system.activities.get(config.activityId).consumption.spellSlot, false);
});

test("item activity hook does not trigger on the weapon's normal attack", async () => {
  const { hooks, item, actor, messages, config } = setup();
  registerItemActivities();
  const postUse = hooks.get("dnd5e.postUseActivity")[0];
  postUse({ id: "attack", item, actor });
  assert.equal(messages.length, 0);
  postUse({ id: "search", item, actor });
  await Promise.resolve();
  assert.equal(messages.length, 1);
  config.mode = "automatic";
  assert.equal(hooks.get("dnd5e.preUseActivity")[0]({ id: "search", item }), false);
});

test("manual item activation is stopped before consumption when no GM or token is available", () => {
  const { hooks, item } = setup();
  registerItemActivities();
  const preUse = hooks.get("dnd5e.preUseActivity")[0];
  assert.equal(preUse({ id: "search", item }), undefined);
  game.users.activeGM = null;
  assert.equal(preUse({ id: "search", item }), false);
  game.users.activeGM = game.users.get("gm");
  canvas.tokens.placeables = [];
  assert.equal(preUse({ id: "search", item }), false);
});

test("item edits do not repeat automatic results, and changing to manual resets detection", async () => {
  const { config, item, token, messages, hooks } = setup();
  config.mode = "automatic";
  const detector = registerAutomaticDetection();
  await detector.checkToken(token);
  hooks.get("updateItem")[0](item, {});
  await detector.queue;
  assert.equal(messages.length, 1);
  config.mode = "manual";
  hooks.get("updateItem")[0](item, {});
  await detector.queue;
  config.mode = "automatic";
  hooks.get("updateItem")[0](item, {});
  await detector.queue;
  assert.equal(messages.length, 2);
});

test("only an explicit GM result-button click reveals a door and preserves its lock state", async () => {
  const { hooks, wall, gm } = setup();
  let click;
  const button = {
    disabled: false, dataset: { lsdAction: "reveal", wallId: wall.id },
    addEventListener: (event, listener) => { click = listener; }
  };
  registerResultButtons();
  const render = hooks.get("renderChatMessageHTML")[0];
  render({ author: gm, getFlag: () => ({ sceneId: "scene", doors: [{ wallId: wall.id }] }) }, {
    querySelectorAll: () => [button]
  });
  assert.equal(wall.door, 2);
  await click({ preventDefault() {}, stopPropagation() {} });
  assert.equal(wall.door, 1);
  assert.equal(wall.ds, 2);
});
