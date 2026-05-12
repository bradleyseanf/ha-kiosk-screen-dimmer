"""Virtual light entity for HA Kiosk Screen Dimmer."""

from __future__ import annotations

from typing import Any

from homeassistant.components.light import (
    ATTR_BRIGHTNESS,
    ATTR_BRIGHTNESS_PCT,
    ColorMode,
    LightEntity,
)
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

DOMAIN = "ha_kiosk_screen_dimmer"
NAME = "HA Kiosk Screen Dimmer"


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    async_add_entities([KioskScreenDimmerLight(entry.entry_id)])


class KioskScreenDimmerLight(LightEntity):
    """A simple virtual light that stores brightness locally."""

    _attr_has_entity_name = True
    _attr_name = NAME
    _attr_supported_color_modes = {ColorMode.BRIGHTNESS}
    _attr_should_poll = False

    def __init__(self, entry_id: str) -> None:
        self._entry_id = entry_id
        self._is_on = False
        self._brightness = 0
        self._last_nonzero_brightness = 128

    @property
    def color_mode(self) -> ColorMode:
        return ColorMode.BRIGHTNESS

    @property
    def unique_id(self) -> str:
        return f"{DOMAIN}_{self._entry_id}"

    @property
    def is_on(self) -> bool:
        return self._is_on

    @property
    def brightness(self) -> int | None:
        return self._brightness if self._is_on else 0

    async def async_turn_on(self, **kwargs: Any) -> None:
        brightness = kwargs.get(ATTR_BRIGHTNESS)
        if brightness is None:
            brightness_pct = kwargs.get(ATTR_BRIGHTNESS_PCT)
            if brightness_pct is not None:
                brightness = round(255 * float(brightness_pct) / 100)

        if brightness is None:
            brightness = self._last_nonzero_brightness or 128

        brightness = max(1, min(255, int(brightness)))
        self._brightness = brightness
        self._last_nonzero_brightness = brightness
        self._is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs: Any) -> None:
        self._is_on = False
        self._brightness = 0
        self.async_write_ha_state()
