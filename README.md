# Screen Dimmer

Screen Dimmer puts a click-through black tint over the entire Home Assistant page in a kiosk browser. It is useful for dashboards on displays that do not expose hardware backlight control. The light entity is virtual: changing its brightness changes the browser overlay only where the overlay card and JavaScript resource are loaded.

The slider controls tint strength: off or 0% means no tint, and 100% means the configured maximum black opacity (85% by default). Higher light brightness means stronger black tint, not a brighter display. Every Home Assistant light brightness value from 1 to 255 has its own opacity, with a short CSS transition. The absolute safety cap is 95% so the page remains visible.

## Installation

1. Install this repository as an integration through HACS, or copy its ha_kiosk_screen_dimmer folder into the Home Assistant config directory's custom_components folder. The folder includes the JavaScript and brand/icon.png; no www copy is needed. Home Assistant 2026.3 and later can display the local integration icon.
2. Restart Home Assistant to load the integration's Python code and static resource registration, then add Screen Dimmer in Settings > Devices & Services. Existing entries and entity IDs are preserved.
3. Add /ha_kiosk_screen_dimmer/brightness-dimmer.js?v=0.0.2 as a JavaScript module through Settings > Dashboards > Resources. The version query refreshes cached browser copies after an update. Register this once only; remove the old /local/night-dim-overlay.js?v=2 resource when migrating.
4. Add this manual card once to a kiosk dashboard view:

    type: custom:screen-dimmer-overlay
    entity: light.ha_kiosk_screen_dimmer

The integration domain is unchanged. The old custom:night-dim-overlay card name is an alias only if no legacy script registered it first; use custom:screen-dimmer-overlay for migrations so the old binary script cannot capture the card. An existing entity may have a customized entity ID; use its actual ID in the card. This zero-size card opts that browser tab into the overlay. The overlay follows live Home Assistant state and stays active across views of that dashboard while the tab remains open. A newly opened tab must load a view containing the card before it can dim.

Add a visible light control card on a convenient view. For Bubble Card, one example is:

    type: custom:bubble-card
    card_type: button
    entity: light.ha_kiosk_screen_dimmer
    name: Screen Dimmer
    icon: mdi:brightness-6
    button_type: slider
    light_slider_type: brightness

The slider's higher percentage means more dimming, not greater screen backlight brightness. Screen Dimmer does not change the display's physical brightness.

## Overlay options

The card accepts these optional fields in addition to entity:

| Field | Default | Purpose |
| --- | --- | --- |
| brightness_entity | none | Use a separate light, number, or input_number for tint strength. |
| combine | gate | gate requires entity to be on; either lets the brightness source work independently and uses opacity when the entity is on but the source is off or invalid. |
| opacity | 0.5 | Fixed tint for an on/off entity or a light without a brightness attribute; capped by max_opacity. |
| max_opacity | 0.85 | Tint at 100% slider brightness. Values are clamped to 0–0.95; invalid values use 0.85. |
| brightness_scale | 100 | Maximum for a numeric source without its own max attribute. |
| color | #000000 | Overlay color. |
| overlay_id | ha-kiosk-screen-dimmer-overlay | Overlay DOM ID. |
| transition | opacity 180ms ease-in-out | CSS fade transition. |
| z_index | 99999 | Overlay stacking order. |
| scope | dashboard | dashboard keeps tint within the current dashboard; view limits it to the current view; all explicitly permits other Home Assistant pages in this tab. |

The default dashboard scope is captured from the URL when the card loads. In default gate mode, off, unavailable, missing, or invalid sources clear the tint. In either mode, the independent boolean can still provide its configured fixed tint when the brightness source is off or unavailable. A valid brightness source takes priority. A missing explicitly configured brightness_entity does not fall back to fixed tint in gate mode. The overlay never intercepts clicks and never exceeds the configured max_opacity or the 95% absolute cap.

## Development checks

Run node --test tests/brightness-dimmer.test.js and python3 -m unittest discover -s tests -p test_*.py to check slider levels, endpoints, repeat updates, source failures, dashboard scoping, and entity identity.

## Migrating a scheduled night toggle and slider

If a dashboard already has a scheduled input_boolean and a separate virtual light slider, use one overlay card for both:

    type: custom:screen-dimmer-overlay
    entity: input_boolean.night_mode
    brightness_entity: light.ha_kiosk_screen_dimmer
    combine: either
    opacity: 0.5
    scope: dashboard

When the light slider is on, its level controls the tint even if the boolean is off. When the boolean is on and the light is off or unavailable, its configured 50% night tint remains. Both off clears the page. Keep the existing toggle, slider, and automations; replace duplicate overlay cards with this one card. Replace the registered legacy JavaScript resource with /ha_kiosk_screen_dimmer/brightness-dimmer.js?v=0.0.2 and fully reload the kiosk browser so an old tab cannot keep running the legacy overlay.

The repository-root brightness-dimmer.js is a byte-identical optional copy for older manual www installs. HACS downloads only custom_components/ha_kiosk_screen_dimmer, so use the integration-served URL above for normal installs. Home Assistant retains registered static routes while a process runs; unloading a Screen Dimmer config entry unloads its light entity, but the route is removed only by a Home Assistant restart.
