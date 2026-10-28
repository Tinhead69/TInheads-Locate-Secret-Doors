import { validateRange } from "./constants.mjs";

/** Closest point on a wall segment, including endpoints and zero-length walls. */
export function closestPoint(origin, coordinates) {
  const [x1, y1, x2, y2] = coordinates;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((origin.x - x1) * dx + (origin.y - y1) * dy) / lengthSquared));
  return { x: x1 + t * dx, y: y1 + t * dy };
}

/** Straight-line, two-dimensional distance in scene units; no sight restriction. */
export function findSecretDoors({ walls, origin, pixelsPerUnit, range, secretDoorType = 2 }) {
  validateRange(range);
  if (!(pixelsPerUnit > 0) || !Number.isFinite(pixelsPerUnit)) {
    throw new Error("The scene must have a positive grid size and grid distance.");
  }
  if (![origin.x, origin.y].every(Number.isFinite)) throw new Error("Invalid token position.");

  const found = [];
  for (const wall of walls) {
    if (wall.door !== secretDoorType) continue;
    if (!Array.isArray(wall.c) || wall.c.length !== 4 || !wall.c.every(Number.isFinite)) continue;
    const point = closestPoint(origin, wall.c);
    const distance = Math.hypot(point.x - origin.x, point.y - origin.y) / pixelsPerUnit;
    if (distance <= range + 1e-8) found.push({ wallId: wall.id, distance, ...point });
  }
  return found.sort((a, b) => a.distance - b.distance);
}
