# Locate Secret Doors (TEST)

This is a test build for in-world validation. Foundry displays it as **Locate Secret Doors (TEST)**. The package version is `0.1.1`. Test installations download the current `main` branch; a GitHub release is not required. It has not been verified in a running Foundry instance.

Find secret doors within a configurable range using an action on a D&D 5e weapon or item. Searches succeed automatically within range; there is no Perception check. Results go privately to the GM, who decides whether to reveal each door.

Each item has two modes:

- **Manual:** the player uses the item's **Locate Secret Doors** activity from the character sheet.
- **Automatic:** the module checks when the token moves, is placed, or its scene opens on the primary GM's client. Item and wall changes also trigger checks. No button press is required.

## Install and configure

Install the test build using this manifest URL:

```text
https://raw.githubusercontent.com/Tinhead69/TInheads-Locate-Secret-Doors/main/module.json
```

For manual installation:

1. Extract `dist/locate-secret-doors-0.1.1-test.1.zip` into `Data/modules/locate-secret-doors` in Foundry's user-data directory. The extracted `module.json` must be directly inside that folder.
2. Restart Foundry and enable **Locate Secret Doors (TEST)** in the world's module settings.
3. As GM, open a weapon or item sheet. In the **Locate Secret Doors** panel, choose a range and mode, then click **Add Locate Secret Doors action**.
4. Give the item to a character and place the character's token on a scene. Configuration also works on an item already owned by a character.
5. In Manual mode, use its **Locate Secret Doors** activity. In Automatic mode, move the token near a secret door.

The module adds a separate utility activity and preserves existing attack activities. On a weapon with multiple activities, choose **Locate Secret Doors** to search. An ordinary attack does not search.

Use the GM panel to change the range and mode. Automatic detection is active while the character carries the configured item; it does not require equipping or attunement. Switch to Manual to stop automatic detection.

## GM results

An active GM with the module enabled must be connected. The primary active GM processes searches, including while viewing a different scene. Matches, distances, and wall identifiers are whispered only to GMs. Manual searches also report when no secret doors are found. The player receives a submission notification and can see their own request message.

Each matching door has two GM controls:

- **Show on map:** opens that scene for the GM and pans to the door.
- **Reveal to everyone:** converts the secret door to a normal door, preserving its open/closed/locked state. Normal visibility rules still apply.

Searches never reveal doors by themselves. Automatic mode reports only newly encountered doors and stays quiet when none are found. Remaining in range does not repeat a notification. Leaving and re-entering range allows another notification. Detection memory is temporary; reconnecting or changing the primary GM can repeat a result.

## Range and settings

Range uses the scene's units: `30` means 30 feet in a scene measured in feet, or 30 metres in a scene measured in metres. The editable default is **30**. Each item's saved range overrides the module default.

Distance is measured in two dimensions from the token's centre to the nearest point of the secret-door wall segment, including the range boundary. Detection ignores intervening walls, lighting, sight, elevation, and diagonal movement rules. Movement checks the resulting position, rather than every point along the path. Only walls marked **Secret Door** are detected.

World settings include the default range and an optional standalone character-sheet button. That button is off by default; enabling it adds a manual search using the world default range. Reload after changing its visibility setting.

If a character has multiple tokens on the viewed scene, select exactly one before a manual search. Token-specific character sheets use their own token.

## Compatibility and validation

Primary target: **Foundry v14 / D&D 5e 6.0.6**. Backward target: **Foundry v13 / D&D 5e 5.x**. No external module dependency is required. The utility activity schema and use hook were checked against D&D 5e 5.2.4 and 6.0.6 sources. Both modern and legacy sheet hooks are supported.

Tests use Foundry-shaped test doubles. This release has **not yet been tested inside a running Foundry instance**. The manifest intentionally has no `verified` claim. Custom sheets also require an in-world check.

Run automated tests with Node.js 20 or later:

```sh
node --test
```

Before release, check in both target environments:

- Configure an owned weapon, then a world item copied to a character. Confirm existing attacks still work.
- Use Manual mode as a player, with doors just inside and outside range. Confirm only GMs see results.
- Connect two GMs and confirm only one result is created; repeat while the primary GM views another scene.
- In Automatic mode, enter range, stay in range, leave, and return. Confirm notification suppression and re-entry.
- Change mode and range, reopen the scene, and test linked and unlinked tokens.
- Use the GM map and reveal controls. Confirm a locked door stays locked.

## Script API

For GM setup macros, with an Item document in `item`:

```js
await game.modules.get("locate-secret-doors").api.configureItem(item, {
  range: 30,
  mode: "manual" // or "automatic"
});
```

For a manual search using the world default range, with an Actor document in `actor`:

```js
await game.modules.get("locate-secret-doors").api.search(actor);
```

## Publishing test updates

Push the module source, including `module.json`, `scripts`, and `styles`, to `main` in [Tinhead69/TInheads-Locate-Secret-Doors](https://github.com/Tinhead69/TInheads-Locate-Secret-Doors).

The install/update manifest uses the raw `main` URL. The download URL is `https://github.com/Tinhead69/TInheads-Locate-Secret-Doors/archive/refs/heads/main.zip`, which GitHub generates from the source. No release asset upload is needed for this test channel.

For future test builds, increase the numeric version in `module.json` and `package.json` and push the matching source together. Both URLs remain unchanged. The module ID remains `locate-secret-doors`, preserving item flags and settings. Because this is a moving test channel, downloads track the current source on `main`.

## Development references

- [Foundry module development](https://foundryvtt.com/article/module-development/)
- [Foundry v13 API](https://foundryvtt.com/api/v13/)
- [Foundry v14 API](https://foundryvtt.com/api/v14/)
- [D&D 5e 5.2.4 activity implementation](https://github.com/foundryvtt/dnd5e/blob/release-5.2.4/module/documents/activity/mixin.mjs)
- [D&D 5e 6.0.6 activity implementation](https://github.com/foundryvtt/dnd5e/blob/release-6.0.6/module/documents/activity/mixin.mjs)
