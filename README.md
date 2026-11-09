# Screen Dimmer

[![HACS default catalog](https://img.shields.io/badge/HACS-Default-41BDF5?logo=homeassistant&logoColor=white)](https://github.com/hacs/default/pull/13618)
[![Latest release](https://img.shields.io/github/v/release/bradleyseanf/ha-kiosk-screen-dimmer)](https://github.com/bradleyseanf/ha-kiosk-screen-dimmer/releases/latest)
[![CI on dev](https://img.shields.io/github/actions/workflow/status/bradleyseanf/ha-kiosk-screen-dimmer/ci.yml?branch=dev)](https://github.com/bradleyseanf/ha-kiosk-screen-dimmer/actions/workflows/ci.yml?query=branch%3Adev)
[![License](https://img.shields.io/github/license/bradleyseanf/ha-kiosk-screen-dimmer)](LICENSE)

Dim a Home Assistant kiosk screen with a smooth, click-through tint and a simple slider. Useful when your display cannot expose its backlight controls.

![The included slider at 100% and 40% screen brightness in a sample dashboard](docs/images/slider-example.svg)

*Illustration of the slider and tint effect, not a Home Assistant screenshot. Card styling varies by dashboard and browser.*

## Quick start

Requires **Home Assistant 2025.3.0 or later**.

1. On Home Assistant **2026.11 or later**, open **Settings → Marketplace**, search for **Screen Dimmer**, and install it. On earlier supported versions, open **HACS** and search for **Screen Dimmer** instead. If it is not listed yet, use the custom-repository fallback below.
2. Restart Home Assistant, then add **Screen Dimmer** under **Settings → Devices & services → Add integration**.
3. Under **Settings → Dashboards → Resources**, add `/ha_kiosk_screen_dimmer/brightness-dimmer.js?v=0.1.0` as a **JavaScript module**. Enable Advanced Mode in your profile if Resources is hidden.
4. Add a **Manual** dashboard card:

```yaml
type: custom:screen-dimmer-slider
entity: light.ha_kiosk_screen_dimmer
mode: brightness
name: Screen brightness
```

Use the entity ID created by your integration if it differs. The slider includes the overlay, so no extra card is needed.

### Add the integration

After installing Screen Dimmer and restarting Home Assistant (steps 1–2), use this button to open its setup flow:

[![Add integration to Home Assistant](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=ha_kiosk_screen_dimmer)

The button starts configuration only; it does not install the custom integration or add the dashboard resource and card. Continue with steps 3–4 after setup. If the link does not open your instance, use **Settings → Devices & services → Add integration → Screen Dimmer** instead.

### Custom-repository fallback

Screen Dimmer is included in the default HACS catalog. If your HACS / Marketplace catalog has not refreshed yet, add `https://github.com/bradleyseanf/ha-kiosk-screen-dimmer` under **Custom repositories** with category **Integration**, install **Screen Dimmer**, then continue with steps 2–4 above.

### Manual installation

HACS / Marketplace is optional. To install manually:

1. Download the source archive from the [latest release](https://github.com/bradleyseanf/ha-kiosk-screen-dimmer/releases/latest) and extract it.
2. Copy `custom_components/ha_kiosk_screen_dimmer` into your Home Assistant `config/custom_components` directory, creating the directory if needed.
3. Follow quick-start steps 2–4: restart Home Assistant, add the integration, register the JavaScript module, and add the dashboard card.

No separate `www` copy is needed. The resource step above applies to **Screen Dimmer v0.1.0**; automatic frontend loading is being developed separately and is not part of that release.

## How it works

- Drag for an immediate preview. The virtual light saves the setting for automations and other controls.
- In the example above, **100% is clear** and **15% is the darkest default setting**. Omit `mode: brightness` to control tint strength instead.
- The overlay stays click-through and follows you between views in that dashboard. Use one dimmer configuration per browser tab.
- This changes the browser tint, **not the hardware backlight**. The default maximum tint is 85%; the safety cap is 95%.

[More options and overlay-only setup](docs/configuration.md) · [Changelog](https://github.com/bradleyseanf/ha-kiosk-screen-dimmer/releases) · [Development](docs/development.md)

## Need help?

[Report a bug or request a feature](https://github.com/bradleyseanf/ha-kiosk-screen-dimmer/issues). Include your Home Assistant and Screen Dimmer versions, browser/device, card YAML, and steps to reproduce. Remove private details from logs and screenshots.
