(function () {
  const DEFAULTS = {
    booleanOpacity: 0.5,
    brightnessScale: 100,
    color: "#000000",
    overlayId: "ha-kiosk-screen-dimmer-overlay",
    defaultMaxOpacity: 0.85,
    hardMaxOpacity: 0.95,
    transition: "opacity 180ms ease-in-out",
    zIndex: 99999,
  };

  // Keep the original custom element and global key for existing dashboards.
  const GLOBAL_KEY = "__ha_kiosk_screen_dimmer__";

  function dashboardRoot(path) {
    const firstSegment = String(path || "/").split("/").filter(Boolean)[0];
    return firstSegment ? "/" + firstSegment : "/";
  }

  class DimmerController {
    constructor() {
      this.config = null;
      this.hass = null;
      this.overlay = null;
      this.timer = null;
      this.lastOpacity = null;
    }

    configure(config) {
      if (this.config?.overlay_id !== config.overlay_id && this.overlay) {
        this.overlay.remove();
        this.overlay = null;
        this.lastOpacity = null;
      }
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
      // The card opts this browser tab into dimming only on its dashboard.
      if (!this._isInScope()) {
        this._applyOpacity(0);
        return;
      }

      const liveHass = this._pageHass() ?? this.hass;
      if (liveHass?.connected === false) {
        this._applyOpacity(0);
        return;
      }
      if (this.previewBrightness !== undefined) {
        this._applyOpacity(this.previewBrightness / 255 * this.config.max_opacity);
        return;
      }
      const controlState = this._state(liveHass, this.config.entity);
      const explicitSource = this.config.brightness_entity
        ? this._state(liveHass, this.config.brightness_entity)
        : null;

      if (this.config.combine === "either" && this.config.brightness_entity) {
        // Manual slider and scheduled night mode are independent. A valid
        // nonzero slider level wins; otherwise the enabled boolean uses its
        // original fixed opacity. Neither source can leave a stale tint.
        const booleanEnabled = controlState && this._isEnabled(controlState);
        const sourceEnabled = explicitSource && this._isEnabled(explicitSource);
        const ratio = sourceEnabled ? this._brightnessRatio(explicitSource) : null;
        const opacity = ratio !== null && ratio !== undefined && ratio > 0
          ? ratio * this.config.max_opacity
          : booleanEnabled ? this.config.opacity : 0;
        this._applyOpacity(opacity);
        return;
      }

      if (!controlState || !this._isEnabled(controlState)) {
        this._applyOpacity(0);
        return;
      }
      const source = this.config.brightness_entity
        ? explicitSource
        : this._isBrightnessDomain(controlState.entity_id)
          ? controlState
          : null;

      let opacity;
      if (!source) {
        // A missing explicitly configured source must never leave a stale tint.
        opacity = this.config.brightness_entity ? 0 : this.config.opacity;
      } else {
        const ratio = this._brightnessRatio(source);
        // A legacy on/off light without brightness can use boolean opacity.
        // Invalid readings clear the overlay.
        opacity = ratio === undefined && !this.config.brightness_entity
          ? this.config.opacity
          : ratio === null || ratio === undefined
            ? 0
            : ratio * this.config.max_opacity;
      }
      this._applyOpacity(opacity);
    }

    _isInScope() {
      const path = window.location?.pathname || "/";
      if (this.config.scope === "all") {
        return true;
      }
      if (this.config.scope === "view") {
        return path === this.config.view_path;
      }
      return dashboardRoot(path) === this.config.dashboard_root;
    }

    _startPolling() {
      if (this.timer) {
        return;
      }
      const schedule =
        typeof globalThis.setInterval === "function"
          ? globalThis.setInterval.bind(globalThis)
          : typeof window.setInterval === "function"
            ? window.setInterval.bind(window)
            : null;
      if (schedule) {
        // State updates arrive through the card; polling also catches SPA
        // navigation after the zero-size card disconnects.
        this.timer = schedule(() => this.sync(), 250);
      }
    }

    _ensureOverlay() {
      if (!this.config) {
        return;
      }
      const overlays = Array.from(
        document.querySelectorAll('[id="' + this.config.overlay_id + '"]')
      );
      if (overlays.length > 0) {
        if (this.overlay !== overlays[0]) {
          this.lastOpacity = null;
        }
        this.overlay = overlays[0];
        this._globalState().overlay = this.overlay;
        for (const duplicate of overlays.slice(1)) {
          duplicate.remove();
        }
        this._applyBaseStyles();
        return;
      }

      const globalState = this._globalState();
      if (
        globalState.overlay?.isConnected &&
        globalState.overlay.id === this.config.overlay_id
      ) {
        if (this.overlay !== globalState.overlay) {
          this.lastOpacity = null;
        }
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
      (document.body || document.documentElement).appendChild(overlay);

      globalState.overlay = overlay;
      this.overlay = overlay;
      this.lastOpacity = null;
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
      const opacity = this._clamp(Number(value), 0, this.config.max_opacity);
      if (this.lastOpacity !== opacity) {
        this.lastOpacity = opacity;
        this.overlay.style.opacity = String(opacity);
      }
    }

    _pageHass() {
      return document.querySelector("home-assistant")?.hass ?? null;
    }

    _brightnessRatio(stateObj) {
      const domain = this._domain(stateObj.entity_id);
      if (domain === "light") {
        if (stateObj.state !== "on") {
          return 0;
        }
        const raw = stateObj.attributes?.brightness;
        if (raw === undefined || raw === null) {
          return undefined;
        }
        const brightness = Number(raw);
        return Number.isFinite(brightness) && brightness >= 0 && brightness <= 255
          ? brightness / 255
          : null;
      }

      if (domain === "number" || domain === "input_number") {
        const value = Number(stateObj.state);
        const rawMin = stateObj.attributes?.min;
        const rawMax = stateObj.attributes?.max;
        const min = rawMin === undefined ? 0 : Number(rawMin);
        const max = rawMax === undefined
          ? this.config.brightness_scale
          : Number(rawMax);
        if (
          !Number.isFinite(value) ||
          !Number.isFinite(min) ||
          !Number.isFinite(max) ||
          max <= min
        ) {
          return null;
        }
        return this._clamp((value - min) / (max - min), 0, 1);
      }

      if (stateObj.state === "on") {
        return 1;
      }
      if (stateObj.state === "off") {
        return 0;
      }
      return null;
    }

    _isEnabled(stateObj) {
      const domain = this._domain(stateObj.entity_id);
      if (domain === "number" || domain === "input_number") {
        const value = Number(stateObj.state);
        return Number.isFinite(value) && value > 0;
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

    _clamp(value, min, max) {
      return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
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
      // Browsers reject custom elements that gain attributes during
      // construction. Apply inline styles only after connection.
      this._controller = this._controllerInstance();
    }

    setConfig(config) {
      if (!config || typeof config.entity !== "string" || !config.entity.trim()) {
        throw new Error("Screen Dimmer requires an entity.");
      }
      const scope = config.scope ?? "dashboard";
      if (!["dashboard", "view", "all"].includes(scope)) {
        throw new Error("Screen Dimmer scope must be dashboard, view, or all.");
      }
      const combine = config.combine ?? "gate";
      if (!["gate", "either"].includes(combine)) {
        throw new Error("Screen Dimmer combine must be gate or either.");
      }

      const viewPath = window.location?.pathname || "/";
      this._controller.configure({
        entity: config.entity,
        brightness_entity: config.brightness_entity ?? null,
        combine,
        opacity: this._numberOrDefault(config.opacity, DEFAULTS.booleanOpacity),
        max_opacity: Math.min(
          DEFAULTS.hardMaxOpacity,
          Math.max(0, this._numberOrDefault(config.max_opacity, DEFAULTS.defaultMaxOpacity))
        ),
        brightness_scale: this._positiveNumber(
          config.brightness_scale,
          DEFAULTS.brightnessScale
        ),
        color: config.color ?? DEFAULTS.color,
        overlay_id: config.overlay_id ?? DEFAULTS.overlayId,
        transition: config.transition ?? DEFAULTS.transition,
        z_index: this._numberOrDefault(config.z_index, DEFAULTS.zIndex),
        scope,
        view_path: viewPath,
        dashboard_root: dashboardRoot(viewPath),
      });
    }

    set hass(hass) {
      this._controller.updateHass(hass);
    }

    previewBrightness(brightness) {
      if (!Number.isFinite(brightness)) return;
      this._controller.previewBrightness = Math.max(0, Math.min(255, brightness));
      this._controller.sync();
    }

    clearPreview() {
      delete this._controller.previewBrightness;
      this._controller.sync();
    }

    connectedCallback() {
      this.style.display = "block";
      this.style.width = "0";
      this.style.height = "0";
      this.style.overflow = "hidden";
      this.style.pointerEvents = "none";
      this._controller.sync();
    }

    disconnectedCallback() {
      // Keep one controller across views; scope clears the overlay elsewhere.
    }

    getCardSize() {
      return 0;
    }

    _positiveNumber(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    _numberOrDefault(value, fallback) {
      if (value === undefined || value === null) {
        return fallback;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    _controllerInstance() {
      if (!window[GLOBAL_KEY]) {
        window[GLOBAL_KEY] = {};
      }
      if (!window[GLOBAL_KEY].controller) {
        window[GLOBAL_KEY].controller = new DimmerController();
      }
      return window[GLOBAL_KEY].controller;
    }
  }

  // Compact control with immediate local preview and one service call at a time.
  class ScreenDimmerSlider extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `<style>
        :host{display:inline-flex;align-items:center;gap:10px;color:inherit;font:inherit}
        input{width:112px;height:30px;margin:0;accent-color:#b7def3;cursor:pointer}
        output{min-width:3.5ch;text-align:right;font-size:.8em;font-variant-numeric:tabular-nums}
      </style><input type="range" min="0" max="100" step="1" aria-label="Screen dimmer"><output></output>`;
      this._input = this.shadowRoot.querySelector('input');
      this._output = this.shadowRoot.querySelector('output');
      this._input.addEventListener('input', () => this._queue(false));
      this._input.addEventListener('change', () => this._queue(true));
      this._input.addEventListener('pointercancel', () => this._queue(true));
      this._input.addEventListener('blur', () => { if (this._dragging) this._queue(true); });
      this._overlay = new NightDimOverlay();
    }
    setConfig(config) {
      if (!config?.entity?.startsWith('light.')) throw new Error('Screen Dimmer slider requires a light entity.');
      this._config = config;
      this._max = Math.min(0.95, Math.max(0, Number(config.max_opacity ?? 0.85)));
      if (!Number.isFinite(this._max) || this._max === 0) throw new Error('max_opacity must be greater than zero and at most 0.95.');
      this._brightnessMode = config.mode === 'brightness';
      this._input.min = this._brightnessMode ? String(Math.ceil((1 - this._max) * 100 - 1e-9)) : '0';
      this._input.setAttribute('aria-label', config.name || (this._brightnessMode ? 'Screen brightness' : 'Screen dimmer'));
      this._overlay.setConfig(config);
      this._render();
    }
    set hass(hass) {
      this._hass = hass;
      this._overlay.hass = hass;
      this._render();
    }
    connectedCallback() {
      this.shadowRoot.appendChild(this._overlay);
      this._render();
    }
    disconnectedCallback() {
      clearTimeout(this._timer);
      clearTimeout(this._settle);
      this._pending = null;
      this._dragging = false;
      this._overlay.clearPreview();
    }
    getCardSize() { return 1; }
    _render() {
      const state = this._hass?.states?.[this._config?.entity];
      this._input.disabled = !state || ['unknown', 'unavailable'].includes(state.state) || this._hass?.connected === false;
      if (this._dragging || this._sending || this._pending != null) return;
      const ratio = state?.state === 'on' ? (state.attributes.brightness || 0) / 255 : 0;
      this._input.value = String(Math.round(this._brightnessMode ? (1 - ratio * this._max) * 100 : ratio * 100));
      this._label();
    }
    _label() {
      this._output.textContent = this._input.value + '%';
      this._input.setAttribute('aria-valuetext', this._input.value + ' percent');
    }
    _queue(final) {
      if (this._input.disabled || !this._config) return;
      clearTimeout(this._settle);
      this._dragging = !final;
      this._label();
      const level = Number(this._input.value);
      this._pending = Math.max(0, Math.min(255, Math.round(this._brightnessMode ? (100 - level) / (100 * this._max) * 255 : level / 100 * 255)));
      this._overlay.previewBrightness(this._pending);
      if (final) {
        clearTimeout(this._timer);
        this._timer = null;
        this._flush();
      } else if (!this._timer && !this._sending) {
        this._timer = setTimeout(() => { this._timer = null; this._flush(); }, 100);
      }
    }
    async _flush() {
      if (this._sending || this._pending == null || !this.isConnected) return;
      const brightness = this._pending;
      this._pending = null;
      this._sending = true;
      let failed = false;
      try {
        await this._hass.callService('light', brightness ? 'turn_on' : 'turn_off', {
          entity_id: this._config.entity, ...(brightness ? { brightness } : {}),
        });
        this._input.setCustomValidity('');
      } catch (error) {
        failed = true;
        this._pending = null;
        this._dragging = false;
        this._overlay.clearPreview();
        this._input.setCustomValidity('Could not update the screen dimmer. Try again.');
        this._input.reportValidity();
        console.error('Screen dimmer update failed', error);
      } finally {
        this._sending = false;
        if (this.isConnected && this._pending != null) {
          if (!this._dragging) this._flush();
          else this._timer = setTimeout(() => { this._timer = null; this._flush(); }, 100);
        } else if (this.isConnected && !failed && !this._dragging) {
          // Allow the state_changed event to arrive before releasing the preview.
          this._settle = setTimeout(() => { this._overlay.clearPreview(); this._render(); }, 1000);
        } else if (failed) this._render();
      }
    }
  }
  if (!customElements.get('screen-dimmer-slider')) customElements.define('screen-dimmer-slider', ScreenDimmerSlider);

  // New card name cannot be captured by the installed legacy script. Keep
  // the old name as an alias only when no other script has registered it.
  if (!customElements.get("screen-dimmer-overlay")) {
    customElements.define("screen-dimmer-overlay", NightDimOverlay);
  }
  if (!customElements.get("night-dim-overlay")) {
    customElements.define("night-dim-overlay", class extends NightDimOverlay {});
  }
})();
