const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "..", "brightness-dimmer.js"), "utf8");
const legacyScript = fs.readFileSync(
  path.join(__dirname, "fixtures", "night-dim-overlay-v2.js"), "utf8"
);
const MAX_OPACITY = 0.85;

function fixture(pathname = "/lovelace/0", existingLegacy = null, legacyFirst = false) {
  const elements = [];
  const timers = [];
  const registry = new Map();
  if (existingLegacy) registry.set("night-dim-overlay", existingLegacy);

  class Element {
    constructor() {
      this.style = {};
      this.attributes = {};
      this.isConnected = false;
      this.id = "";
    }

    setAttribute(name, value) {
      this.attributes[name] = value;
    }

    remove() {
      this.isConnected = false;
      const index = elements.indexOf(this);
      if (index >= 0) elements.splice(index, 1);
    }
  }

  const body = {
    appendChild(element) {
      element.isConnected = true;
      elements.push(element);
    },
  };
  const document = {
    body,
    documentElement: body,
    createElement: () => new Element(),
    querySelectorAll(selector) {
      const id = selector.match(/^\[id="([^"]+)"\]$/)?.[1];
      return elements.filter((element) => element.id === id);
    },
    querySelector() {
      return null;
    },
  };
  const window = { location: { pathname } };
  const customElements = {
    get: (name) => registry.get(name),
    define: (name, value) => {
      if (registry.has(name) || [...registry.values()].includes(value)) {
        throw new Error("custom element already registered");
      }
      registry.set(name, value);
    },
  };
  const context = {
    document,
    window,
    customElements,
    HTMLElement: Element,
    setInterval: (callback) => {
      timers.push(callback);
      return timers.length;
    },
  };
  if (legacyFirst) {
    vm.runInNewContext(legacyScript, context, { filename: "night-dim-overlay-v2.js" });
  }
  vm.runInNewContext(script, context, { filename: "brightness-dimmer.js" });
  const Card = customElements.get("night-dim-overlay");
  const card = new Card();
  const newCard = () => new (customElements.get("screen-dimmer-overlay"))();
  const opacity = () => Number(elements[0]?.style.opacity ?? 0);
  const setStates = (states) => {
    card.hass = { states };
  };
  return { card, newCard, registry, elements, timers, window, opacity, setStates };
}

function light(brightness, state = "on") {
  return {
    entity_id: "light.ha_kiosk_screen_dimmer",
    state,
    attributes: { brightness },
  };
}

test("the light slider controls intermediate tint and both endpoints", () => {
  const f = fixture();
  f.card.setConfig({ entity: "light.ha_kiosk_screen_dimmer" });
  for (const brightness of [1, 64, 128, 192, 255]) {
    f.setStates({ "light.ha_kiosk_screen_dimmer": light(brightness) });
    assert.ok(Math.abs(f.opacity() - brightness / 255 * MAX_OPACITY) < 1e-12);
  }
  f.setStates({ "light.ha_kiosk_screen_dimmer": light(0) });
  assert.equal(f.opacity(), 0);
  assert.equal(f.elements[0].style.pointerEvents, "none");
  assert.equal(f.elements[0].style.position, "fixed");
  assert.equal(f.elements[0].style.inset, "0");
});

test("off, unavailable, absent, and invalid states clear the tint and recover", () => {
  const f = fixture();
  f.card.setConfig({ entity: "light.ha_kiosk_screen_dimmer" });
  f.setStates({ "light.ha_kiosk_screen_dimmer": light(128) });
  assert.ok(f.opacity() > 0);
  for (const state of ["off", "unavailable", "unknown"]) {
    f.setStates({ "light.ha_kiosk_screen_dimmer": light(128, state) });
    assert.equal(f.opacity(), 0);
  }
  f.setStates({});
  assert.equal(f.opacity(), 0);
  f.setStates({ "light.ha_kiosk_screen_dimmer": light("bad") });
  assert.equal(f.opacity(), 0);
  f.setStates({ "light.ha_kiosk_screen_dimmer": light(64) });
  assert.ok(f.opacity() > 0);
});

test("an explicit source scales continuously and fails clear when absent or invalid", () => {
  const f = fixture();
  f.card.setConfig({
    entity: "switch.dimmer",
    brightness_entity: "input_number.dim_level",
  });
  const control = { entity_id: "switch.dimmer", state: "on" };
  f.setStates({ "switch.dimmer": control });
  assert.equal(f.opacity(), 0);
  f.setStates({
    "switch.dimmer": control,
    "input_number.dim_level": {
      entity_id: "input_number.dim_level",
      state: "25",
      attributes: { min: 0, max: 100 },
    },
  });
  assert.equal(f.opacity(), MAX_OPACITY * 0.25);
  f.setStates({
    "switch.dimmer": control,
    "input_number.dim_level": {
      entity_id: "input_number.dim_level",
      state: "unknown",
      attributes: { min: 0, max: 100 },
    },
  });
  assert.equal(f.opacity(), 0);
  f.setStates({
    "switch.dimmer": control,
    "input_number.dim_level": {
      entity_id: "input_number.dim_level",
      state: "50",
      attributes: { min: 100, max: 100 },
    },
  });
  assert.equal(f.opacity(), 0);
});

