# Home Assistant Kiosk Dimmer

For those pesky screens that keeps your wife awake at night.

This card puts a simple black transparent overlay right over your Home Assistant Kiosk screen.

Some screens do not have the capability to interface with your device brightness control, this is here to solve that.

It is controllable either by:

    - Click button
    - Slider

## Installation

Copy `night-dim-overlay.js` into `/homeassistant/www/`.

Copy `ha_kiosk_screen_dimmer` into `/homeassistant/custom_components/`.

Restart Home Assistant.

Open Home Assistant and go to `Settings → Devices & Services`.

Add `HA Kiosk Screen Dimmer`.

Home Assistant will create the virtual light entity automatically.

Add the card to your dashboard by editing the dashboard and adding a manual card:

```yaml
type: custom:night-dim-overlay
entity: light.ha_kiosk_screen_dimmer
opacity: 1
```

## Attributes

| Attribute | Type | Default | Description |
| --- | --- | --- | --- |
| `entity` | string | required | The entity that turns the overlay on and off. |
| `brightness_entity` | string | none | Optional separate brightness source. |
| `opacity` | number | `0.5` | Overlay opacity for boolean-driven use. |
| `max_opacity` | number | same as `opacity` | Maximum overlay opacity when brightness is at 100%. |
| `brightness_scale` | number | `100` | Scale used when the brightness source is not a light entity. |
| `color` | string | `#000000` | Overlay color. |
| `overlay_id` | string | `ha-kiosk-screen-dimmer-overlay` | DOM id used for the overlay element. |
| `transition` | string | `opacity 180ms ease-in-out` | CSS transition for the overlay fade. |
| `z_index` | number | `99999` | Overlay stacking order. |
