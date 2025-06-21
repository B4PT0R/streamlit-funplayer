/**
 * Polyfills for build compatibility
 * ✅ NOUVEAU: Ensure EventTarget is available in all environments
 */

// ✅ EventTarget polyfill pour les environnements qui n'en ont pas
if (typeof globalThis.EventTarget === 'undefined') {
  // Polyfill simple d'EventTarget pour les builds
  class EventTargetPolyfill {
    constructor() {
      this._listeners = new Map();
    }

    addEventListener(type, listener, options) {
      if (!this._listeners.has(type)) {
        this._listeners.set(type, new Set());
      }
      this._listeners.get(type).add(listener);
    }

    removeEventListener(type, listener) {
      if (this._listeners.has(type)) {
        this._listeners.get(type).delete(listener);
      }
    }

    dispatchEvent(event) {
      if (this._listeners.has(event.type)) {
        this._listeners.get(event.type).forEach(listener => {
          if (typeof listener === 'function') {
            listener.call(this, event);
          } else if (listener && typeof listener.handleEvent === 'function') {
            listener.handleEvent(event);
          }
        });
      }
      return true;
    }

    // Alias pour compatibilité buttplug
    on(type, listener) {
      this.addEventListener(type, listener);
    }

    off(type, listener) {
      this.removeEventListener(type, listener);
    }

    emit(type, ...args) {
      const event = { type, detail: args };
      this.dispatchEvent(event);
    }
  }

  globalThis.EventTarget = EventTargetPolyfill;
  
  // ✅ AJOUT: S'assurer que window.EventTarget existe aussi
  if (typeof window !== 'undefined') {
    window.EventTarget = EventTargetPolyfill;
  }
}

// ✅ Process polyfill si nécessaire (pour Node.js modules)
if (typeof globalThis.process === 'undefined') {
  globalThis.process = {
    env: { NODE_ENV: 'production' },
    nextTick: (cb) => setTimeout(cb, 0),
    version: 'v16.0.0'
  };
}

// ✅ Buffer polyfill si nécessaire
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = {
    from: (data) => new Uint8Array(data),
    isBuffer: () => false
  };
}