import ButtPlugManager from './ButtPlugManager';
import FunscriptManager from './FunscriptManager';
import PlaylistManager from './PlaylistManager';

/**
 * Managers - Singleton centralisé pour tous les managers de l'application
 * 
 * ✅ ARCHITECTURE:
 * - Lazy initialization des managers via getters
 * - Setup événements une seule fois par manager
 * - API simple et prévisible partout dans l'app
 * - Méthodes combinées pour workflows complexes
 */
class Managers {
  static instance = null;
  
  constructor() {
    if (Managers.instance) {
      return Managers.instance;
    }
    
    // ============================================================================
    // INSTANCES PRIVÉES - Lazy initialization via getters
    // ============================================================================
    this._buttplug = null;
    this._funscript = null;
    this._playlist = null;
    
    // ============================================================================
    // SYSTÈME D'ÉVÉNEMENTS - Simple et efficace
    // ============================================================================
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
  // SECTION 1: GETTERS MANAGERS - Lazy init + setup événements
  // ============================================================================
  
  /**
   * ButtPlug Manager - Device haptic communication
   */
  get buttplug() {
    if (!this._buttplug) {
      this._buttplug = new ButtPlugManager();
      
      // ✅ Setup événements UNE FOIS
      this._buttplug.onConnectionChanged = (connected) => {
        this._notify('buttplug:connection', { connected });
      };
      
      this._buttplug.onDeviceChanged = (device) => {
        this._notify('buttplug:device', { device });
      };
      
      this._buttplug.onError = (message, error) => {
        this._notify('buttplug:error', { message, error });
      };
      
      this._buttplug.onConfigChanged = (key, data) => {
        this._notify('buttplug:config', { key, data });
      };
    }
    
    return this._buttplug;
  }
  
  /**
   * Funscript Manager - Haptic data processing
   */
  get funscript() {
    if (!this._funscript) {
      this._funscript = new FunscriptManager();
      
      // ✅ Setup événements UNE FOIS
      this._funscript.onLoad = (data) => {
        this._notify('funscript:load', { 
          data, 
          channels: this._funscript.getChannels(),
          duration: this._funscript.getDuration()
        });
      };
      
      this._funscript.onReset = () => {
        this._notify('funscript:reset', {});
      };
      
      this._funscript.onChannelsChanged = (channels) => {
        this._notify('funscript:channels', { 
          channels,
          total: channels.length 
        });
      };
      
      this._funscript.onOptionsChanged = (channel, options) => {
        this._notify('funscript:options', { 
          channel, 
          options,
          allOptions: this._funscript.getAllOptions()
        });
      };

      this._funscript.onGlobalScaleChanged = (scale) => {
        this._notify('funscript:globalScale', { 
          scale,
          scalePercent: Math.round(scale * 100)
        });
      };

      this._funscript.onGlobalOffsetChanged = (offset) => {
        this._notify('funscript:globalOffset', { 
          offset,
          offsetMs: offset * 1000 
        });
      };
    }
    
    return this._funscript;
  }

  /**
   * Playlist Manager - Media playlist handling
   */
  get playlist() {
    if (!this._playlist) {
      this._playlist = new PlaylistManager();
      
      // ✅ Setup événements UNE FOIS
      this._playlist.onPlaylistLoaded = (items, originalPlaylist) => {
        this._notify('playlist:loaded', { 
          items, 
          originalPlaylist,
          totalItems: items.length 
        });
      };
      
      this._playlist.onItemChanged = (index, item, previousIndex) => {
        this._notify('playlist:itemChanged', { 
          index, 
          item,
          previousIndex,
          hasNext: this._playlist.canNext(),
          hasPrevious: this._playlist.canPrevious()
        });
      };
      
      this._playlist.onPlaybackChanged = (playbackState) => {
        this._notify('playlist:playbackChanged', { 
          ...playbackState,
          playlistInfo: this._playlist.getPlaylistInfo()
        });
      };

      this._playlist.onItemUpdated = (index, item, change) => {
        this._notify('playlist:itemUpdated', { 
          index, 
          item, 
          change 
        });
      };
      
      this._playlist.onError = (message, error) => {
        this._notify('playlist:error', { 
          message, 
          error 
        });
      };
    }
    
    return this._playlist;
  }
  
  // ============================================================================
  // SECTION 2: MÉTHODES COMBINÉES - Workflows complexes
  // ============================================================================
  
  /**
   * Auto-connect workflow: Connect + Scan + Select + AutoMap
   */
  async autoConnect(scanTimeout = 3000) {
    try {
      // 1. Se connecter à Intiface
      const connected = await this.buttplug.connect();
      if (!connected) {
        throw new Error('Failed to connect to Intiface Central');
      }
      
      // 2. Scanner les devices
      const devices = await this.buttplug.scan(scanTimeout);
      if (devices.length === 0) {
        throw new Error('No devices found');
      }
      
      // 3. Sélectionner le premier device
      const selectSuccess = this.buttplug.selectDevice(devices[0].index);
      if (!selectSuccess) {
        throw new Error('Failed to select device');
      }
      
      // 4. Auto-mapper les canaux
      const mapResult = this.autoMapChannels();
      
      // ✅ Événement succès
      this._notify('managers:autoConnect', {
        success: true,
        device: devices[0],
        mapResult,
        capabilities: this.buttplug.getCapabilities()
      });
      
      return {
        success: true,
        device: devices[0],
        mapResult
      };
      
    } catch (error) {
      // ✅ Événement échec
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
   * Auto-map channels to device actuators
   */
  autoMapChannels() {
    const capabilities = this.buttplug?.getCapabilities() || null;
    const result = this.funscript.autoMapChannels(capabilities);
    
    // ✅ Événement mapping
    this._notify('managers:autoMap', {
      result,
      capabilities,
      mode: capabilities ? 'device' : 'virtual'
    });
    
    return result;
  }
  
  // ============================================================================
  // SECTION 3: SYSTÈME D'ÉVÉNEMENTS - Simple et efficace
  // ============================================================================
  
  /**
   * Ajouter un listener d'événements
   * @param {Function} callback - Fonction (event, data) => {}
   * @returns {Function} - Fonction de cleanup
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  /**
   * Notifier tous les listeners
   * @private
   */
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
  // SECTION 4: STATUS & CLEANUP - Utilitaires
  // ============================================================================
  
  /**
   * Statut global de tous les managers
   */
  getStatus() {
    return {
      buttplug: this._buttplug?.getStatus() || { isConnected: false },
      funscript: this._funscript?.getDebugInfo() || { loaded: false },
      playlist: this._playlist?.getStats() || { totalItems: 0 }
    };
  }
  
  /**
   * Cleanup complet de tous les managers
   */
  async cleanup() {
    // Cleanup ButtPlug
    if (this._buttplug) {
      await this._buttplug.cleanup();
      this._buttplug = null;
    }
    
    // Cleanup Playlist
    if (this._playlist) {
      this._playlist.cleanup();
      this._playlist = null;
    }
    
    // Cleanup Funscript (désactiver callbacks avant reset)
    if (this._funscript) {
      this._funscript.onLoad = null;
      this._funscript.onReset = null;
      this._funscript.onChannelsChanged = null;
      this._funscript.onOptionsChanged = null;
      this._funscript.onGlobalOffsetChanged = null;
      this._funscript.onGlobalScaleChanged = null;
      
      this._funscript.reset();
      this._funscript = null;
    }
    
    // Cleanup événements
    this.listeners.clear();
    
    console.log('Managers: Cleanup complete');
  }
  
  /**
   * Reset complet (pour debug/dev)
   */
  static async reset() {
    if (Managers.instance) {
      await Managers.instance.cleanup();
      Managers.instance = null;
    }
  }
}

// Export de l'instance singleton
export default Managers.getInstance();