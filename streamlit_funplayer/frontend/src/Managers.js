import ButtPlugManager from './ButtPlugManager';
import FunscriptManager from './FunscriptManager';
import PlaylistManager from './PlaylistManager';

/**
 * Managers - Singleton pour gérer les instances uniques
 * ✅ MODIFIÉ: Système d'événements étendu + PlaylistManager unifié
 */
class Managers {
  static instance = null;
  
  constructor() {
    if (Managers.instance) {
      return Managers.instance;
    }
    
    // Instances des managers
    this.buttplug = null;
    this.funscript = null;
    this.playlist = null;  // ✅ NOUVEAU: PlaylistManager unifié (ex-MediaManager)
    
    // Gestion de l'initialisation async
    this.initPromises = new Map();
    
    // Système d'événements simple
    this.listeners = new Set();
    
    Managers.instance = this;
  }
  
  static getInstance() {
    if (!Managers.instance) {
      new Managers();
    }
    return Managers.instance;
  }
  
  // ============================================================================
  // GETTERS - ✅ MODIFIÉ: FunscriptManager avec événements
  // ============================================================================
  
  async getButtPlug() {
    if (this.buttplug) {
      return this.buttplug;
    }
    
    if (this.initPromises.has('buttplug')) {
      return this.initPromises.get('buttplug');
    }
    
    const initPromise = this._initButtPlug();
    this.initPromises.set('buttplug', initPromise);
    
    try {
      this.buttplug = await initPromise;
      return this.buttplug;
    } finally {
      this.initPromises.delete('buttplug');
    }
  }
  
  getFunscript() {
    if (!this.funscript) {
      this.funscript = this._initFunscript();
    }
    return this.funscript;
  }
  
  getPlaylist() {
    if (!this.playlist) { // ✅ Protection singleton
      this.playlist = this._initPlaylist();
    }
    return this.playlist;
  }
  
  // ============================================================================
  // INITIALISATION - ✅ NOUVEAU: _initFunscript avec événements
  // ============================================================================
  
  async _initButtPlug() {
    const manager = new ButtPlugManager();
    await manager.init();
    
    // Redirection des événements vers nos listeners
    manager.onConnectionChanged = (connected) => {
      this._notify('buttplug:connection', { connected });
    };
    manager.onDeviceChanged = (device) => {
      this._notify('buttplug:device', { device });
    };
    manager.onError = (message, error) => {
      this._notify('buttplug:error', { message, error });
    };
    manager.onConfigChanged = (key, data) => {
      this._notify('buttplug:config', { key, data });
    };
    
    return manager;
  }

  // ✅ NOUVEAU: Initialisation FunscriptManager avec événements
  _initFunscript() {
    const manager = new FunscriptManager();
    
    // ✅ NOUVEAU: Redirection des événements funscript vers le système global
    manager.onLoad = (data) => {
      this._notify('funscript:load', { 
        data, 
        channels: manager.getChannels(),
        duration: manager.getDuration()
      });
    };
    
    manager.onReset = () => {
      this._notify('funscript:reset', {});
    };
    
    manager.onChannelsChanged = (channels) => {
      this._notify('funscript:channels', { 
        channels,
        total: channels.length 
      });
    };
    
    manager.onOptionsChanged = (channel, options) => {
      this._notify('funscript:options', { 
        channel, 
        options,
        allOptions: manager.getAllOptions()
      });
    };

    // ✅ NOUVEAU: Global scale event forwarding
    manager.onGlobalScaleChanged = (scale) => {
      this._notify('funscript:globalScale', { 
        scale,
        scalePercent: Math.round(scale * 100)
      });
    };

    manager.onGlobalOffsetChanged = (offset) => {
      this._notify('funscript:globalOffset', { 
        offset,
        offsetMs: offset * 1000 
      });
    };
    
    return manager;
  }

