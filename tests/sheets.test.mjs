import test from "node:test";
import assert from "node:assert/strict";
import { registerDocumentSheetRender } from "../scripts/sheets.mjs";

test("D&D 5e DocumentSheetV2 item sheets are handled without inheriting ItemSheetV2", () => {
  const hooks = new Map();
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback) };
  const calls = [];
  registerDocumentSheetRender("Item", (...args) => calls.push(args));
  const item = { documentName: "Item" };
  const sheet = { document: item };
  const root = { nodeType: 1 };
  assert.ok(hooks.has("renderApplicationV2"));
  hooks.get("renderApplicationV2")(sheet, root);
  assert.deepEqual(calls, [[sheet, root, item]]);
  hooks.get("renderApplicationV2")({ document: { documentName: "Actor" } }, root);
  hooks.get("renderApplicationV2")({ document: { documentName: "Activity" } }, root);
  assert.equal(calls.length, 1);
});

test("legacy item sheets accept jQuery wrappers and their object document", () => {
  const hooks = new Map();
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback) };
  const calls = [];
  registerDocumentSheetRender("Item", (...args) => calls.push(args));
  const item = { documentName: "Item" };
  const sheet = { object: item };
  const root = { nodeType: 1 };
  hooks.get("renderItemSheet")(sheet, { 0: root });
  assert.deepEqual(calls, [[sheet, root, item]]);
});