test("legacy boolean opacity remains supported and capped", () => {
  const f = fixture();
  f.card.setConfig({ entity: "switch.dimmer", opacity: 0.42 });
  f.setStates({ "switch.dimmer": { entity_id: "switch.dimmer", state: "on" } });
  assert.equal(f.opacity(), 0.42);
  f.card.setConfig({ entity: "switch.dimmer", opacity: 1 });
  assert.equal(f.opacity(), MAX_OPACITY);
  f.setStates({ "switch.dimmer": { entity_id: "switch.dimmer", state: "off" } });
  assert.equal(f.opacity(), 0);
});

test("repeated state/config updates keep one overlay and one polling timer", () => {
  const f = fixture();
  f.card.setConfig({ entity: "light.ha_kiosk_screen_dimmer" });
  for (let i = 1; i <= 10; i++) {
    f.setStates({ "light.ha_kiosk_screen_dimmer": light(i * 20) });
    f.card.setConfig({ entity: "light.ha_kiosk_screen_dimmer" });
  }
  assert.equal(f.elements.length, 1);
  assert.equal(f.timers.length, 1);
});

test("the default opt-in scope follows its dashboard, not other HA pages", () => {
  const f = fixture("/lovelace/kiosk");
  f.card.setConfig({ entity: "light.ha_kiosk_screen_dimmer" });
  f.setStates({ "light.ha_kiosk_screen_dimmer": light(200) });
  const dimmed = f.opacity();
  f.window.location.pathname = "/lovelace/other-view";
  f.timers[0]();
  assert.equal(f.opacity(), dimmed);
  f.window.location.pathname = "/config/dashboard";
  f.timers[0]();
  assert.equal(f.opacity(), 0);
  f.window.location.pathname = "/lovelace/kiosk";
  f.timers[0]();
  assert.equal(f.opacity(), dimmed);
});

test("view and all scopes require explicit selection", () => {
  const f = fixture("/kiosk/one");
  f.card.setConfig({ entity: "light.ha_kiosk_screen_dimmer", scope: "view" });
  f.setStates({ "light.ha_kiosk_screen_dimmer": light(255) });
  f.window.location.pathname = "/kiosk/two";
  f.timers[0]();
  assert.equal(f.opacity(), 0);
  f.card.setConfig({ entity: "light.ha_kiosk_screen_dimmer", scope: "all" });
  f.window.location.pathname = "/config";
  f.timers[0]();
  assert.equal(f.opacity(), MAX_OPACITY);
});

test("old light without brightness uses configured boolean opacity", () => {
  const f = fixture();
  f.card.setConfig({ entity: "light.ha_kiosk_screen_dimmer", opacity: 0.3 });
  f.setStates({
    "light.ha_kiosk_screen_dimmer": {
      entity_id: "light.ha_kiosk_screen_dimmer",
      state: "on",
      attributes: {},
    },
  });
  assert.equal(f.opacity(), 0.3);
});

test("missing entity and invalid scope are rejected", () => {
  const f = fixture();
  assert.throws(() => f.card.setConfig({}), /requires an entity/);
  assert.throws(
    () => f.card.setConfig({ entity: "light.ha_kiosk_screen_dimmer", scope: "bad" }),
    /scope must be/
  );
});

test("a disconnected HA session clears tint and reconnecting restores it", () => {
  const f = fixture();
  f.card.setConfig({ entity: "light.ha_kiosk_screen_dimmer" });
  const states = { "light.ha_kiosk_screen_dimmer": light(150) };
  f.card.hass = { connected: true, states };
  assert.ok(f.opacity() > 0);
  f.card.hass = { connected: false, states };
  assert.equal(f.opacity(), 0);
  f.card.hass = { connected: true, states };
  assert.ok(f.opacity() > 0);
});

test("either mode retains scheduled boolean tint and independent slider dimming", () => {
  const f = fixture();
  const card = f.newCard();
  card.setConfig({
    entity: "input_boolean.night_mode",
    brightness_entity: "light.ha_kiosk_screen_dimmer",
    combine: "either",
    opacity: 0.5,
  });
  const states = (night, level, lightState = "on") => ({
    "input_boolean.night_mode": {
      entity_id: "input_boolean.night_mode",
      state: night,
    },
    "light.ha_kiosk_screen_dimmer": light(level, lightState),
  });
  card.hass = { states: states("off", 0, "off") };
  assert.equal(f.opacity(), 0);
  card.hass = { states: states("on", 0, "off") };
  assert.equal(f.opacity(), 0.5);
  card.hass = { states: states("off", 128) };
  assert.equal(f.opacity(), 128 / 255 * MAX_OPACITY);
  card.hass = { states: states("on", 64) };
  assert.equal(f.opacity(), 64 / 255 * MAX_OPACITY);
  card.hass = { states: states("on", 0, "unavailable") };
  assert.equal(f.opacity(), 0.5);
  card.hass = { states: states("on", "invalid") };
  assert.equal(f.opacity(), 0.5);
  card.hass = { states: {
    "input_boolean.night_mode": {
      entity_id: "input_boolean.night_mode", state: "on",
    },
  } };
  assert.equal(f.opacity(), 0.5);
  card.hass = { states: states("off", 0, "unavailable") };
  assert.equal(f.opacity(), 0);
  card.hass = { states: {
    "light.ha_kiosk_screen_dimmer": light(255),
  } };
  assert.equal(f.opacity(), MAX_OPACITY);
});

