import React, { Component } from 'react';
import MediaPlayer from './MediaPlayer';
import ButtPlugManager from './ButtPlugManager';
import FunscriptManager from './FunscriptManager';
import PlaylistComponent from './PlaylistComponent';
import HapticSettingsComponent from './HapticSettingsComponent';
import HapticVisualizerComponent from './HapticVisualizerComponent';

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
      showVisualizer: false,
      showDebug: false,
      // ✅ NOUVEAU: État playlist simplifié
      currentPlaylistIndex: -1,
      playlistItems: []
    };
    
    // Managers
    this.buttplugRef = React.createRef();
    this.funscriptRef = React.createRef();
    this.mediaPlayerRef = React.createRef();
    
    // Haptic loop
    this.hapticIntervalId = null;
    this.expectedHapticTime = 0;
  }

  componentDidMount() {
    this.applyTheme();
    this.initializeManagers();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.theme !== this.props.theme) {
      this.applyTheme();
    }
    
    // ✅ NOUVEAU: Surveiller les changements de playlist
    if (prevProps.playlist !== this.props.playlist) {
      this.handlePlaylistUpdate();
    }
  }

  componentWillUnmount() {
    this.stopHapticLoop();
    this.cleanup();
  }

  // ============================================================================
  // THEME - INCHANGÉ
  // ============================================================================

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

  // ============================================================================
  // ✅ NOUVEAU: PLAYLIST MANAGEMENT SIMPLIFIÉ
  // ============================================================================

  handlePlaylistUpdate = async () => {
    const { playlist } = this.props;
    
    if (!playlist || playlist.length === 0) {
      this.setState({ 
        playlistItems: [],
        currentPlaylistIndex: -1,
        isReady: true 
      });
      this.setStatus('No playlist loaded');
      return;
    }

    // ✅ NOUVEAU: Valider et normaliser la playlist
    const validItems = playlist.filter(item => 
      item && (item.media || item.funscript || (item.duration && item.duration > 0))
    );

    if (validItems.length === 0) {
      this.setState({ 
        playlistItems: [],
        currentPlaylistIndex: -1,
        isReady: true 
      });
      this.setStatus('No valid items in playlist');
      return;
    }

    this.setStatus(`Enriching playlist with posters...`);

    try {
      // ✅ NOUVEAU: Enrichir la playlist de référence avec les posters
      if (!this.mediaManager) {
        // Créer le MediaManager s'il n'existe pas encore
        const MediaManager = (await import('./MediaManager')).default;
        this.mediaManager = new MediaManager();
      }

      const enrichedItems = await this.mediaManager.enrichPlaylistWithPosters(validItems);

      this.setState({ 
        playlistItems: enrichedItems, // ✅ MODIFIÉ: Stocker la playlist enrichie
        currentPlaylistIndex: -1, // Sera mis à jour par onPlaylistItemChange
        isReady: false 
      });

      this.setStatus(`Playlist loaded: ${enrichedItems.length} items with posters`);
      
    } catch (error) {
      console.error('Failed to enrich playlist with posters:', error);
      // Fallback: utiliser la playlist sans posters
      this.setState({ 
        playlistItems: validItems,
        currentPlaylistIndex: -1,
        isReady: false 
      });
      this.setStatus(`Playlist loaded: ${validItems.length} items (no posters)`);
    }
  }

  // ✅ NOUVEAU: Callback unifié pour les changements d'item playlist
  handlePlaylistItemChange = async (vjsItem, index) => {
    console.log('FunPlayer: Playlist item changed to', index, vjsItem);
    
    // ✅ MODIFIÉ: Mettre à jour l'index IMMÉDIATEMENT
    this.setState({ 
      currentPlaylistIndex: index,
      isPlaying: false, 
      currentActuatorData: new Map(),
      isReady: false 
    });
    
    // ✅ NOUVEAU: Arrêter l'haptique pendant la transition
    this.stopHapticLoop();
    if (this.buttplugRef.current) {
      await this.buttplugRef.current.stopAll();
    }
    
    if (!vjsItem || index === -1) {
      this.setStatus('No valid item to play');
      this.setState({ isReady: true });
      return;
    }
    
    this.setStatus(`Loading item ${index + 1}...`);

    try {
      // ✅ NOUVEAU: Charger le funscript de l'item actuel
      if (vjsItem.funscript) {
        if (typeof vjsItem.funscript === 'object') {
          await this.loadFunscriptData(vjsItem.funscript);
        } else {
          await this.loadFunscript(vjsItem.funscript);
        }
      } else {
        // Reset funscript si pas de haptic
        this.funscriptRef.current?.reset();
      }

      this.setState({ isReady: true });
      
      const title = vjsItem.title || `Item ${index + 1}`;
      this.setStatus(`Ready: ${title}`);

    } catch (error) {
      this.setError(`Failed to load item ${index + 1}`, error);
    }
  }

  // ============================================================================
  // INITIALIZATION - ✅ SIMPLIFIÉ
  // ============================================================================

  initializeManagers = async () => {
    try {
      console.log('Initializing managers...');
      
      this.buttplugRef.current = new ButtPlugManager();
      if (this.buttplugRef.current && typeof this.buttplugRef.current.init === 'function') {
        await this.buttplugRef.current.init();
        console.log('ButtPlugManager initialized');
      }
      
      this.funscriptRef.current = new FunscriptManager();
      console.log('FunscriptManager created:', this.funscriptRef.current);
      
      this.setStatus('Managers initialized');
      
      // ✅ NOUVEAU: Traitement initial de la playlist
      this.handlePlaylistUpdate();
      
    } catch (error) {
      console.error('Manager initialization error:', error);
      this.setError('Failed to initialize managers', error);
    }
  }

  // ✅ NOUVEAU: Méthodes de chargement funscript inchangées mais simplifiées
  loadFunscript = async (src) => {
    try {
      console.log('Loading funscript from:', src);
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
      } else if (typeof src === 'object') {
        data = src;
      } else {
        throw new Error('Invalid funscript source type');
      }
      
      console.log('Funscript data loaded:', data);
      
      if (this.funscriptRef.current) {
        this.funscriptRef.current.load(data);
        console.log('Funscript loaded into manager');
        
        // Auto-map automatique après chargement
        const capabilities = this.buttplugRef.current?.getCapabilities();
        const mapResult = this.funscriptRef.current.autoMapChannels(capabilities);
        
        console.log(`Auto-mapped ${mapResult.mapped}/${mapResult.total} channels to ${mapResult.mode}`);
        
      } else {
        throw new Error('FunscriptManager not initialized');
      }
      
    } catch (error) {
      console.error('Failed to load funscript:', error);
      throw error;
    }
  }

  loadFunscriptData = async (data) => {
    try {
      console.log('Loading funscript from data:', data);
      
      if (this.funscriptRef.current) {
        this.funscriptRef.current.load(data);
        console.log('Funscript loaded into manager');
        
        // Auto-map automatique après chargement
        const capabilities = this.buttplugRef.current?.getCapabilities();
        const mapResult = this.funscriptRef.current.autoMapChannels(capabilities);
        
        console.log(`Auto-mapped ${mapResult.mapped}/${mapResult.total} channels to ${mapResult.mode}`);
        
      } else {
        throw new Error('FunscriptManager not initialized');
      }
      
    } catch (error) {
      console.error('Failed to load funscript data:', error);
      throw error;
    }
  }

  // ============================================================================
  // MEDIA PLAYER EVENTS - ✅ SIMPLIFIÉ (plus de gestion manuelle des transitions)
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
    
    this.setState({ isPlaying: true });
    
    if (this.hasFunscript()) {
      this.startHapticLoop();
      this.setStatus('Playing with haptics');
    } else {
      this.setStatus('Playing media');
    }
  }

  handleMediaPause = () => {
    if (this.hasFunscript()) {
      this.stopHapticLoop();
      this.buttplugRef.current?.stopAll();
    }
    
    this.setState({ isPlaying: false, currentActuatorData: new Map() });
    this.setStatus('Paused');
  }

  handleMediaEnd = () => {
    if (this.hasFunscript()) {
      this.stopHapticLoop();
      this.buttplugRef.current?.stopAll();
    }
    
    this.hapticTime = 0;
    this.lastMediaTime = 0;
    this.setState({ isPlaying: false, currentActuatorData: new Map() });
    
    // ✅ MODIFIÉ: En mode playlist, Video.js gère automatiquement l'auto-advance
    // On se contente de notifier la fin de l'item actuel
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
  }

  // ============================================================================
  // HAPTIC LOOP - INCHANGÉ
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

  restartWithNewRate = () => {
    const wasPlaying = this.hapticIntervalId !== null;
    if (wasPlaying) {
      this.stopHapticLoop();
      this.startHapticLoop();
    }
  }

  handleUpdateRateChange = (newRate) => {
    this.setState({ updateRate: newRate });
    this.setStatus(`Update rate changed to ${newRate}Hz`);
  }

  processHapticFrame = (timeDelta) => {
    const mediaPlayer = this.mediaPlayerRef.current;
    const funscriptManager = this.funscriptRef.current;
    const buttplugManager = this.buttplugRef.current;
    
    if (!mediaPlayer || !funscriptManager) return;
    
    this.hapticTime += timeDelta;
    const currentTime = this.hapticTime;
    
    const mediaRefreshRate = this.getMediaRefreshRate(mediaPlayer);
    const adjustedDuration = this.calculateLinearDuration(timeDelta, mediaRefreshRate);
    
    const actuatorCommands = funscriptManager.interpolateToActuators(currentTime);
    const visualizerData = new Map();
    
    for (const [actuatorIndex, value] of Object.entries(actuatorCommands)) {
      const index = parseInt(actuatorIndex);
      
      let actuatorType = 'linear';
      
      if (buttplugManager && buttplugManager.getSelected()) {
        actuatorType = buttplugManager.getActuatorType(index) || 'linear';
        this.sendHapticCommand(actuatorType, value, adjustedDuration * 1000, index);
      }
      
      visualizerData.set(index, {
        value: value,
        type: actuatorType
      });
    }
    
    this.setState({ currentActuatorData: visualizerData });
  }

  getMediaRefreshRate = (mediaPlayer) => {
    const state = mediaPlayer.getState();
    const mediaType = state.mediaType;
    
    switch (mediaType) {
      case 'playlist':
        // En mode playlist, on se base sur le contenu de l'item actuel
        const currentItem = mediaPlayer.getCurrentItem();
        if (!currentItem || !currentItem.sources || currentItem.sources.length === 0) {
          return this.state.updateRate; // Fallback timeline mode
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

  sendHapticCommand = async (type, value, duration, actuatorIndex) => {
    const buttplugManager = this.buttplugRef.current;
    
    if (!buttplugManager || !buttplugManager.isConnected) return;

    try {
      switch (type) {
        case 'vibrate':
          await buttplugManager.vibrate(value, actuatorIndex);
          break;
        case 'oscillate':
          await buttplugManager.oscillate(value, actuatorIndex);
          break;
        case 'linear':
          await buttplugManager.linear(value, duration, actuatorIndex);
          break;
        case 'rotate':
          await buttplugManager.rotate(value, actuatorIndex);
          break;
        default:
          console.warn(`Unknown haptic command type: ${type}`);
          break;
      }
    } catch (error) {
      // Silent fail for haptic commands
    }
  }

  stopHapticLoop = () => {
    if (this.hapticIntervalId) {
      clearTimeout(this.hapticIntervalId);
      this.hapticIntervalId = null;
    }
    this.expectedHapticTime = 0;
    this.lastSyncTime = 0;
  }

  // ============================================================================
  // STATUS MANAGEMENT - INCHANGÉ
  // ============================================================================

  setStatus = (message) => {
    this.setState({ status: message, error: null });
  }

  setError = (message, error = null) => {
    console.error(message, error);
    
    let errorMessage = null;
    if (error) {
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }
    }
    
    this.setState({ 
      status: message, 
      error: errorMessage 
    });
  }

  // ============================================================================
  // HAPTIC SETTINGS HANDLERS - INCHANGÉ
  // ============================================================================

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
  // UTILITY METHODS - INCHANGÉ
  // ============================================================================

  triggerResize = () => {
    if (this.props.onResize) {
      this.props.onResize();
    }
  }

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

  hasFunscript = () => {
    return this.funscriptRef.current && this.funscriptRef.current.getChannels().length > 0;
  }

  cleanup = async () => {
    this.stopHapticLoop();
    
    if (this.buttplugRef.current) {
      await this.buttplugRef.current.cleanup();
    }
    
    if (this.funscriptRef.current) {
      this.funscriptRef.current.reset();
    }
    
    this.setState({
      isPlaying: false,
      currentActuatorData: new Map(),
      status: 'Cleaned up',
      error: null
    });
  }

  // ============================================================================
  // RENDER METHODS - ✅ MODIFIÉ pour passer la playlist au MediaPlayer
  // ============================================================================

  renderHapticSettings() {
    return (
      <div className="fp-block fp-block-first haptic-settings-section">
        <HapticSettingsComponent 
          buttplugManagerRef={this.buttplugRef}
          funscriptManagerRef={this.funscriptRef}
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
    const { playlistItems } = this.state;
    
    return (
      <div className="fp-block fp-block-middle media-section">
        <MediaPlayer
          ref={this.mediaPlayerRef}
          playlist={playlistItems}  // ✅ MODIFIÉ: Passer la playlist au lieu de src individuel
          onPlaylistItemChange={this.handlePlaylistItemChange}  // ✅ NOUVEAU: Callback unifié
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
    const { status, error, isReady, showVisualizer, showDebug, currentPlaylistIndex, playlistItems } = this.state;
    
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
            
            {/* ✅ NOUVEAU: Affichage playlist info */}
            {playlistItems.length > 1 && (
              <span className="fp-unit">
                {currentPlaylistIndex + 1}/{playlistItems.length}
              </span>
            )}
            
            {this.hasFunscript() && (
              <span className="fp-unit">
                {this.funscriptRef.current.getChannels().length} channels
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

  renderDebugInfo() {
    if (!this.state.showDebug) return null;
    
    const funscriptInfo = this.funscriptRef.current?.getDebugInfo();
    const deviceInfo = this.buttplugRef.current?.getSelected();
    const { updateRate, currentActuatorData, playlistItems, currentPlaylistIndex } = this.state;
    
    const safeActuatorData = currentActuatorData || new Map();
    
    return (
      <div className="fp-block fp-block-standalone debug-info">
        <div className="fp-section debug-content">
          {/* ✅ NOUVEAU: Info playlist */}
          {playlistItems.length > 0 && (
            <div className="playlist-info fp-mb-sm">
              <h4 className="fp-title">Playlist:</h4>
              <p>Items: {playlistItems.length}</p>
              <p>Current: {currentPlaylistIndex + 1}</p>
              {playlistItems[currentPlaylistIndex] && (
                <p>Title: {playlistItems[currentPlaylistIndex].title || 'Untitled'}</p>
              )}
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
          
          {this.hasFunscript() && deviceInfo && (
            <div className="device-info fp-mb-sm">
              <h4 className="fp-title">Device:</h4>
              <p>Name: {deviceInfo.name || 'Unknown'}</p>
              <p>Index: {typeof deviceInfo.index === 'number' ? deviceInfo.index : 'N/A'}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  getUpdateRate = () => {
    return this.state.updateRate;
  }

  // ============================================================================
  // RENDER PRINCIPAL - ✅ MODIFIÉ: PlaylistComponent réintégré comme UI pure
  // ============================================================================

  render() {
    const { playlistItems, currentPlaylistIndex } = this.state;
    
    return (
      <div className="fun-player">
        
        {/* Colonne principale */}
        <div className="fp-main-column">
          {this.renderHapticSettings()}
          {this.renderMediaPlayer()}
          {this.renderHapticVisualizer()}
          {this.renderDebugInfo()}
          {this.renderStatusBar()}
        </div>
        
        {/* ✅ MODIFIÉ: PlaylistComponent avec props optimisées */}
        {playlistItems.length > 1 && (
          <PlaylistComponent
            playlist={playlistItems}
            currentIndex={currentPlaylistIndex}
            mediaPlayerRef={this.mediaPlayerRef}
          />
        )}
        
      </div>
    );
  }
}

export default FunPlayer;