(function () {
  const DEFAULTS = {
    booleanOpacity: 0.5,
    brightnessScale: 100,
    color: "#000000",
    overlayId: "ha-kiosk-screen-dimmer-overlay",
    safeMaxOpacity: 0.85,
    transition: "opacity 180ms ease-in-out",
    zIndex: 99999,
  };

  const GLOBAL_KEY = "__ha_kiosk_screen_dimmer__";
  const BRIGHTNESS_LEVELS = Array.from({ length: 100 }, (_, index) =>
    Number((((index + 1) / 100) * DEFAULTS.safeMaxOpacity).toFixed(4))
  );

  class DimmerController {
    constructor() {
      this.config = null;
      this.hass = null;
      this.overlay = null;
      this.timer = null;
      this.lastOpacity = null;
    }

    configure(config) {
      this.config = config;
      this._ensureOverlay();
      this._startPolling();
      this.sync();
    }

    updateHass(hass) {
      this.hass = hass;
      this._ensureOverlay();
      this._startPolling();
      this.sync();
    }

    sync() {
      if (!this.config) {
        return;
      }

      this._ensureOverlay();
      if (!this.overlay) {
        return;
      }

      const liveHass = this._pageHass() ?? this.hass;
      if (!liveHass) {
        return;
      }

      const controlState = this._state(liveHass, this.config.entity);
      if (!controlState || !this._isEnabled(controlState)) {
        this._applyOpacity(0);
        return;
      }

      const brightnessState = this._resolveBrightnessState(liveHass, controlState);
      const opacity = brightnessState
        ? this._opacityFromPercent(this._brightnessPercent(brightnessState))
        : this.config.opacity;

      this._applyOpacity(this._opacityClamp(opacity));
    }

    _startPolling() {
      if (this.timer) {
        return;
      }

      const schedule =
        typeof globalThis.setInterval === "function"
          ? globalThis.setInterval.bind(globalThis)
          : typeof window !== "undefined" && typeof window.setInterval === "function"
            ? window.setInterval.bind(window)
            : null;
      if (typeof schedule !== "function") {
        return;
      }

      this.timer = schedule(() => this.sync(), 100);
    }

    _ensureOverlay() {
      if (!this.config) {
        return;
      }

      const overlays = Array.from(
        document.querySelectorAll(`[id="${this.config.overlay_id}"]`)
      );

      if (overlays.length > 0) {
        this.overlay = overlays[0];
        this._globalState().overlay = this.overlay;
        for (const duplicate of overlays.slice(1)) {
          duplicate.remove();
        }
        this._applyBaseStyles();
        return;
      }

      const globalState = this._globalState();
      if (globalState.overlay && globalState.overlay.isConnected) {
        this.overlay = globalState.overlay;
        this._applyBaseStyles();
        return;
      }

      const overlay = document.createElement("div");
      overlay.id = this.config.overlay_id;
      overlay.setAttribute("aria-hidden", "true");
      overlay.setAttribute("data-ha-kiosk-screen-dimmer", "overlay");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.pointerEvents = "none";
      overlay.style.opacity = "0";
      overlay.style.display = "block";
      overlay.style.willChange = "opacity";

      const host = document.body || document.documentElement;
      host.appendChild(overlay);

      globalState.overlay = overlay;
      this.overlay = overlay;
      this._applyBaseStyles();
    }

    _applyBaseStyles() {
      if (!this.overlay || !this.config) {
        return;
      }

      this.overlay.style.backgroundColor = this.config.color;
      this.overlay.style.transition = this.config.transition;
      this.overlay.style.zIndex = String(this.config.z_index);
    }

    _applyOpacity(value) {
      if (!this.overlay) {
        return;
      }

      const opacity = this._opacityClamp(value);
      if (this.lastOpacity === opacity) {
        return;
      }

      this.lastOpacity = opacity;
      this.overlay.style.opacity = String(opacity);
    }

    _pageHass() {
      const app = document.querySelector("home-assistant");
      return app?.hass ?? null;
    }

    _resolveBrightnessState(hass, controlState) {
      if (this.config.brightness_entity) {
        return this._state(hass, this.config.brightness_entity);
      }

      if (this._isBrightnessDomain(controlState.entity_id)) {
        return controlState;
      }

      return null;
    }

    _brightnessPercent(stateObj) {
      const domain = this._domain(stateObj.entity_id);

      if (domain === "light") {
        const brightness = Number(stateObj.attributes?.brightness);
        if (Number.isFinite(brightness)) {
          if (brightness <= 0) {
            return 0;
          }

          return this._clampInt(Math.round((brightness / 255) * 100), 1, 100);
        }

        return stateObj.state === "on" ? 100 : 0;
      }

      const value = Number(stateObj.state);
      if (!Number.isFinite(value)) {
        return stateObj.state === "on" ? 100 : 0;
      }

      const minAttribute = Number(stateObj.attributes?.min);
      const maxAttribute = Number(stateObj.attributes?.max);
      const min = Number.isFinite(minAttribute) ? minAttribute : 0;
      const max = Number.isFinite(maxAttribute) ? maxAttribute : this.config.brightness_scale;

      if (max <= min) {
        return null;
      }

      const scaled = Math.round(((value - min) / (max - min)) * 100);
      if (scaled <= 0) {
        return value > min ? 1 : 0;
      }

      return this._clampInt(scaled, 1, 100);
    }

    _opacityFromPercent(percent) {
      const numericPercent = Math.round(Number(percent));
      if (!Number.isFinite(numericPercent) || numericPercent <= 0) {
        return 0;
      }

      const index = this._clampInt(numericPercent, 1, 100) - 1;
      return BRIGHTNESS_LEVELS[index];
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

    _state(hass, entityId) {
      return hass?.states?.[entityId] ?? null;
    }

    _domain(entityId) {
      return entityId?.split(".")[0] ?? "";
    }

    _positiveNumber(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    _opacityClamp(value) {
      return this._clamp(Number(value), 0, DEFAULTS.safeMaxOpacity);
    }

    _clampInt(value, min, max) {
      return Math.min(max, Math.max(min, Math.round(value)));
    }

    _clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    _globalState() {
      if (!window[GLOBAL_KEY]) {
        window[GLOBAL_KEY] = {};
      }

      return window[GLOBAL_KEY];
    }
  }

  class NightDimOverlay extends HTMLElement {
    constructor() {
      super();
      this._config = null;
      this._controller = this._controllerInstance();

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

      this._config = {
        entity: config.entity,
        brightness_entity: config.brightness_entity ?? null,
        opacity: this._numberOrDefault(config.opacity, DEFAULTS.booleanOpacity),
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

      this._controller.configure(this._config);
    }

    set hass(hass) {
      this._controller.updateHass(hass);
    }

    connectedCallback() {
      this._controller.sync();
    }

    disconnectedCallback() {
      // Intentionally keep the singleton overlay/controller alive across view changes.
    }

    getCardSize() {
      return 0;
    }

    _positiveNumber(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    _numberOrDefault(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    _controllerInstance() {
      const globalState = this._globalState();
      if (!globalState.controller) {
        globalState.controller = new DimmerController();
      }

      return globalState.controller;
    }

    _globalState() {
      if (!window[GLOBAL_KEY]) {
        window[GLOBAL_KEY] = {};
      }

      return window[GLOBAL_KEY];
    }
  }

  if (!customElements.get("night-dim-overlay")) {
    customElements.define("night-dim-overlay", NightDimOverlay);
  }
})();
