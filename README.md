# Home Assistant Kiosk Dimmer

For those pesky screens that keeps your wife awake at night.

This card puts a simple black transparent overlay right over your Home Assistant Kiosk screen.

Some screens do not have the capability to interface with your device brightness control, this is here to solve that.

It is controllable either by:

    - Click button
    - Slider

## Installation

1.) Copy the `brightness-dimmer.js` file into `/homeassistant/www/`.

2.) Copy the entire `ha_kiosk_screen_dimmer` folder into `/homeassistant/custom_components/`.

3.) Restart Home Assistant.

4.) Open Home Assistant and go to `Settings → Devices & Services`.

5.) Add `HA Kiosk Screen Dimmer`.

Home Assistant will create the virtual light entity automatically.

Add the card to your dashboard by editing the dashboard and adding a manual card:

```yaml
type: custom:night-dim-overlay
entity: light.ha_kiosk_screen_dimmer
```

You only need to add that overlay card once in a browser tab. It stays active across Lovelace view changes and keeps following the live Home Assistant state while that tab stays open.

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
| `opacity` | number | `0.5` | Overlay opacity for boolean-driven use or as a fallback when brightness is unavailable. |
| `brightness_scale` | number | `100` | Scale used when the brightness source is not a light entity. |
| `color` | string | `#000000` | Overlay color. |
| `overlay_id` | string | `ha-kiosk-screen-dimmer-overlay` | DOM id used for the overlay element. |
| `transition` | string | `opacity 180ms ease-in-out` | CSS transition for the overlay fade. |
| `z_index` | number | `99999` | Overlay stacking order. |

The overlay uses a hardcoded safety cap below full opacity so the screen never becomes completely black.
