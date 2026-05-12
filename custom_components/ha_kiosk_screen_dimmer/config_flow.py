"""Config flow for HA Kiosk Screen Dimmer."""

from homeassistant.config_entries import ConfigFlow

DOMAIN = "ha_kiosk_screen_dimmer"
NAME = "HA Kiosk Screen Dimmer"


class KioskScreenDimmerConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for the virtual dimmer."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        return self.async_create_entry(title=NAME, data={})
