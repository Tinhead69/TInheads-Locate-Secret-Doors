# Locate Secret Doors (TEST)

A simple Midi-QOL on-use macro: use the item, scan within 30 scene units, and ping nearby secret doors privately for the GM. Only attach it to items that grant this ability.

## Set up an item

1. Update the module to **0.1.3** and reload the world.
2. Create a **Script** world macro named **Locate Secret Doors**. Paste the contents of [macros/Locate Secret Doors.js](macros/Locate%20Secret%20Doors.js), or import [macros/Locate Secret Doors.json](macros/Locate%20Secret%20Doors.json). Give the relevant players permission to use it.
3. Open the item's **Midi-QOL Macros / On Use Macros** configuration. In current Midi-QOL versions this is available through the item's header controls.
4. Select the world macro **Locate Secret Doors** and run it at **postActiveEffects**, once per use. Select an activity-specific macro slot if you want only one activity to trigger the search.
5. Use the item from the character sheet with its token on the scene.

Change `const RANGE = 30` in the macro for a different radius. Range uses the scene's units, usually feet. No custom activity type, detection panel, per-item flag, or movement automation is required. A macro attached at item level will run whenever that item's workflow reaches the selected pass; use an activity-specific slot to keep searches separate from attacks.

## What happens

The player submits a search request. The GM's client checks secret-door wall segments within range of the token centre. Only GMs receive the result and see local pings; doors remain secret. The GM decides whether to reveal them using Foundry's normal controls.

Pings appear for GMs viewing the searching token's scene. GMs on another scene still receive a private summary with the scene name and door positions. No nearby doors means a private “no secret doors in range” message and no ping.

Distance is measured in two dimensions to the nearest point on each secret-door segment. Intervening walls, lighting, and elevation do not block this proximity search. An active GM is required.

This replaces the earlier test build's sheet panels and automatic movement checks. Any utility activity already created in the world remains yours to use or delete; attach the Midi-QOL macro to it if desired.

## Install

Use this manifest URL in Foundry:

```text
https://raw.githubusercontent.com/Tinhead69/TInheads-Locate-Secret-Doors/main/module.json
```

The test download uses GitHub's ZIP of `main`. No release asset is required. For manual installation, extract `dist/locate-secret-doors-0.1.3-test.zip` into `Data/modules/locate-secret-doors` so `module.json` is directly inside that folder.

Targets: Foundry v14 / D&D 5e 6.0.6, with Foundry v13 / D&D 5e 5.x backward compatibility. This is a test build; live validation in both environments is still required.

## Development

Run `node --test`. Tests cover range geometry, token ownership, private GM handling, local-only pings, and the Midi-QOL macro entry point. Future test updates should increase the numeric version in both manifests before publishing the matching source to `main`.

References: [Midi-QOL macro documentation](https://gitlab.com/tposney/midi-qol/-/blob/v13/MACROS.md), [Foundry local ping API](https://foundryvtt.com/api/v14/classes/foundry.canvas.layers.ControlsLayer.html#drawping).
