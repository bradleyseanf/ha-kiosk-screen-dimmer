(function () {
  class NightDimOverlay extends HTMLElement {
    setConfig(config) {
      this.entity = config.entity;
      this.opacity = Number(config.opacity ?? 0.5);
      this.brightnessEntity = config.brightness_entity ?? config.entity;
      this.brightnessScale = Number(config.brightness_scale ?? 100);
    }

    set hass(hass) {
      if (!this.overlay) {
        this.overlay = document.createElement("div");
        this.overlay.id = "night-dim-overlay";
        this.overlay.style.position = "fixed";
        this.overlay.style.inset = "0";
        this.overlay.style.background = "rgba(0,0,0,1)";
        this.overlay.style.zIndex = "99999";
        this.overlay.style.pointerEvents = "none";
        this.overlay.style.transition = "opacity 0.5s ease";
        this.overlay.style.opacity = "0";
        document.body.appendChild(this.overlay);
      }

      const stateObj = hass.states[this.entity];
      const state = stateObj?.state;

      if (state === "on" || Number(state) > 0) {
        const brightnessPercent = this._brightnessPercent(hass.states[this.brightnessEntity]);
        this.overlay.style.opacity = String(this._clamp01(this.opacity * brightnessPercent));
      } else {
        this.overlay.style.opacity = "0";
      }
    }

    getCardSize() {
      return 0;
    }

    _brightnessPercent(stateObj) {
      if (!stateObj) {
        return 1;
      }

      const domain = stateObj.entity_id?.split(".")[0];
      if (domain === "light") {
        const brightness = Number(stateObj.attributes?.brightness);
        if (Number.isFinite(brightness)) {
          return this._clamp01(brightness / 255);
        }
        return stateObj.state === "on" ? 1 : 0;
      }

      const value = Number(stateObj.state);
      if (!Number.isFinite(value)) {
        return stateObj.state === "on" ? 1 : 0;
      }

      const min = Number.isFinite(Number(stateObj.attributes?.min)) ? Number(stateObj.attributes.min) : 0;
      const max = Number.isFinite(Number(stateObj.attributes?.max)) ? Number(stateObj.attributes.max) : this.brightnessScale;
      if (max <= min) {
        return 1;
      }

      return this._clamp01((value - min) / (max - min));
    }

    _clamp01(value) {
      return Math.min(1, Math.max(0, Number(value)));
    }
  }

  if (!customElements.get("night-dim-overlay")) {
    customElements.define("night-dim-overlay", NightDimOverlay);
  }
})();
