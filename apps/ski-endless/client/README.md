# ski-endless client

This directory is the real Cocos Creator project root for the `ski-endless` game.

Important:

- Open this directory directly in Cocos Creator.
- Keep gameplay scripts under `assets/scripts/`.
- Do not put shared platform/runtime code here; keep that in the monorepo `packages/` and `services/` layers.

## WeChat Mini Game

- This repository does not include a WeChat Mini Game `AppID`.
- The `AppID` is build-time metadata for Cocos Creator and WeChat DevTools.
- Do not put the `AppID` into shared runtime code or shared packages.

Build notes:

1. Open this project in Cocos Creator.
2. Open the `Build` panel.
3. Select target: `微信小游戏`.
4. Fill `AppID` with the AppID of your own Mini Game.
5. Build the project, then import the generated output into WeChat DevTools.

Runtime notes:

- Runtime API URL and rewarded-video ad unit IDs are loaded from the ignored local file:
  - `assets/scripts/app/SkiEndlessPlatformConfig.local.ts`
- `assets/scripts/app/SkiEndlessPlatformConfig.local.example.ts` documents the required configuration shape.
- `AppID` is not a runtime field and should not be added there.
