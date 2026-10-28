import test from "node:test";
import assert from "node:assert/strict";
import { closestPoint, findSecretDoors } from "../scripts/geometry.mjs";

test("distance uses the nearest point of the door rather than its midpoint", () => {
  const doors = findSecretDoors({
    walls: [{ id: "long-door", door: 2, c: [100, 0, 100, 1000] }],
    origin: { x: 0, y: 10 }, pixelsPerUnit: 10, range: 10
  });
  assert.deepEqual(doors, [{ wallId: "long-door", distance: 10, x: 100, y: 10 }]);
});

test("endpoint and diagonal distances use Euclidean scene units", () => {
  assert.deepEqual(closestPoint({ x: 0, y: 0 }, [30, 40, 60, 80]), { x: 30, y: 40 });
  const args = {
    walls: [{ id: "endpoint", door: 2, c: [30, 40, 60, 80] }],
    origin: { x: 0, y: 0 }, pixelsPerUnit: 10
  };
  assert.equal(findSecretDoors({ ...args, range: 5 }).length, 1);
  assert.equal(findSecretDoors({ ...args, range: 4.99 }).length, 0);
});

test("zero-length walls and a zero range do not divide by zero", () => {
  assert.equal(findSecretDoors({
    walls: [{ id: "point", door: 2, c: [0, 0, 0, 0] }],
    origin: { x: 0, y: 0 }, pixelsPerUnit: 20, range: 0
  })[0].distance, 0);
});

test("normal doors and malformed walls are excluded; matches are ordered by distance", () => {
  const doors = findSecretDoors({
    walls: [
      { id: "far", door: 2, c: [20, 0, 20, 10] },
      { id: "normal", door: 1, c: [0, 0, 0, 10] },
      { id: "wall", door: 0, c: [0, 0, 0, 10] },
      { id: "broken", door: 2, c: [NaN, 0, 0, 10] },
      { id: "near", door: 2, c: [10, 0, 10, 10] }
    ], origin: { x: 0, y: 0 }, pixelsPerUnit: 10, range: 2
  });
  assert.deepEqual(doors.map(door => door.wallId), ["near", "far"]);
});

test("rejects invalid ranges and grid scales", () => {
  const args = { walls: [], origin: { x: 0, y: 0 }, pixelsPerUnit: 10, range: 30 };
  for (const range of [-1, NaN, Infinity, "30"]) assert.throws(() => findSecretDoors({ ...args, range }));
  for (const pixelsPerUnit of [0, -1, NaN, Infinity]) assert.throws(() => findSecretDoors({ ...args, pixelsPerUnit }));
});
