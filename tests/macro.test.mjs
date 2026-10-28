import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MODULE_ID } from "../scripts/constants.mjs";

let initialize;
globalThis.Hooks = { once: (name, callback) => { initialize = callback; } };
const { scan, processRequest, showGMPings } = await import("../scripts/module.mjs");

function setup() {
  const gm = { id: "gm", isGM: true };
  const player = { id: "player", isGM: false };
  const otherGM = { id: "otherGM", isGM: true };
  const users = [gm, player, otherGM];
  users.get = id => users.find(user => user.id === id);
  users.activeGM = gm;
  const actor = { isOwner: true, testUserPermission: user => user.id === player.id || user.isGM };
  const token = { id: "token", uuid: "Scene.scene.Token.token", documentName: "Token", name: "<Rogue>", actor, x: 0, y: 0, width: 1, height: 1 };
  const wall = { id: "secret", door: 2, ds: 2, c: [150, 0, 150, 100] };
  const scene = { id: "scene", name: "Dungeon", grid: { size: 100, distance: 5, units: "ft" }, tokens: new Map([[token.id, token]]), walls: [wall] };
  token.parent = scene;
  const messages = [];
  const pings = [];
  const hooks = new Map();
  globalThis.game = { user: gm, users, scenes: new Map([[scene.id, scene]]), modules: new Map([[MODULE_ID, {}]]) };
  globalThis.canvas = {
    ready: true, scene, controls: { drawPing: async (point, options) => pings.push({ point, options }) },
    ping() { throw new Error("Must never broadcast a secret-door ping"); },
    tokens: { controlled: [{ document: token }] }
  };
  globalThis.CONST = { WALL_DOOR_TYPES: { SECRET: 2 } };
  globalThis.fromUuid = async uuid => uuid === token.uuid ? token : null;
  globalThis.foundry = { documents: { ChatMessage: { create: async data => { messages.push(data); return data; } } } };
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback) };
  globalThis.ui = { notifications: { error() {}, warn() {} } };
  const request = { sceneId: scene.id, tokenId: token.id, range: 30 };
  const message = { author: player, getFlag: (scope, key) => key === "request" ? request : undefined };
  return { gm, player, otherGM, actor, token, scene, wall, messages, pings, request, message, hooks };
}

test("on-use request needs no item flags, activity classes, or sheet setup", async () => {
  const { token, player, messages, scene } = setup();
  game.user = player;
  Object.defineProperty(scene, "walls", { get() { throw new Error("Players must not evaluate wall data"); } });
  await scan(token.uuid, 30);
  assert.deepEqual(messages[0].flags[MODULE_ID].request, { sceneId: "scene", tokenId: "token", range: 30 });
  assert.deepEqual(messages[0].whisper, ["gm", "otherGM"]);
});

test("GM scan finds nearby secret doors, whispers results, and leaves doors hidden and locked", async () => {
  const { message, messages, wall, request } = setup();
  request.range = 5;
  await processRequest(message, "player");
  assert.equal(messages[0].flags[MODULE_ID].result.doors.length, 1);
  assert.deepEqual(messages[0].whisper, ["gm", "otherGM"]);
  assert.match(messages[0].content, /&lt;Rogue&gt;/);
  assert.equal(wall.door, 2);
  assert.equal(wall.ds, 2);
  request.range = 4;
  await processRequest(message, "player");
  assert.match(messages[1].content, /No secret doors in range/);
});

test("only the primary GM processes authorized requests", async () => {
  const { message, messages, otherGM, player, actor, gm } = setup();
  game.user = player;
  await processRequest(message, "player");
  game.user = otherGM;
  await processRequest(message, "player");
  game.user = gm;
  await processRequest(message, "otherGM");
  actor.testUserPermission = () => false;
  await processRequest(message, "player");
  assert.equal(messages.length, 0);
});

test("result pings are drawn locally for GMs, never for players or another scene", async () => {
  const { gm, player, pings } = setup();
  const result = { author: gm, getFlag: () => ({ sceneId: "scene", doors: [{ x: 150, y: 50 }] }) };
  await showGMPings(result, "gm");
  assert.deepEqual(pings[0].point, { x: 150, y: 50 });
  game.user = player;
  await showGMPings(result, "gm");
  game.user = gm;
  canvas.scene = { id: "other-scene" };
  await showGMPings(result, "gm");
  assert.equal(pings.length, 1);
});

test("player-authored result flags cannot trigger GM pings", async () => {
  const { player, pings } = setup();
  await showGMPings({ author: player, getFlag: () => ({ sceneId: "scene", doors: [{ x: 150, y: 50 }] }) }, "player");
  assert.equal(pings.length, 0);
});

test("invalid range, missing token, unowned token, and missing GM are rejected", async () => {
  const { token } = setup();
  await assert.rejects(scan(token.uuid, -1), /range/);
  await assert.rejects(scan("missing", 30), /token/);
  token.actor.isOwner = false;
  await assert.rejects(scan(token.uuid, 30), /token/);
  token.actor.isOwner = true;
  game.users.activeGM = null;
  await assert.rejects(scan(token.uuid, 30), /GM/);
});

test("module initialization adds only a macro API and private message handler", () => {
  const { hooks } = setup();
  initialize();
  assert.equal(typeof game.modules.get(MODULE_ID).api.scan, "function");
  assert.deepEqual([...hooks.keys()], ["createChatMessage"]);
});

test("the supplied Midi-QOL macro uses its workflow token and a 30-unit radius", async () => {
  const { token } = setup();
  const calls = [];
  game.modules.get(MODULE_ID).api = { scan: async (...args) => calls.push(args) };
  const command = await readFile(new URL("../macros/Locate Secret Doors.js", import.meta.url), "utf8");
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  const macro = new AsyncFunction("args", "token", command);
  await macro([{ tokenUuid: token.uuid }], null);
  assert.deepEqual(calls, [[token.uuid, 30]]);
  calls.length = 0;
  await macro([], null);
  assert.deepEqual(calls, [[token.uuid, 30]]);
});
