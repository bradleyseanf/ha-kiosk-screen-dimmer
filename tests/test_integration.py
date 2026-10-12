"""Focused logic checks without a running Home Assistant instance."""

import asyncio
from dataclasses import dataclass
import importlib
import json
from pathlib import Path
import sys
import types
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def stub(name, **attributes):
    module = types.ModuleType(name)
    for key, value in attributes.items():
        setattr(module, key, value)
    sys.modules[name] = module
    return module


class ConfigFlow:
    def __init_subclass__(cls, domain=None, **kwargs):
        super().__init_subclass__(**kwargs)


class LightEntity:
    def async_write_ha_state(self):
        self.writes = getattr(self, "writes", 0) + 1


stub("homeassistant", __path__=[])
stub("homeassistant.config_entries", ConfigEntry=object, ConfigFlow=ConfigFlow)
stub("homeassistant.core", HomeAssistant=object)
stub("homeassistant.components", __path__=[])


@dataclass
class StaticPathConfig:
    url_path: str
    path: str
    cache_headers: bool = True


stub("homeassistant.components.http", StaticPathConfig=StaticPathConfig)
stub(
    "homeassistant.components.light",
    ATTR_BRIGHTNESS="brightness",
    ATTR_BRIGHTNESS_PCT="brightness_pct",
    ColorMode=types.SimpleNamespace(BRIGHTNESS="brightness"),
    LightEntity=LightEntity,
)
stub("homeassistant.helpers", __path__=[])
stub("homeassistant.helpers.entity_platform", AddConfigEntryEntitiesCallback=object)

integration = importlib.import_module("custom_components.ha_kiosk_screen_dimmer")
light = importlib.import_module("custom_components.ha_kiosk_screen_dimmer.light")
flow = importlib.import_module("custom_components.ha_kiosk_screen_dimmer.config_flow")


class FakeEntries:
    def __init__(self):
        self.renames = []
        self.forwarded = []
        self.unloaded = []

    def async_update_entry(self, entry, title):
        self.renames.append((entry, title))
        entry.title = title

    async def async_forward_entry_setups(self, entry, platforms):
        self.forwarded.append((entry, platforms))

    async def async_unload_platforms(self, entry, platforms):
        self.unloaded.append((entry, platforms))
        return True


class FakeHTTP:
    def __init__(self):
        self.registered = []

    async def async_register_static_paths(self, paths):
        self.registered.extend(paths)


class FakeHass:
    def __init__(self):
        self.data = {}
        self.config_entries = FakeEntries()
        self.http = FakeHTTP()


class TestIntegration(unittest.TestCase):
    def test_identity_branding_and_icon(self):
        manifest = json.loads(
            (ROOT / "custom_components/ha_kiosk_screen_dimmer/manifest.json").read_text()
        )
        self.assertEqual(integration.DOMAIN, "ha_kiosk_screen_dimmer")
        self.assertEqual(manifest["domain"], integration.DOMAIN)
        self.assertEqual(manifest["name"], "Screen Dimmer")
        self.assertEqual(manifest["version"], "0.0.3")
        self.assertEqual(flow.NAME, "Screen Dimmer")
        entity = light.KioskScreenDimmerLight("existing-entry-id")
        self.assertEqual(entity.unique_id, "ha_kiosk_screen_dimmer_existing-entry-id")
        self.assertEqual(entity._attr_name, "Screen Dimmer")
        self.assertEqual(entity._attr_icon, "mdi:brightness-6")
        icon = (ROOT / "custom_components/ha_kiosk_screen_dimmer/brand/icon.png").read_bytes()
        self.assertEqual(icon[:8], bytes([137, 80, 78, 71, 13, 10, 26, 10]))
        self.assertEqual(int.from_bytes(icon[16:20], "big"), 256)
        self.assertEqual(int.from_bytes(icon[20:24], "big"), 256)

    def test_slider_values_and_last_level(self):
        entity = light.KioskScreenDimmerLight("entry")
        asyncio.run(entity.async_turn_on(brightness=1))
        self.assertEqual(entity.brightness, 1)
        asyncio.run(entity.async_turn_on(brightness=128))
        self.assertEqual(entity.brightness, 128)
        asyncio.run(entity.async_turn_on(brightness=255))
        self.assertEqual(entity.brightness, 255)
        asyncio.run(entity.async_turn_off())
        self.assertEqual(entity.brightness, 0)
        asyncio.run(entity.async_turn_on())
        self.assertEqual(entity.brightness, 255)
        self.assertEqual(entity.writes, 5)

    def test_only_legacy_default_entry_title_is_renamed(self):
        for title, expected in [
            ("HA Kiosk Screen Dimmer", "Screen Dimmer"),
            ("Bradley's Bedside Dimmer", "Bradley's Bedside Dimmer"),
        ]:
            entry = types.SimpleNamespace(entry_id="same-id", title=title)
            hass = FakeHass()
            self.assertTrue(asyncio.run(integration.async_setup(hass, {})))
            self.assertTrue(asyncio.run(integration.async_setup_entry(hass, entry)))
            self.assertEqual(entry.entry_id, "same-id")
            self.assertEqual(entry.title, expected)
            self.assertEqual(len(hass.config_entries.renames), int(title != expected))
            self.assertEqual(hass.config_entries.forwarded[0][1], ["light"])


    def test_static_resource_is_bundled_and_setup_is_idempotent(self):
        hass = FakeHass()
        self.assertTrue(asyncio.run(integration.async_setup(hass, {})))
        self.assertTrue(asyncio.run(integration.async_setup(hass, {})))
        self.assertEqual(len(hass.http.registered), 1)
        resource = hass.http.registered[0]
        self.assertEqual(resource.url_path, integration.RESOURCE_PATH)
        self.assertFalse(resource.cache_headers)
        self.assertEqual(
            Path(resource.path).resolve(),
            (ROOT / "custom_components/ha_kiosk_screen_dimmer/brightness-dimmer.js").resolve(),
        )
        self.assertEqual(Path(resource.path).read_bytes(), (ROOT / "brightness-dimmer.js").read_bytes())
        self.assertEqual(
            json.loads((ROOT / "custom_components/ha_kiosk_screen_dimmer/manifest.json").read_text())["dependencies"],
            ["http"],
        )

    def test_unload_and_reload_do_not_reregister_process_static_route(self):
        hass = FakeHass()
        entry = types.SimpleNamespace(entry_id="existing", title="Custom screen name")
        asyncio.run(integration.async_setup(hass, {}))
        asyncio.run(integration.async_setup_entry(hass, entry))
        self.assertTrue(asyncio.run(integration.async_unload_entry(hass, entry)))
        asyncio.run(integration.async_setup(hass, {}))
        asyncio.run(integration.async_setup_entry(hass, entry))
        self.assertEqual(len(hass.http.registered), 1)
        self.assertEqual(len(hass.config_entries.unloaded), 1)
        self.assertEqual(len(hass.config_entries.forwarded), 2)
        self.assertEqual(entry.title, "Custom screen name")


if __name__ == "__main__":
    unittest.main()
