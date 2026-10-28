# Locate Secret Doors — standalone Midi-QOL macro

Paste [macros/Locate Secret Doors.js](macros/Locate%20Secret%20Doors.js) into a Midi-QOL on-use macro and run it once at **postActiveEffects**. Alternatively import the supplied JSON as a Script world macro and select it in Midi-QOL's on-use configuration.

**The macro does not call or require the Locate Secret Doors module.** It performs the wall scan itself. Attach it only to items or activities which grant the ability. Change `RANGE = 30` for another radius in scene units, usually feet.

## Private results and pings

- When run by a player, it asks Midi-QOL to create the result whisper as a GM, so only GMs see the secret locations. It does not broadcast pings.
- When run by a GM viewing the token's scene, it also draws local pings on that GM's map.
- A standalone macro executing only on a player's client cannot draw a private ping on a GM's canvas without GM-side execution or a listener. This macro keeps the findings private rather than using a public ping.

It measures straight-line, two-dimensional distance from the using token's centre to each secret-door wall segment. Normal doors are ignored. Walls, lighting, and elevation do not block the search. Doors are never changed or revealed. An active GM is required.

The earlier module helper remains in the repository for reference, but it is unnecessary for this standalone macro and can be disabled. No special activity type, detection panel, item flags, or module update is needed to use the macro.

Run `node --test` for the standalone-macro and helper regression checks. Tests use Foundry-shaped doubles; live Foundry v13/v14 and Midi-QOL testing is still required.

References: [Midi-QOL on-use macros](https://gitlab.com/tposney/midi-qol/-/blob/v13/MACROS.md), [Midi-QOL GM socket handlers](https://gitlab.com/tposney/midi-qol/-/blob/v13/src/module/GMAction.ts), [Foundry local ping API](https://foundryvtt.com/api/v14/classes/foundry.canvas.layers.ControlsLayer.html#drawping).
