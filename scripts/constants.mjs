export const MODULE_ID = "locate-secret-doors";
export const DEFAULT_RANGE = 30;

export function validateRange(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Search range must be a finite number of zero or more scene units.");
  }
  return value;
}

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