  // ✅ NOUVEAU: Initialisation PlaylistManager avec événements
  _initPlaylist() {
    const manager = new PlaylistManager();
    
    // ✅ NOUVEAU: Redirection des événements playlist vers le système global
    manager.onPlaylistLoaded = (items, originalPlaylist) => {
      this._notify('playlist:loaded', { 
        items, 
        originalPlaylist,
        totalItems: items.length 
      });
    };
    
    manager.onItemChanged = (index, item, previousIndex) => {
      this._notify('playlist:itemChanged', { 
        index, 
        item,
        previousIndex,
        hasNext: manager.canNext(),
        hasPrevious: manager.canPrevious()
      });
    };
    
    manager.onPlaybackChanged = (playbackState) => {
      this._notify('playlist:playbackChanged', { 
        ...playbackState,
        playlistInfo: manager.getPlaylistInfo()
      });
    };
    
    manager.onError = (message, error) => {
      this._notify('playlist:error', { 
        message, 
        error 
      });
    };
    
    return manager;
  }
  
  // ============================================================================
  // MÉTHODES COMBINÉES - ✅ MODIFIÉ: Avec événements enrichis
  // ============================================================================
  
  /**
   * Auto-connect : Connect + Scan + Select first + AutoMap
   */
  async autoConnect(scanTimeout = 3000) {
    try {
      // 1. Obtenir le manager ButtPlug
      const buttplug = await this.getButtPlug();
      
      // 2. Se connecter à Intiface
      const connected = await buttplug.connect();
      if (!connected) {
        throw new Error('Failed to connect to Intiface Central');
      }
      
      // 3. Scanner les devices
      const devices = await buttplug.scan(scanTimeout);
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      
      // 4. Sélectionner le premier device
      const selectSuccess = buttplug.selectDevice(devices[0].index);
      if (!selectSuccess) {
        throw new Error('Failed to select device');
      }
      
      // 5. Auto-mapper les canaux funscript
      const mapResult = this.autoMapChannels();
      
      // ✅ NOUVEAU: Événement combiné pour autoConnect réussi
      this._notify('managers:autoConnect', {
        success: true,
        device: devices[0],
        mapResult,
        capabilities: buttplug.getCapabilities()
      });
      
      return {
        success: true,
        device: devices[0],
        mapResult
      };
      
    } catch (error) {
      // ✅ NOUVEAU: Événement combiné pour autoConnect échoué
      this._notify('managers:autoConnect', {
        success: false,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Auto-map channels avec événement enrichi
   */
  autoMapChannels() {
    const funscript = this.getFunscript();
    const capabilities = this.buttplug?.getCapabilities() || null;
    const result = funscript.autoMapChannels(capabilities);
    
    // ✅ Événement spécifique pour auto-mapping
    this._notify('managers:autoMap', {
      result,
      capabilities,
      mode: capabilities ? 'device' : 'virtual'
    });
    
    return result;
  }
  
  // ============================================================================
  // SYSTÈME D'ÉVÉNEMENTS - Inchangé
  // ============================================================================
  
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  _notify(event, data) {
    console.log('🔔 Managers._notify called:', event, data);
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Managers: Listener error:', error);
      }
    });
  }
  
  // ============================================================================
  // STATUS & CLEANUP - ✅ MODIFIÉ: Cleanup funscript events
  // ============================================================================
  
  getStatus() {
    return {
      buttplug: this.buttplug?.getStatus() || { isConnected: false },
      funscript: this.funscript?.getDebugInfo() || { loaded: false },
      playlist: this.playlist?.getStats() || { totalItems: 0 }  // ✅ MODIFIÉ: PlaylistManager
    };
  }
  
  async cleanup() {
    // Cleanup des managers existants
    if (this.buttplug) {
      await this.buttplug.cleanup();
      this.buttplug = null;
    }
    
    // ✅ MODIFIÉ: Cleanup du PlaylistManager au lieu de MediaManager
    if (this.playlist) {
      this.playlist.cleanup();
      this.playlist = null;
    }
    
    // ✅ Cleanup du FunscriptManager avec événements
    if (this.funscript) {
      // Désactiver les callbacks avant reset pour éviter les événements parasites
      this.funscript.onLoad = null;
      this.funscript.onReset = null;
      this.funscript.onChannelsChanged = null;
      this.funscript.onOptionsChanged = null;
      this.funscript.onGlobalOffsetChanged = null;
      
      this.funscript.reset();
      this.funscript = null;
    }
    
    // Reset état
    this.initPromises.clear();
    this.listeners.clear();
  }
  
  // Reset complet de l'instance (debug/dev)
  static async reset() {
    if (Managers.instance) {
      await Managers.instance.cleanup();
      Managers.instance = null;
    }
  }
}

// Export de l'instance singleton
export default Managers.getInstance();