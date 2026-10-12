# Screen Dimmer

This card puts a simple black transparent overlay right over your Home Assistant Kiosk screen.

Some screens do not have the capability to interface with your device brightness control, this is here to solve that.

It is controllable either by:

    - Click button
    - Slider

The light brightness controls tint strength, not the display backlight. Off or 0% means no tint; each light brightness value from 1 to 255 maps to its own opacity with a short fade. At 100%, the tint reaches the configured maximum opacity (85% by default); the absolute cap is 95%.

## Installation

1.) In HACS, add `https://github.com/bradleyseanf/ha-kiosk-screen-dimmer` as a custom repository of type `Integration`, then install Screen Dimmer. This is a custom-repository install, not a default HACS listing. Alternatively, copy the `custom_components/ha_kiosk_screen_dimmer` folder into `/homeassistant/custom_components/`. The packaged folder includes the JavaScript file; no separate `www` copy is needed.

2.) Restart Home Assistant.

3.) Open Home Assistant and go to `Settings -> Devices & Services`, then add `Screen Dimmer`.

Home Assistant will create the virtual light entity automatically.

4.) Add `/ha_kiosk_screen_dimmer/brightness-dimmer.js?v=0.0.2` as a JavaScript module in `Settings -> Dashboards -> Resources`.

5.) Add the card to your dashboard by editing the dashboard and adding a manual card:

```yaml
type: custom:screen-dimmer-overlay
entity: light.ha_kiosk_screen_dimmer
```

You only need to add that overlay card once in a browser tab. It stays active across Lovelace view changes within that dashboard and keeps following the live Home Assistant state while that tab stays open.

Use a visible control card for the light entity, for example:

```yaml
type: custom:bubble-card
card_type: button
entity: light.ha_kiosk_screen_dimmer
name: Screen Dimmer
icon: mdi:brightness-6
button_type: slider
light_slider_type: brightness
```

## Attributes

| Attribute | Type | Default | Description |
| --- | --- | --- | --- |
| `entity` | string | required | The entity that turns the overlay on and off. |
| `brightness_entity` | string | none | Optional separate brightness source. |
| `combine` | string | `gate` | `gate` requires the primary entity to be on; `either` lets the slider work independently and retains the primary on/off tint when the slider is off. |
| `opacity` | number | `0.5` | Overlay opacity for boolean-driven use or as a fallback when brightness is unavailable, capped by `max_opacity`. |
| `max_opacity` | number | `0.85` | Tint at 100% slider brightness; configurable from 0 to an absolute safety cap of 0.95. |
| `brightness_scale` | number | `100` | Scale used when the brightness source is not a light entity. |
| `color` | string | `#000000` | Overlay color. |
| `overlay_id` | string | `ha-kiosk-screen-dimmer-overlay` | DOM id used for the overlay element. |
| `transition` | string | `opacity 180ms ease-in-out` | CSS transition for the overlay fade. |
| `z_index` | number | `99999` | Overlay stacking order. |
| `scope` | string | `dashboard` | Limit the overlay to this dashboard by default; `view` or `all` must be selected explicitly. |

For a scheduled night toggle plus an independent light slider, use one `custom:screen-dimmer-overlay` card with the toggle as `entity`, the light as `brightness_entity`, and `combine: either`. An enabled toggle retains its configured `opacity` when the slider is off or unavailable; both off clears the tint. The overlay is click-through and never exceeds `max_opacity` or the 0.95 absolute cap.
