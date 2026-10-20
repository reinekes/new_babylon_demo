# Main game 3D Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for integration; independent art layers use dispatching-parallel-agents. Steps use checkbox syntax.

**Goal:** Play the existing game on its initial page with approved 3D graphics.
**Architecture:** app.js keeps the only state/time/save/UI. game3d/renderer.js adapts the existing Renderer interface; independent building/actor/landscape managers read that state. Same-origin licensed local assets, fallback to existing Canvas renderer.
**Tech Stack:** Existing ESM JavaScript, Babylon.js9.31, local glTF-loader, node:test.
**Spec:** docs/GAME3D_SPEC.md

## Global Constraints
- No simulation/storage writes in render layers; preserve IDs and cargo.
- 6metres per tile; source mesh footprint normalized.
- No purchases or new runtime external services.
- Optimization postponed; measure results honestly.

## Review Focus
- Model load/WebGL failure returns working2D without overwriting state.
- Loaded city reset/new-game replaces allviews; no ghostbuildings or actors.
- Pointerdrag does notbuild; keyboard/road routes retain actions.
- Pause/photo/eventdialog freezes actors while camera remains usable.
- New renderer never mutates saved actors/cargo or invents a second clock.

### Task1: Building manager
- [x] Add tests for level/stage/read-only sync/removal, runred.
- [x] Implement game3d/buildings.js createGameBuildings(B,scene,materials):sync(state),meshes,dispose.
- [x] Run focusedtests and inspect specializedtypes + GLBfootprints.
### Task2: Actors manager
- [x] Add tests for pose/age/realcoordinates/pause/removal, runred.
- [x] Implement game3d/actors.js createGameActors(B,scene,materials):update(state,dt,{paused,speed}),meshes,dispose.
- [x] Check GLB walk/idle/graze, cargo and read-onlystate.
### Task3: Landscape manager
- [x] Add tests for canalwetness/roads/map-boundplacements/read-onlystate, runred.
- [x] Implement game3d/landscape.js createGameLandscape(B,scene,state,materials):update(state,time),light(night),meshes,dispose.
- [x] Verify actualmap/palms/trader coordinates and rebuilding after changes.
### Task4: Main renderer/integration
- [x] Add testsgame3d-renderer.test.js forpicking/clamps/roadselection/stateimmutability and fallback, runred.
- [x] Implement game3d/renderer.js existingmethods draw/resize/layout/home/overview/focusOn/setRoadMode/addEffect; map actualselection and photo state.
- [x] Add asyncfactory withloading/fallback, wireapp/index; complete raypick/preview/nightlights/effects.
- [x] Verify real browsernewcity/build/inspect/road/pause/miracle/save/reload/mobile/photo/fallback.
### Task5: Verification and publication
- [x] Fulltests + fresh independentreview; fiximportant findings.
- [x] Recordjournal and version06, commitonlytaskfiles,pushPages.
- [ ] ConfirmPages success/checksums/livebrowser + captures, updateversionstatus.
