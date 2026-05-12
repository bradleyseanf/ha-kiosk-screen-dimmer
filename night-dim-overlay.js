(function () {
  const DEFAULTS = {
    booleanOpacity: 0.5,
    brightnessScale: 100,
    color: "#000000",
    overlayId: "ha-kiosk-screen-dimmer-overlay",
    transition: "opacity 180ms ease-in-out",
    zIndex: 99999,
  };

  class KioskScreenDimmer extends HTMLElement {
    constructor() {
      super();
      this._config = null;
      this._hass = null;
      this._overlay = null;

      this.style.display = "block";
      this.style.width = "0";
      this.style.height = "0";
      this.style.overflow = "hidden";
      this.style.pointerEvents = "none";
    }

    setConfig(config) {
      if (!config || !config.entity) {
        throw new Error("HA Kiosk Screen Dimmer requires an entity.");
      }

      const hasBrightnessSource =
        this._isBrightnessDomain(config.entity) || Boolean(config.brightness_entity);

      this._config = {
        entity: config.entity,
        brightness_entity: config.brightness_entity ?? null,
        opacity: this._clamp01(config.opacity ?? DEFAULTS.booleanOpacity),
        max_opacity: this._clamp01(
          config.max_opacity ?? config.opacity ?? (hasBrightnessSource ? 1 : DEFAULTS.booleanOpacity)
        ),
        brightness_scale: this._positiveNumber(
          config.brightness_scale ?? DEFAULTS.brightnessScale,
          DEFAULTS.brightnessScale
        ),
        color: config.color ?? DEFAULTS.color,
        overlay_id: config.overlay_id ?? DEFAULTS.overlayId,
        transition: config.transition ?? DEFAULTS.transition,
        z_index: Number.isFinite(Number(config.z_index))
          ? Number(config.z_index)
          : DEFAULTS.zIndex,
      };

      this._removeOverlay();
      this._ensureOverlay();
      this._syncOverlay();
    }

    set hass(hass) {
      this._hass = hass;
      this._ensureOverlay();
      this._syncOverlay();
    }

    connectedCallback() {
      this._ensureOverlay();
      this._syncOverlay();
    }

    disconnectedCallback() {
      this._removeOverlay();
    }

    getCardSize() {
      return 0;
    }

    _ensureOverlay() {
      if (!this._config || this._overlay) {
        return;
      }

      const existing = document.getElementById(this._config.overlay_id);
      if (existing) {
        this._overlay = existing;
        this._applyBaseStyles();
        return;
      }

      const overlay = document.createElement("div");
      overlay.id = this._config.overlay_id;
      overlay.setAttribute("aria-hidden", "true");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.pointerEvents = "none";
      overlay.style.opacity = "0";
      overlay.style.display = "block";
      overlay.style.willChange = "opacity";

      this._overlay = overlay;
      this._applyBaseStyles();

      const host = document.body || document.documentElement;
      host.appendChild(overlay);
    }

    _removeOverlay() {
      if (this._overlay && this._overlay.parentNode) {
        this._overlay.parentNode.removeChild(this._overlay);
      }
      this._overlay = null;
    }

    _applyBaseStyles() {
      if (!this._overlay || !this._config) {
        return;
      }

      this._overlay.style.backgroundColor = this._config.color;
      this._overlay.style.transition = this._config.transition;
      this._overlay.style.zIndex = String(this._config.z_index);
    }

    _syncOverlay() {
      if (!this._overlay || !this._config || !this._hass) {
        return;
      }

      this._applyBaseStyles();
      this._overlay.style.opacity = String(this._calculateOpacity());
    }

    _calculateOpacity() {
      const controlState = this._state(this._config.entity);
      if (!controlState) {
        return 0;
      }

      if (!this._isEnabled(controlState)) {
        return 0;
      }

      const brightnessState = this._resolveBrightnessState(controlState);
      if (!brightnessState) {
        return this._config.opacity;
      }

      const brightness = this._normalizedBrightness(brightnessState);
      if (brightness == null) {
        return this._config.opacity;
      }

      return this._clamp01(brightness * this._config.max_opacity);
    }

    _resolveBrightnessState(controlState) {
      if (this._config.brightness_entity) {
        return this._state(this._config.brightness_entity);
      }

      if (this._isBrightnessDomain(controlState.entity_id)) {
        return controlState;
      }

      return null;
    }

    _normalizedBrightness(stateObj) {
      const domain = this._domain(stateObj.entity_id);

      if (domain === "light") {
        const brightness = Number(stateObj.attributes?.brightness);
        if (Number.isFinite(brightness)) {
          return this._clamp01(brightness / 255);
        }

        return stateObj.state === "on" ? 1 : 0;
      }

      const value = Number(stateObj.state);
      if (!Number.isFinite(value)) {
        return null;
      }

      const minAttribute = Number(stateObj.attributes?.min);
      const maxAttribute = Number(stateObj.attributes?.max);
      const min = Number.isFinite(minAttribute) ? minAttribute : 0;
      const max = Number.isFinite(maxAttribute) ? maxAttribute : this._config.brightness_scale;

      if (max <= min) {
        return null;
      }

      return this._clamp01((value - min) / (max - min));
    }

    _isEnabled(stateObj) {
      const domain = this._domain(stateObj.entity_id);

      if (domain === "number" || domain === "input_number") {
        return Number(stateObj.state) > 0;
      }

      return stateObj.state === "on";
    }

    _isBrightnessDomain(entityId) {
      const domain = this._domain(entityId);
      return domain === "light" || domain === "number" || domain === "input_number";
    }

    _state(entityId) {
      return this._hass?.states?.[entityId] ?? null;
    }

    _domain(entityId) {
      return entityId?.split(".")[0] ?? "";
    }

    _positiveNumber(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    _clamp01(value) {
      return this._clamp(Number(value), 0, 1);
    }

    _clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }
  }

  if (!customElements.get("night-dim-overlay")) {
    customElements.define("night-dim-overlay", KioskScreenDimmer);
  }
})();
