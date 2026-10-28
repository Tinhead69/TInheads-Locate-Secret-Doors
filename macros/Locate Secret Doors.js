// Midi-QOL On Use macro: run once at postActiveEffects.
const RANGE = 30; // Scene units: feet on a map measured in feet.
const tokenUuid = (typeof args !== "undefined" ? args[0]?.tokenUuid : undefined)
  ?? (typeof token !== "undefined" ? token?.document?.uuid : undefined)
  ?? canvas.tokens.controlled[0]?.document.uuid;

try {
  const api = game.modules.get("locate-secret-doors")?.api;
  if (!api?.scan) throw new Error("Enable Locate Secret Doors test version 0.1.3 or later.");
  await api.scan(tokenUuid, RANGE);
} catch (error) {
  ui.notifications.warn(error.message);
}
