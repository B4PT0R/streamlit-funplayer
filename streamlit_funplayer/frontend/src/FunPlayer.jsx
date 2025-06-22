import React, { Component } from 'react';
import MediaPlayer from './MediaPlayer';
import PlaylistComponent from './PlaylistComponent';
import HapticSettingsComponent from './HapticSettingsComponent';
import HapticVisualizerComponent from './HapticVisualizerComponent';
import managers from './Managers';

/**
 * FunPlayer - ✅ OPTIMISÉ: Accès simplifié aux managers + événements étendus
 */
class FunPlayer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      status: 'idle',
      error: null,
      isReady: false,
      updateRate: 60,
      isPlaying: false,
      currentActuatorData: new Map(),
      showVisualizer: true,
      showDebug: false,
      renderTrigger: 0  // ✅ Pattern cohérent avec autres composants
      // ✅ SUPPRIMÉ: Plus d'état playlist (currentPlaylistIndex, playlistItems)
    };
    
    this.mediaPlayerRef = React.createRef();
    
    // Haptic loop
    this.hapticIntervalId = null;
    this.expectedHapticTime = 0;
    this.hapticTime = 0;
    this.lastMediaTime = 0;
    this.lastSyncTime = 0;
    
    // Event listener cleanup
    this.managersListener = null;
  }

  componentDidMount() {
    this.applyTheme();
    this.initializeComponent();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.theme !== this.props.theme) {
      this.applyTheme();
    }
    
    // ✅ SYNCHRONISATION EXPLICITE: Seulement si la référence change
    if (prevProps.playlist !== this.props.playlist) {
      this.synchronizePlaylistWithManager();
    }
  }

  synchronizePlaylistWithManager = async () => {
    const { playlist } = this.props;
    
    console.log('🎮 FunPlayer: Synchronizing playlist with manager:', playlist?.length || 0, 'items');
    
    if (!playlist || playlist.length === 0) {
      this.playlist.reset();
      this.setStatus('No playlist loaded');
      return;
    }

    // ✅ SIMPLE: Juste synchroniser, une fois
    try {
      await this.playlist.loadPlaylist(playlist);
      // Les événements géreront le reste
    } catch (error) {
      console.error('FunPlayer: Failed to sync playlist:', error);
      this.setError('Failed to sync playlist', error);
    }
  }

  componentWillUnmount() {
    this.stopHapticLoop();
    if (this.managersListener) {
      this.managersListener();
    }
  }

  // ============================================================================
  // ✅ NOUVEAU: PROPRIÉTÉS COMPUTED POUR ACCÈS SIMPLIFIÉ
  // ============================================================================

  get buttplug() {
    return managers.buttplug;
  }

  get funscript() {
    return managers.getFunscript();
  }

  get playlist() {
    return managers.getPlaylist();
  }

  // ============================================================================
  // ✅ MODIFIÉ: GESTION D'ÉVÉNEMENTS ÉTENDUE
  // ============================================================================

  handleManagerEvent = (event, data) => {
    switch (event) {
      case 'buttplug:connection':
        this.setStatus(data.connected ? 'Connected to Intiface' : 'Disconnected from Intiface');
        this._triggerRender();
        break;
        
      case 'buttplug:device':
        this.setStatus(data.device ? `Device selected: ${data.device.name}` : 'No device selected');
        this._triggerRender();
        break;
        
      case 'buttplug:error':
        this.setError('Device error', data.error);
        break;
        
      // ✅ Événements funscript
      case 'funscript:load':
        this.setStatus(`Funscript loaded: ${data.channels.length} channels, ${data.duration.toFixed(2)}s`);
        this._triggerRender();
        break;
        
      case 'funscript:channels':
        this._triggerRender(); // Re-render pour mettre à jour les UI qui dépendent des canaux
        break;
        
      case 'funscript:options':
      case 'funscript:globalOffset':
        // Pas besoin de re-render complet, juste noter dans les logs
        break;

      // ✅ NOUVEAU: Événements playlist
      case 'playlist:loaded':
        this.setStatus(`Playlist loaded: ${data.totalItems} items`);
        this.setState({ isReady: false }); // Prêt pour sélection d'item
        this._triggerRender();
        break;
        
      case 'playlist:itemChanged':
        this.setStatus(`Playing item ${data.index + 1}: ${data.item?.name || 'Untitled'}`);
        this.setState({ isReady: false }); // Pas encore prêt, attendre loadFunscript
        this._triggerRender();
        
        // ✅ NOUVEAU: Charger le funscript de l'item sélectionné
        this._loadItemFunscript(data.item);
        break;
        
      case 'playlist:playbackChanged':
        // Synchroniser l'état de lecture local
        this.setState({ isPlaying: data.isPlaying });
        break;
        
      case 'playlist:error':
        this.setError('Playlist error', data.error);
        break;
        
      // ✅ Événements combinés
      case 'managers:autoConnect':
        if (data.success) {
          this.setStatus(`Auto-connected to ${data.device.name} (${data.mapResult.mapped}/${data.mapResult.total} channels mapped)`);
        } else {
          this.setError('Auto-connect failed', data.error);
        }
        this._triggerRender();
        break;
        
      case 'managers:autoMap':
        this.setStatus(`Auto-mapped ${data.result.mapped}/${data.result.total} channels to ${data.mode} actuators`);
        break;
    }
  }

  // ✅ NOUVEAU: Helper pour trigger re-render
  _triggerRender = () => {
    this.setState(prevState => ({ 
      renderTrigger: prevState.renderTrigger + 1 
    }));
  }

  // ============================================================================
  // INITIALIZATION - ✅ SIMPLIFIÉ: Accès via propriétés computed
  // ============================================================================

  initializeComponent = () => {
    try {
      // Écouter les événements des managers
      this.managersListener = managers.addListener(this.handleManagerEvent);
      
      this.setStatus('Component initialized');
      
      // Traitement initial de la playlist
      if (this.props.playlist) {
        this.handlePlaylistUpdate();
      }
      
    } catch (error) {
      console.error('FunPlayer: Initialization error:', error);
      this.setError('Failed to initialize', error);
    }
  }

  // ============================================================================
  // PLAYLIST MANAGEMENT - ✅ SIMPLIFIÉ: Délègue au PlaylistManager
  // ============================================================================

  handlePlaylistUpdate = async () => {
    const { playlist } = this.props;
    
    console.log('🎮 FunPlayer.handlePlaylistUpdate called with:', playlist?.length, 'items');
    
    if (!playlist || playlist.length === 0) {
      this.playlist.reset();
      this.setStatus('No playlist loaded');
      this.setState({ isReady: true });
      return;
    }

    this.setStatus(`Processing playlist...`);

    try {
      console.log('🎮 Calling PlaylistManager.loadPlaylist...');
      await this.playlist.loadPlaylist(playlist);
      console.log('🎮 PlaylistManager loaded, items:', this.playlist.getItems().length);
      
    } catch (error) {
      console.error('FunPlayer: Failed to process playlist:', error);
      this.setError('Failed to process playlist', error);
    }
  }

  // ✅ NOUVEAU: Charge le funscript d'un item (appelé depuis handleManagerEvent)
  _loadItemFunscript = async (item) => {
    if (!item) {
      this.setState({ isReady: true });
      return;
    }

    this.stopHapticLoop();
    
    // ✅ Arrêter les devices
    if (this.buttplug) {
      try {
        await this.buttplug.stopAll();
      } catch (error) {
        console.warn('Failed to stop devices:', error);
      }
    }

    try {
      if (item.funscript) {
        if (typeof item.funscript === 'object') {
          await this.loadFunscriptData(item.funscript);
        } else {
          await this.loadFunscript(item.funscript);
        }
      } else {
        // Reset funscript si pas de haptic
        this.funscript.reset();
      }

      this.setState({ isReady: true });
      this.setStatus(`Ready: ${item.name || item.title || 'Untitled'}`);

    } catch (error) {
      this.setError(`Failed to load funscript for item`, error);
    }
  }

  // ✅ SUPPRIMÉ: Plus besoin de handlePlaylistItemChange
  // Le PlaylistManager gère la navigation et les événements

  // ============================================================================
  // FUNSCRIPT LOADING - ✅ MODIFIÉ: Utilise la propriété computed
  // ============================================================================

  loadFunscript = async (src) => {
    try {
      let data;
      if (typeof src === 'string') {
        if (src.startsWith('http') || src.startsWith('/')) {
          const response = await fetch(src);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          data = await response.json();
        } else {
          data = JSON.parse(src);
        }
      } else {
        data = src;
      }
      
      // ✅ MODIFIÉ: Utilise la propriété computed
      this.funscript.load(data);
      
      // Auto-map avec device connecté
      const mapResult = managers.autoMapChannels();
      console.log(`Auto-mapped ${mapResult.mapped}/${mapResult.total} channels`);
      
    } catch (error) {
      console.error('Failed to load funscript:', error);
      throw error;
    }
  }

  loadFunscriptData = async (data) => {
    try {
      // ✅ MODIFIÉ: Utilise la propriété computed
      this.funscript.load(data);
      
      const mapResult = managers.autoMapChannels();
      console.log(`Auto-mapped ${mapResult.mapped}/${mapResult.total} channels`);
      
    } catch (error) {
      console.error('Failed to load funscript data:', error);
      throw error;
    }
  }

  // ============================================================================
  // MEDIA PLAYER EVENTS - ✅ MODIFIÉ: Synchronisation avec PlaylistManager
  // ============================================================================

  handleMediaLoadEnd = (data) => {
    console.log('Media loaded:', data);
    this.setState({ isReady: true }, () => {
      this.setStatus(`Media ready (${data.duration?.toFixed(1)}s)`);
      this.triggerResize();
    });
  }

  handleMediaError = (error) => {
    console.error('Media error:', error);
    this.setError('Media loading failed', error);
  }

  handleMediaPlay = () => {
    this.hapticTime = this.mediaPlayerRef.current?.getTime() || 0;
    this.lastMediaTime = this.hapticTime;
    this.lastSyncTime = performance.now();
    
    const currentTime = this.mediaPlayerRef.current?.getTime() || 0;
    const duration = this.mediaPlayerRef.current?.getDuration() || 0;
    
    // ✅ NOUVEAU: Synchroniser avec PlaylistManager
    this.playlist.updatePlaybackState(true, currentTime, duration);
    
    if (this.hasFunscript()) {
      this.startHapticLoop();
      this.setStatus('Playing with haptics');
    } else {
      this.setStatus('Playing media');
    }
  }

  handleMediaPause = async () => {
    if (this.hasFunscript()) {
      this.stopHapticLoop();
      // ✅ MODIFIÉ: Utilise la propriété computed + gestion d'erreur
      if (this.buttplug) {
        try {
          await this.buttplug.stopAll();
        } catch (error) {
          console.warn('Failed to stop devices:', error);
        }
      }
    }
    
    const currentTime = this.mediaPlayerRef.current?.getTime() || 0;
    const duration = this.mediaPlayerRef.current?.getDuration() || 0;
    
    // ✅ NOUVEAU: Synchroniser avec PlaylistManager
    this.playlist.updatePlaybackState(false, currentTime, duration);
    
    this.setState({ currentActuatorData: new Map() });
    this.setStatus('Paused');
  }

  handleMediaEnd = async () => {
    if (this.hasFunscript()) {
      this.stopHapticLoop();
      // ✅ MODIFIÉ: Utilise la propriété computed + gestion d'erreur
      if (this.buttplug) {
        try {
          await this.buttplug.stopAll();
        } catch (error) {
          console.warn('Failed to stop devices:', error);
        }
      }
    }
    
    // ✅ NOUVEAU: Synchroniser avec PlaylistManager
    this.playlist.updatePlaybackState(false, 0, 0);
    
    this.hapticTime = 0;
    this.lastMediaTime = 0;
    this.setState({ currentActuatorData: new Map() });
    this.setStatus('Item ended');
  }

  handleMediaTimeUpdate = ({ currentTime }) => {
    if (!this.hasFunscript() || !this.hapticIntervalId) {
      return;
    }
    
    const now = performance.now();
    const timeSinceLastSync = (now - this.lastSyncTime) / 1000;
    
    const drift = Math.abs(currentTime - this.hapticTime);
    const shouldResync = drift > 0.05 || timeSinceLastSync > 1.0;
    
    if (shouldResync) {
      this.hapticTime = currentTime;
      this.lastMediaTime = currentTime;
      this.lastSyncTime = now;
      
      if (drift > 0.1) {
        console.warn(`Haptic drift detected: ${(drift * 1000).toFixed(1)}ms, resyncing`);
      }
    }

    // ✅ NOUVEAU: Synchronisation périodique avec PlaylistManager (throttled)
    const duration = this.mediaPlayerRef.current?.getDuration() || 0;
    this.playlist.updatePlaybackState(true, currentTime, duration);
  }

  // ============================================================================
  // HAPTIC LOOP - ✅ MODIFIÉ: Utilise les propriétés computed
  // ============================================================================

  processHapticFrame = async (timeDelta) => {
    const mediaPlayer = this.mediaPlayerRef.current;
    
    // ✅ MODIFIÉ: Utilise les propriétés computed
    if (!mediaPlayer || !this.funscript) return;
    
    this.hapticTime += timeDelta;
    const currentTime = this.hapticTime;
    
    const mediaRefreshRate = this.getMediaRefreshRate(mediaPlayer);
    const adjustedDuration = this.calculateLinearDuration(timeDelta, mediaRefreshRate);
    
    const actuatorCommands = this.funscript.interpolateToActuators(currentTime);
    const visualizerData = new Map();
    
    for (const [actuatorIndex, value] of Object.entries(actuatorCommands)) {
      const index = parseInt(actuatorIndex);
      
      let actuatorType = 'linear';
      
      // ✅ MODIFIÉ: Utilise la propriété computed + gestion d'erreur
      if (this.buttplug && this.buttplug.getSelected()) {
        actuatorType = this.buttplug.getActuatorType(index) || 'linear';
        await this.sendHapticCommand(actuatorType, value, adjustedDuration * 1000, index);
      }
      
      visualizerData.set(index, {
        value: value,
        type: actuatorType
      });
    }
    
    this.setState({ currentActuatorData: visualizerData });
  }

  sendHapticCommand = async (type, value, duration, actuatorIndex) => {
    // ✅ MODIFIÉ: Utilise la propriété computed + gestion d'erreur robuste
    if (!this.buttplug || !this.buttplug.isConnected) return;

    try {
      switch (type) {
        case 'vibrate':
          await this.buttplug.vibrate(value, actuatorIndex);
          break;
        case 'oscillate':
          await this.buttplug.oscillate(value, actuatorIndex);
          break;
        case 'linear':
          await this.buttplug.linear(value, duration, actuatorIndex);
          break;
        case 'rotate':
          await this.buttplug.rotate(value, actuatorIndex);
          break;
        default:
          console.warn(`Unknown haptic command type: ${type}`);
          break;
      }
    } catch (error) {
      // Silent fail pour les commandes haptiques (évite spam console)
    }
  }

  // ============================================================================
  // UTILITY METHODS - ✅ MODIFIÉ: Utilise les propriétés computed
  // ============================================================================

  hasFunscript = () => {
    return this.funscript && this.funscript.getChannels().length > 0;
  }

  handleHapticSettingsChange = (channel, action, data) => {
    switch (action) {
      case 'autoMap':
        this.setStatus(`Auto-mapped ${data.mapped}/${data.total} channels to ${data.mode}`);
        break;
      case 'globalOffset':
        this.setStatus(`Global offset set to ${data}s`);
        break;
      case 'setOptions':
        if (channel) {
          this.setStatus(`Updated ${channel} settings`);
        }
        break;
      default:
        if (channel && action) {
          this.setStatus(`Updated ${channel}: ${action}`);
        }
    }
  }

  // ============================================================================
  // RENDER METHODS - ✅ MODIFIÉ: Debug info utilise les propriétés computed
  // ============================================================================

  renderDebugInfo() {
    if (!this.state.showDebug) return null;
    
    // ✅ MODIFIÉ: Utilise les propriétés computed
    const funscriptInfo = this.funscript?.getDebugInfo() || { loaded: false };
    const buttplugStatus = this.buttplug?.getStatus() || { isConnected: false };
    const playlistInfo = this.playlist.getPlaylistInfo(); // ✅ PlaylistManager
    const { updateRate, currentActuatorData } = this.state;
    
    const safeActuatorData = currentActuatorData || new Map();
    
    return (
      <div className="fp-block fp-block-standalone debug-info">
        <div className="fp-section debug-content">
          
          {/* ✅ MODIFIÉ: Utilise PlaylistManager */}
          {playlistInfo.totalItems > 0 && (
            <div className="playlist-info fp-mb-sm">
              <h4 className="fp-title">Playlist:</h4>
              <p>Items: {playlistInfo.totalItems}</p>
              <p>Current: {playlistInfo.currentIndex + 1}</p>
              {playlistInfo.currentIndex >= 0 && (
                <p>Title: {this.playlist.getCurrentItem()?.name || 'Untitled'}</p>
              )}
              <p>Playing: {playlistInfo.isPlaying ? 'Yes' : 'No'}</p>
              <p>Time: {playlistInfo.currentTime.toFixed(1)}s / {playlistInfo.duration.toFixed(1)}s</p>
            </div>
          )}
          
          {this.hasFunscript() && (
            <div className="performance-info fp-mb-sm">
              <h4 className="fp-title">Performance:</h4>
              <p>Update Rate: {updateRate}Hz</p>
              <p>Frame Time: {(1000/updateRate).toFixed(1)}ms</p>
              <p>Active Actuators: {safeActuatorData.size}</p>
            </div>
          )}
          
          <div className="funscript-info fp-mb-sm">
            <h4 className="fp-title">Funscript:</h4>
            {funscriptInfo && funscriptInfo.loaded ? (
              <>
                <p>Channels: {funscriptInfo.channels ? Object.keys(funscriptInfo.channels).length : 0}</p>
                <p>Duration: {typeof funscriptInfo.duration === 'number' ? funscriptInfo.duration.toFixed(2) : 0}s</p>
                {funscriptInfo.globalOffset !== undefined && (
                  <p>Global Offset: {funscriptInfo.globalOffset.toFixed(3)}s</p>
                )}
              </>
            ) : (
              <p>❌ No funscript loaded</p>
            )}
          </div>
          
          {this.hasFunscript() && buttplugStatus && (
            <div className="device-info fp-mb-sm">
              <h4 className="fp-title">Device:</h4>
              <p>Connected: {buttplugStatus.isConnected ? 'Yes' : 'No'}</p>
              <p>Device Count: {buttplugStatus.deviceCount || 0}</p>
              {buttplugStatus.selectedDevice && (
                <p>Selected: {buttplugStatus.selectedDevice.name}</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // AUTRES MÉTHODES INCHANGÉES
  // ============================================================================

  startHapticLoop = () => {
    if (this.hapticIntervalId) return;
    
    this.expectedHapticTime = performance.now();
    const targetInterval = 1000 / this.state.updateRate;
    
    const optimizedLoop = () => {
      try {
        const currentTime = performance.now();
        const drift = currentTime - this.expectedHapticTime;
        
        const hapticDelta = targetInterval / 1000;
        this.processHapticFrame(hapticDelta);
        
        this.expectedHapticTime += targetInterval;
        const adjustedDelay = Math.max(0, targetInterval - drift);
        
        const currentTargetInterval = 1000 / this.state.updateRate;
        if (currentTargetInterval !== targetInterval) {
          this.expectedHapticTime = currentTime + currentTargetInterval;
          this.hapticIntervalId = setTimeout(() => this.restartWithNewRate(), currentTargetInterval);
        } else {
          this.hapticIntervalId = setTimeout(optimizedLoop, adjustedDelay);
        }
        
      } catch (error) {
        console.error('Haptic loop error:', error);
        this.hapticIntervalId = setTimeout(optimizedLoop, targetInterval);
      }
    };
    
    this.hapticIntervalId = setTimeout(optimizedLoop, targetInterval);
  }

  stopHapticLoop = () => {
    if (this.hapticIntervalId) {
      clearTimeout(this.hapticIntervalId);
      this.hapticIntervalId = null;
    }
    this.expectedHapticTime = 0;
    this.lastSyncTime = 0;
  }

  restartWithNewRate = () => {
    const wasPlaying = this.hapticIntervalId !== null;
    if (wasPlaying) {
      this.stopHapticLoop();
      this.startHapticLoop();
    }
  }

  getMediaRefreshRate = (mediaPlayer) => {
    const state = mediaPlayer.getState();
    const mediaType = state.mediaType;
    
    switch (mediaType) {
      case 'playlist':
        const currentItem = mediaPlayer.getCurrentItem();
        if (!currentItem || !currentItem.sources || currentItem.sources.length === 0) {
          return this.state.updateRate;
        }
        const mimeType = currentItem.sources[0].type || '';
        return mimeType.startsWith('audio/') ? this.state.updateRate : 30;
      case 'media':
        return 30;
      default:
        return this.state.updateRate;
    }
  }

  calculateLinearDuration = (hapticDelta, mediaRefreshRate) => {
    const mediaFrameDuration = 1 / mediaRefreshRate;
    const safeDuration = Math.max(hapticDelta, mediaFrameDuration) * 1.2;
    return Math.max(0.01, Math.min(0.1, safeDuration));
  }

  getUpdateRate = () => this.state.updateRate

  handleUpdateRateChange = (newRate) => {
    this.setState({ updateRate: newRate });
    this.setStatus(`Update rate changed to ${newRate}Hz`);
  }

  triggerResize = () => this.props.onResize?.()

  handleToggleVisualizer = () => {
    this.setState({ showVisualizer: !this.state.showVisualizer }, () => {
      this.triggerResize();
    });
  }

  handleToggleDebug = () => {
    this.setState({ showDebug: !this.state.showDebug }, () => {
      this.triggerResize();
    });
  }

  setStatus = (message) => this.setState({ status: message, error: null })
  
  setError = (message, error = null) => {
    console.error(message, error);
    this.setState({ 
      status: message, 
      error: error?.message || String(error) || null 
    });
  }

  applyTheme = () => {
    const { theme } = this.props;
    if (!theme) return;

    const element = document.querySelector('.fun-player') || 
                   document.documentElement;

    Object.entries(theme).forEach(([key, value]) => {
      const cssVar = this.convertToCssVar(key);
      element.style.setProperty(cssVar, value);
    });

    if (theme.base) {
      element.setAttribute('data-theme', theme.base);
    }
  }

  convertToCssVar = (key) => {
    const mappings = {
      'primaryColor': '--primary-color',
      'backgroundColor': '--background-color',
      'secondaryBackgroundColor': '--secondary-background-color', 
      'textColor': '--text-color',
      'borderColor': '--border-color',
      'fontFamily': '--font-family',
      'baseRadius': '--base-radius',
      'spacing': '--spacing'
    };
    
    return mappings[key] || `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
  }

  renderHapticSettings() {
    return (
      <div className="fp-block fp-block-first haptic-settings-section">
        <HapticSettingsComponent 
          onUpdateRateChange={this.handleUpdateRateChange}
          onGetUpdateRate={this.getUpdateRate}
          onSettingsChange={this.handleHapticSettingsChange}
          onStatusChange={this.setStatus}
          onResize={this.triggerResize}
        />
      </div>
    );
  }

  renderMediaPlayer() {
    // ✅ MODIFIÉ: Utilise PlaylistManager au lieu du state
    const playlistItems = this.playlist.getItems();
    
    return (
      <div className="fp-block fp-block-middle media-section">
        <MediaPlayer
          ref={this.mediaPlayerRef}
          onPlay={this.handleMediaPlay}
          onPause={this.handleMediaPause}
          onEnd={this.handleMediaEnd}
          onTimeUpdate={this.handleMediaTimeUpdate}
          onLoadEnd={this.handleMediaLoadEnd}
          onError={this.handleMediaError}
        />
      </div>
    );
  }

  renderHapticVisualizer() {
    if (!this.state.showVisualizer) return null;
    
    const { isPlaying } = this.state;
    
    return (
      <div className="fp-block fp-block-middle haptic-visualizer-section">
        <HapticVisualizerComponent
          getCurrentActuatorData={() => this.state.currentActuatorData}
          isPlaying={isPlaying}
          onResize={this.triggerResize}
        />
      </div>
    );
  }

  renderStatusBar() {
    const { status, error, isReady, showVisualizer, showDebug } = this.state;
    
    // ✅ MODIFIÉ: Utilise PlaylistManager au lieu du state
    const playlistInfo = this.playlist.getPlaylistInfo();
    
    return (
      <div className="fp-block fp-block-last status-bar-section">
        <div className="fp-section-compact fp-layout-horizontal">
          <div className="fp-layout-row">
            <span className={`fp-status-dot ${isReady ? 'ready' : 'loading'}`}>
              {isReady ? '✅' : '⏳'}
            </span>
            <span className="fp-label">
              {error ? `❌ ${error}` : status}
            </span>
          </div>
          
          <div className="fp-layout-row fp-layout-compact">
            <span className="fp-badge">
              {this.state.updateRate}Hz
            </span>
            
            {playlistInfo.totalItems > 1 && (
              <span className="fp-unit">
                {playlistInfo.currentIndex + 1}/{playlistInfo.totalItems}
              </span>
            )}
            
            {this.hasFunscript() && (
              <span className="fp-unit">
                {this.funscript.getChannels().length} channels
              </span>
            )}
            
            <button 
              className="fp-btn fp-btn-ghost fp-chevron"
              onClick={this.handleToggleVisualizer}
              title={showVisualizer ? "Hide Visualizer" : "Show Visualizer"}
            >
              {showVisualizer ? '📊' : '📈'}
            </button>
            
            <button 
              className="fp-btn fp-btn-ghost fp-chevron"
              onClick={this.handleToggleDebug}
              title={showDebug ? "Hide Debug" : "Show Debug"}
            >
              {showDebug ? '🐛' : '🔍'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  render() {
    // ✅ MODIFIÉ: Utilise PlaylistManager au lieu du state
    const playlistInfo = this.playlist.getPlaylistInfo();
    const playlistItems = this.playlist.getItems();
    
    return (
      <div className="fun-player">
        
        <div className="fp-main-column">
          {this.renderHapticSettings()}
          {this.renderMediaPlayer()}
          {this.renderHapticVisualizer()}
          {this.renderDebugInfo()}
          {this.renderStatusBar()}
        </div>
        
        {playlistItems.length > 1 && (
          <PlaylistComponent/>
        )}
        
      </div>
    );
  }
}

export default FunPlayer;