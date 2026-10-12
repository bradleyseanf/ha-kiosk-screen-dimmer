"""Screen Dimmer integration."""

from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

DOMAIN = "ha_kiosk_screen_dimmer"
NAME = "Screen Dimmer"
LEGACY_NAME = "HA Kiosk Screen Dimmer"

PLATFORMS: list[str] = ["light"]
RESOURCE_PATH = "/ha_kiosk_screen_dimmer/brightness-dimmer.js"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Expose the HACS-bundled card once per Home Assistant process."""
    data = hass.data.setdefault(DOMAIN, {})
    if not data.get("static_path_registered"):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(
                RESOURCE_PATH,
                str(Path(__file__).parent / "brightness-dimmer.js"),
                cache_headers=False,
            )]
        )
        data["static_path_registered"] = True
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    # Rename only the original default title; keep user-customized titles.
    if entry.title == LEGACY_NAME:
        hass.config_entries.async_update_entry(entry, title=NAME)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
