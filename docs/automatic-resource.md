# Automatic frontend loading

After installing this version, restart Home Assistant and add the Screen Dimmer integration. Integration setup automatically registers the bundled JavaScript module using Home Assistant's frontend API. No dashboard resource entry is required, in either storage or YAML dashboard mode. Installation of files alone does not configure an integration.

Add the Screen Dimmer card to the dashboard where you want the control. Automatic loading does not insert cards, edit dashboard layouts, or activate a dimming overlay until a card is configured.

## Existing installations

The old manual resource entry may be removed after upgrading and confirming the card works. No user resource or YAML configuration is deleted automatically. Loading the same URL uses browser module caching; custom-element registration guards also tolerate duplicate copies, but an old copy at a different URL can win the registration race. Remove obsolete manually hosted copies and refresh browsers after upgrading.

## Lifecycle

The frontend dependency ensures registration happens after frontend setup. The URL is registered once per successful integration setup and removed on successful unload, but retained if platform unload fails. Static asset serving remains registered for the lifetime of the process. Removing registration cannot unload JavaScript already evaluated in an open browser: refresh that browser after disabling/removing the integration or upgrading its code. The bundled static route disables HTTP cache headers; no external CDN or additional credentials are involved.

Validation uses isolated integration lifecycle tests and the existing frontend suite. A real Home Assistant browser smoke test remains required before release.
