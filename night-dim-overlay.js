class NightDimOverlay extends HTMLElement {
  setConfig(config) {
    this.entity = config.entity;
    this.opacity = config.opacity || 0.5;
  }

  set hass(hass) {
    // create overlay once
    if (!this.overlay) {
      this.overlay = document.createElement("div");
      this.overlay.id = "night-dim-overlay";
      this.overlay.style.position = "fixed";
      this.overlay.style.inset = "0";
      this.overlay.style.background = `rgba(0,0,0,${this.opacity})`;
      this.overlay.style.zIndex = "99999";
      this.overlay.style.pointerEvents = "none";
      this.overlay.style.transition = "opacity 0.5s ease";
      this.overlay.style.opacity = "0";
      document.body.appendChild(this.overlay);
    }

    const state = hass.states[this.entity]?.state;

    // always update on every hass change
    if (state === "on") {
      this.overlay.style.opacity = this.opacity;
    } else {
      this.overlay.style.opacity = "0";
    }
  }

  getCardSize() {
    return 0;
  }
}

customElements.define("night-dim-overlay", NightDimOverlay);