test("default gate mode preserves old control semantics", () => {
  const f = fixture();
  const card = f.newCard();
  card.setConfig({
    entity: "input_boolean.night_mode",
    brightness_entity: "light.ha_kiosk_screen_dimmer",
  });
  card.hass = { states: {
    "input_boolean.night_mode": {
      entity_id: "input_boolean.night_mode", state: "off",
    },
    "light.ha_kiosk_screen_dimmer": light(255),
  } };
  assert.equal(f.opacity(), 0);
  card.hass = { states: {
    "input_boolean.night_mode": {
      entity_id: "input_boolean.night_mode", state: "on",
    },
    "light.ha_kiosk_screen_dimmer": light(128),
  } };
  assert.equal(f.opacity(), 128 / 255 * MAX_OPACITY);
});

test("new element remains usable when the legacy script registered first", () => {
  class LegacyOverlay {}
  const f = fixture("/kiosk/0", LegacyOverlay);
  assert.equal(f.registry.get("night-dim-overlay"), LegacyOverlay);
  assert.ok(f.registry.get("screen-dimmer-overlay"));
  const card = f.newCard();
  card.setConfig({ entity: "light.ha_kiosk_screen_dimmer" });
  card.hass = { states: {
    "light.ha_kiosk_screen_dimmer": light(100),
  } };
  assert.equal(f.opacity(), 100 / 255 * MAX_OPACITY);
  assert.equal(f.elements.length, 1);
});

test("a fresh load exposes both distinct card names for compatibility", () => {
  const f = fixture();
  assert.ok(f.registry.get("night-dim-overlay"));
  assert.ok(f.registry.get("screen-dimmer-overlay"));
  assert.notEqual(
    f.registry.get("night-dim-overlay"),
    f.registry.get("screen-dimmer-overlay")
  );
  assert.throws(
    () => f.newCard().setConfig({
      entity: "light.ha_kiosk_screen_dimmer", combine: "invalid",
    }),
    /combine must be/
  );
});

test("the actual registered v2 script cannot capture the new card type", () => {
  const f = fixture("/kiosk/0", null, true);
  assert.ok(f.registry.get("night-dim-overlay"));
  assert.ok(f.registry.get("screen-dimmer-overlay"));
  const card = f.newCard();
  card.setConfig({
    entity: "input_boolean.night_mode",
    brightness_entity: "light.ha_kiosk_screen_dimmer",
    combine: "either",
    opacity: 0.5,
  });
  card.hass = { states: {
    "input_boolean.night_mode": {
      entity_id: "input_boolean.night_mode", state: "on",
    },
    "light.ha_kiosk_screen_dimmer": light(0, "off"),
  } };
  assert.equal(f.opacity(), 0.5);
});

test("configurable maximum scales brightness and remains recoverable", () => {
  const f = fixture();
  const card = f.newCard();
  card.setConfig({ entity: "light.ha_kiosk_screen_dimmer", max_opacity: 0.6 });
  card.hass = { states: { "light.ha_kiosk_screen_dimmer": light(128) } };
  assert.equal(f.opacity(), 128 / 255 * 0.6);
  card.hass = { states: { "light.ha_kiosk_screen_dimmer": light(255) } };
  assert.equal(f.opacity(), 0.6);
  card.setConfig({ entity: "light.ha_kiosk_screen_dimmer", max_opacity: 8 });
  assert.equal(f.opacity(), 0.95);
  card.setConfig({ entity: "light.ha_kiosk_screen_dimmer", max_opacity: -1 });
  assert.equal(f.opacity(), 0);
  card.setConfig({ entity: "light.ha_kiosk_screen_dimmer", max_opacity: "bad" });
  assert.equal(f.opacity(), MAX_OPACITY);
});

test("boolean fallback obeys configured maximum in combined mode", () => {
  const f = fixture();
  const card = f.newCard();
  card.setConfig({
    entity: "input_boolean.night_mode",
    brightness_entity: "light.ha_kiosk_screen_dimmer",
    combine: "either", opacity: 0.5, max_opacity: 0.3,
  });
  card.hass = { states: {
    "input_boolean.night_mode": {
      entity_id: "input_boolean.night_mode", state: "on",
    },
    "light.ha_kiosk_screen_dimmer": light(0, "off"),
  } };
  assert.equal(f.opacity(), 0.3);
});
