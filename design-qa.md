# Night Uruk design QA · 2026-11-04

Source visual truth: `docs/design/night-uruk-reference.webp`, the second displayed generated option explicitly selected by the user. Implemented in the existing real game, not a new prototype.

Implementation screenshot: `docs/design/night-uruk-desktop.webp`; mobile: `docs/design/night-uruk-mobile-menu.webp`.

Viewport: desktop1440×900 CSS, deviceScaleFactor1; screenshot1440×900. Source1586×991px, same≈1.6 aspect, compared proportionally at1440×900. Mobile390×844 CSS/DPR1; screenshot390×844. Native viewport-only screenshots truncate browser content at784px; full-page browser screenshots used for complete same-size evidence.

State: established seed137, paused daylight, construction drawer open. Real source-game scene retained; photoreal detail in ImageGen concept is illustrative and intentionally not substituted into the renderer. The full actual building catalogue remains accessible via a category selector rather than the concept's two illustrative rows.

## Comparison history

- Initial resource ledger inherited important legacy grids, exposing all16 values across the header. Fixed with scoped keyed primary resources and a full-ledger toggle; only five primary supplies now show, all16 expand.
- Old save and city overview surfaces mixed light backgrounds with new light text. Unified dark sections, light numeric/text contrast, lapis actions; inspected saves and city overview separately.
- Mobile root variables lost specificity, clipping time controls. Corrected body-scoped breakpoint tokens;390px page width equals390px, pause/4×/season fit within844px.
- Moved mobile sound/link controls retained fixed coordinates. Reset positioning; measured sound inside menu, not overlapping dock.
- 2D panel dock hidden in old world heading. Moved fallback dock into Menu;2D H enters and restores map-only.
- Keyboard drawer focus and hidden return targets corrected; construction selection focuses canvas, menu dialogs return to dock. RED→GREEN regression tests.
- Photo mode initially retained header and unused margins. Header/resources/dock hidden, city covers1440×900 and styled photo toolbar stays in bounds; return restores interface.

## Fidelity surfaces

- Typography: local Lora display and Golos Text interface fonts, proper variable weights and Cyrillic/Latin subsets. Restrained two-font hierarchy; clear drawer title and19px desktop dock labels.
- Layout rhythm: slim70px header and80px dock, full remaining city; clay drawer bottom-left, deity identity top-right. Compact actual catalogue is an intentional adaptation. Mobile two-row dock and scrollable drawers.
- Colors/tokens: warm charcoal basalt, clay drawer, lapis selected actions, pale shell text and thin bronze separators; static generated raster material grain.
- Asset quality: generated basalt/clay/lapis and seal, compressed WebP; official Phosphor icons for new navigation, existing project icon system preserved for game items. Actual world is interactive geometry. No backdrop blur or canvas grain workload.
- Content: existing Russian actions, resource balances, year/month/day/time, deity names and labels remain authoritative. All action IDs retained. No mock data shipped in product code.

## Focused comparisons

Header and dock inspected at full CSS resolution; construction drawer, save dialog, city overview and390px mobile menu separately captured and examined. These exposed and resolved the contrast/mobile issues above.

## Interactions

Construction selection and category access; all16 resources expansion; Menu and existing Save dialog; actual snapshot saved in isolated test origin; photo entry/return; 2D Panels and H map-only/restore; keyboard focus/Escape; no browser console errors in checked desktop screen.

## Follow-up polish

None blocking. Existing3D seasonal stalls and old-world geometry are outside this presentation change and are not claimed fixed. Normal desktop dock is intentionally slightly more compact than the illustrative concept. Legacy independent permanent-side-panel options are replaced by contextual drawers and map-only/restore; old saved preferences are not deleted.

## Large city guard

200residents/129buildings,4×,1280×720/DPR1/high,20s: new24.78FPS/p9566.6ms vs old26.64FPS/p9551.9ms. New actual canvas1280×570 vs old825×401.5 (2.20×area). Both saves valid; this is not an optimization acceptance, and existing perf-city-4x remains open. See docs/benchmarks/2026-11-04-night-uruk.json.

Previous pass marked passed; the user subsequently exposed an encyclopedia coverage gap.

## User-reported contrast regression · 2026-11-04

The previous pass missed encyclopedia aside/pre/span/caption/th backgrounds: light inherited text on old pale fills, ratios1.18–1.34. Fixed paired dark surfaces for notes, lyrics, badges, code and table stripes; same pattern corrected in resident chronicle, inventory, production and festival surfaces.

Reproduced before, then checked all8articles/359target elements: min8.25:1, zero targets below4.5. Whole-dialog checks: encyclopedia93text nodes min7.08; city overview38/workshops120 min5.75; chronicle64 min8.76; festival12 min9.10. Mobile390×844:93text nodes min7.08, no page overflow. Computed CSS audit, not a whole-app WCAG certification. Proof: docs/benchmarks/2026-11-04-uruk-contrast.json; screenshot docs/design/night-uruk-encyclopedia-contrast.webp.

17/17 targeted song-encyclopedia/interface tests PASS. CSS-only repair; song content and gameplay unchanged.

final result: passed
