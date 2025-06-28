import React, { Component } from 'react';
import MediaPlayer from './MediaPlayer';
import PlaylistComponent from './PlaylistComponent';
import HapticSettingsComponent from './HapticSettingsComponent';
import HapticVisualizerComponent from './HapticVisualizerComponent';
import LoggingComponent from './LoggingComponent';
import core from './FunPlayerCore';

/**
 * FunPlayer - ✅ REFACTORISÉ: Status notifications uniformisées + callback MediaPlayer
 */
class FunPlayer extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      updateRate: 60,
      isPlaying: false,
      currentActuatorData: new Map(),
      showVisualizer: true,
      showDebug: false,
      renderTrigger: 0
    };
    
    this.mediaPlayerRef = React.createRef();
    
    // Haptic loop technique (performance pure)
    this.hapticIntervalId = null;
    this.expectedHapticTime = 0;
    this.hapticTime = 0;
    this.lastMediaTime = 0;
    this.lastSyncTime = 0;

    // ✅ MODIFIÉ: État buffering 
    this.isBuffering = false;
    this.bufferingStartTime = 0;
    this.bufferingSource = null; // 'waiting' | 'stall_detection' | null
    this.stallTimeoutId = null;
    this.stallTimeout = 5000; // 5s pour détecter un player figé
    this.isHapticAborted = false; // Flag d'abandon définitif
    
    // Event listener cleanup
    this.coreListener = null;
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  componentDidMount() {
    this.applyTheme();
    this.initializeComponent();
  }

  // ✅ Dans FunPlayer.jsx
  componentDidUpdate(prevProps) {
    if (prevProps.theme !== this.props.theme) {
      this.applyTheme();
    }
    
    // ✅ Test de référence simple et ultra-performant
    if (prevProps.playlist === this.props.playlist) return;
    
    // ✅ Si on arrive ici, le contenu a vraiment changé
    this.handlePlaylistUpdate();
  }

  componentWillUnmount() {
    this.stopHapticLoop();
    
    // ✅ NOUVEAU: Cleanup timeout stall
    if (this.stallTimeoutId) {
      clearTimeout(this.stallTimeoutId);
      this.stallTimeoutId = null;
    }
    
    if (this.coreListener) {
      this.coreListener();
    }
  }

  initializeComponent = () => {
    try {
      core.notify?.('status:funplayer', { message: 'Initializing FunPlayer component...', type: 'processing' });
      
      this.coreListener = core.addListener(this.handleEvent);
      
      if (this.props.playlist) {
        this.handlePlaylistUpdate();
      }
      
      core.notify?.('status:funplayer', { message: 'FunPlayer component initialized', type: 'success' });
      
    } catch (error) {
      core.notify?.('status:funplayer', { message: 'FunPlayer initialization failed', type: 'error', error: error.message });
    }
  }

  handlePlaylistUpdate = async () => {
    const { playlist } = this.props;
    
    core.notify?.('status:funplayer', { message: `Synchronizing playlist: ${playlist?.length || 0} items`, type: 'log' });
    
    await core.playlist.loadPlaylist(playlist);
  }

  // ============================================================================
  // THEME
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

    core.notify?.('status:funplayer', { message: 'Theme applied successfully', type: 'log' });
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
  // GESTION D'ÉVÉNEMENTS
  // ============================================================================

  handleEvent = (event, data) => {
    switch (event) {
      case 'core:ready':
        core.notify('status:funplayer',{message:'Core systems ready', type:'success'});
        this._triggerRender();
        break;
        
      case 'playlist:playbackChanged':
        this.setState({ isPlaying: data.isPlaying });
        break;

      // ✅ AJOUT: Synchroniser MediaPlayer quand PlaylistManager change d'item
      case 'playlist:itemChanged':
        if (this.mediaPlayerRef.current && data.index >= 0) {
          // Vérifier si MediaPlayer n'est pas déjà sur le bon item
          const currentMediaPlayerIndex = this.mediaPlayerRef.current.getPlaylistInfo().currentIndex;
          
          if (currentMediaPlayerIndex !== data.index) {
            core.notify?.('status:funplayer', { 
              message: `Syncing MediaPlayer: ${currentMediaPlayerIndex} → ${data.index}`, 
              type: 'log' 
            });
            
            this.mediaPlayerRef.current.goToPlaylistItem(data.index);
          }
        }
        break;
    }
  }

  _triggerRender = () => {
    this.setState(prevState => ({ 
      renderTrigger: prevState.renderTrigger + 1 
    }));
  }

  // ============================================================================
  // MEDIA PLAYER CALLBACKS
  // ============================================================================

  // Groupe 1: Callbacks haptiques (timing critique)
  handleMediaPlay = ({ currentTime }) => {
    // Timing technique haptique
    this.hapticTime = currentTime || 0;
    this.lastMediaTime = this.hapticTime;
    this.lastSyncTime = performance.now();
    
    const duration = this.mediaPlayerRef.current?.getDuration() || 0;
    
    core.playlist.updatePlaybackState(true, currentTime, duration);
    
    // Démarrage boucle haptique
    if (core.funscript.hasFunscript()) {
      this.startHapticLoop();
      core.notify?.('status:funplayer', { message: `Haptic playback started at ${currentTime.toFixed(1)}s`, type: 'log' });
    }
  }

  handleMediaPause = async ({ currentTime }) => {
    // Arrêt boucle haptique
    if (core.funscript.hasFunscript()) {
      this.stopHapticLoop();
      try {
        await core.buttplug.stopAll();
        core.notify?.('status:funplayer', { message: 'Haptic devices stopped', type: 'log' });
      } catch (error) {
        core.notify?.('status:funplayer', { message: 'Failed to stop haptic devices', type: 'log', error: error.message });
      }
    }
    
    const duration = this.mediaPlayerRef.current?.getDuration() || 0;
    core.playlist.updatePlaybackState(false, currentTime, duration);
    
    this.setState({ currentActuatorData: new Map() });
  }

  handleMediaEnd = async ({ currentTime }) => {
    // Arrêt boucle haptique
    if (core.funscript.hasFunscript()) {
      this.stopHapticLoop();
      try {
        await core.buttplug.stopAll();
        core.notify?.('status:funplayer', { message: 'Haptic playback ended', type: 'log' });
      } catch (error) {
        core.notify?.('status:funplayer', { message: 'Failed to stop haptic devices on end', type: 'log', error: error.message });
      }
    }
    
    core.playlist.updatePlaybackState(false, 0, 0);
    
    this.hapticTime = 0;
    this.lastMediaTime = 0;
    this.setState({ currentActuatorData: new Map() });
  }

  // ✅ MODIFIÉ: Buffering officiel = patience infinie
  handleMediaWaiting = ({ currentTime }) => {
    if (this.isBuffering && this.bufferingSource === 'waiting') {
      // Déjà en buffering officiel
      return;
    }
    
    // Arrêter tout timeout de stall en cours (priorité au buffering officiel)
    if (this.stallTimeoutId) {
      clearTimeout(this.stallTimeoutId);
      this.stallTimeoutId = null;
    }
    
    this._startBuffering('waiting', currentTime);
  }

  // ✅ MODIFIÉ: Sortie de buffering = reset état d'abandon
  handleMediaCanPlay = ({ currentTime }) => {
    if (this.isBuffering) {
      this._endBuffering('canplay', currentTime);
    }
  }

  // ✅ MODIFIÉ: Détection stall conservatrice avec timeout d'abandon
  handleMediaTimeUpdate = ({ currentTime }) => {
    // Si haptique déjà abandonné, ne plus rien faire
    if (this.isHapticAborted) {
      return;
    }
    
    // Synchronisation timing haptique (technique pur)
    if (!core.funscript.hasFunscript() || !this.hapticIntervalId) {
      return;
    }
    
    const now = performance.now();
    const timeSinceLastSync = (now - this.lastSyncTime) / 1000;
    const mediaTimeDelta = currentTime - this.lastMediaTime;
    
    // ✅ Détection stall : 1s+ sans progression ET pas de buffering officiel
    if (timeSinceLastSync > 1.0 && Math.abs(mediaTimeDelta) < 0.01 && !this.isBuffering) {
      core.notify?.('status:funplayer', { message: 'Player stall detected (1s+ frozen), starting timeout', type: 'error' });
      this._startBuffering('stall_detection', currentTime);
      return;
    }
    
    // Synchronisation normale
    const drift = Math.abs(currentTime - this.hapticTime);
    const shouldResync = drift > 0.05 || timeSinceLastSync > 1.0;
    
    if (shouldResync) {
      this.hapticTime = currentTime;
      this.lastMediaTime = currentTime;
      this.lastSyncTime = now;
      
      if (drift > 0.1) {
        core.notify?.('status:funplayer', { message: `Haptic drift detected: ${(drift * 1000).toFixed(1)}ms, resyncing`, type: 'log' });
      }
    }
  }

  handleMediaSeek = ({ currentTime }) => {
    // Sync haptique après seek
    if (core.funscript.hasFunscript() && this.hapticIntervalId) {
      this.hapticTime = currentTime;
      this.lastMediaTime = currentTime;
      this.lastSyncTime = performance.now();
      core.notify?.('status:funplayer', { message: `Haptic synced to ${currentTime.toFixed(1)}s after seek`, type: 'log' });
    }
  }

  // Groupe 2: Callbacks métier
  handleMediaLoadEnd = (data) => {
    core.notify?.('status:funplayer', { message: `Media loaded: ${data.duration.toFixed(1)}s`, type: 'log' });
    
    const currentItem = core.playlist.getCurrentItem();
    if (currentItem && Math.abs((currentItem.duration || 0) - data.duration) > 1) {
      core.notify?.('status:funplayer', { message: `Duration corrected: ${currentItem.duration?.toFixed(1) || 'unknown'}s → ${data.duration.toFixed(1)}s`, type: 'log' });
      core.playlist.updateCurrentItemDuration(data.duration);
    }
    
    this.triggerResize();
  }

  handleMediaError = (error) => {
    core.notify?.('status:funplayer', { message: 'Media loading failed', type: 'error', error: error.message });
    core.setError('Media loading failed', error);
  }

  // Groupe 3: Navigation playlist
  handlePlaylistItemChange = (newVideoJsIndex) => {
    core.notify?.('status:funplayer', { message: `MediaPlayer switched to item ${newVideoJsIndex}`, type: 'log' });
    
    if (newVideoJsIndex >= 0) {
      const currentPlaylistIndex = core.playlist.getCurrentIndex();
      
      if (newVideoJsIndex !== currentPlaylistIndex) {
        core.notify?.('status:funplayer', { message: `Syncing core playlist to Video.js index ${newVideoJsIndex}`, type: 'log' });
        core.playlist.goTo(newVideoJsIndex);
      }
    }
  }

  // ============================================================================
  // ✅ NOUVEAU: Logique buffering intelligente selon source
  // ============================================================================

  _startBuffering = (source, currentTime) => {
    if (this.isBuffering && this.bufferingSource === 'waiting') {
      // Priorité absolue au buffering officiel
      return;
    }
    
    this.isBuffering = true;
    this.bufferingSource = source;
    this.bufferingStartTime = performance.now();
    
    // Suspendre la boucle haptique
    if (this.hapticIntervalId) {
      this.stopHapticLoop();
      try {
        core.buttplug.stopAll();
        core.notify?.('status:funplayer', { message: `Buffering suspended (${source})`, type: 'log' });
      } catch (error) {
        core.notify?.('status:funplayer', { message: 'Failed to stop haptic devices', type: 'log', error: error.message });
      }
    }
    
    this.setState({ currentActuatorData: new Map() });
    
    // ✅ NOUVEAU: Timeout UNIQUEMENT pour stall detection
    if (source === 'stall_detection') {
      this.stallTimeoutId = setTimeout(() => {
        this._abortHapticPlayback();
      }, this.stallTimeout);
      
      core.notify?.('status:funplayer', { message: `Player stall timeout started (${this.stallTimeout}ms)`, type: 'error' });
    }
    // Pour 'waiting' : pas de timeout, patience infinie
  }

  _endBuffering = (trigger, currentTime) => {
    if (!this.isBuffering) return;
    
    const bufferingDuration = performance.now() - this.bufferingStartTime;
    const wasStallDetection = this.bufferingSource === 'stall_detection';
    
    // Clear timeout si stall detection
    if (this.stallTimeoutId) {
      clearTimeout(this.stallTimeoutId);
      this.stallTimeoutId = null;
    }
    
    // Reset état buffering
    this.isBuffering = false;
    this.bufferingSource = null;
    
    // ✅ NOUVEAU: Reset abandon si le player s'est remis
    if (this.isHapticAborted && trigger === 'canplay') {
      this.isHapticAborted = false;
      core.notify?.('status:funplayer', { message: 'Player recovered, haptic playback re-enabled', type: 'success' });
    }
    
    // Reprendre si conditions OK
    const mediaPlayer = this.mediaPlayerRef.current;
    if (mediaPlayer && mediaPlayer.isPlaying() && core.funscript.hasFunscript() && !this.isHapticAborted) {
      // Re-synchroniser proprement
      this.hapticTime = currentTime || mediaPlayer.getTime();
      this.lastMediaTime = this.hapticTime;
      this.lastSyncTime = performance.now();
      
      this.startHapticLoop();
      
      const sourceInfo = wasStallDetection ? ' (stall recovered)' : '';
      core.notify?.('status:funplayer', { message: `Buffering ended via ${trigger} (${bufferingDuration.toFixed(0)}ms)${sourceInfo}, haptic resumed`, type: 'success' });
    }
  }

  // ✅ NOUVEAU: Abandon définitif en cas de player figé
  _abortHapticPlayback = () => {
    const bufferingDuration = performance.now() - this.bufferingStartTime;
    
    // Clear timeout
    if (this.stallTimeoutId) {
      clearTimeout(this.stallTimeoutId);
      this.stallTimeoutId = null;
    }
    
    // Marquer comme abandonné
    this.isHapticAborted = true;
    this.isBuffering = false;
    this.bufferingSource = null;
    
    // Arrêt définitif de la boucle haptique
    this.stopHapticLoop();
    try {
      core.buttplug.stopAll();
    } catch (error) {
      // Silent fail
    }
    
    // ✅ Tentative de réveil du player
    const mediaPlayer = this.mediaPlayerRef.current;
    if (mediaPlayer) {
      try {
        mediaPlayer.pause();
        core.notify?.('status:funplayer', { message: 'Sent pause command to unresponsive player', type: 'log' });
      } catch (error) {
        core.notify?.('status:funplayer', { message: 'Failed to send pause to player', type: 'log', error: error.message });
      }
    }
    
    this.setState({ currentActuatorData: new Map() });
    
    // Status d'erreur final
    core.notify?.('status:funplayer', { 
      message: `Media playing aborted due to unresponsive player (${bufferingDuration.toFixed(0)}ms stall)`, 
      type: 'error' 
    });
  }

  // ============================================================================
  // HAPTIC LOOP
  // ============================================================================

  processHapticFrame = async (timeDelta) => {
    const mediaPlayer = this.mediaPlayerRef.current;
    
    if (!mediaPlayer) return;
    
    // ✅ NOUVEAU: Ne pas traiter si abandonné ou buffering
    if (this.isHapticAborted || this.isBuffering) {
      return;
    }
    
    // Calculs de timing spécifiques à FunPlayer
    this.hapticTime += timeDelta;
    const currentTime = this.hapticTime;
    
    const mediaRefreshRate = this.getMediaRefreshRate(mediaPlayer);
    const adjustedDuration = this.calculateLinearDuration(timeDelta, mediaRefreshRate);
    
    // Orchestration haptique via core
    const visualizerData = await core.processHapticFrame(currentTime, { 
      duration: adjustedDuration * 1000 
    });
    
    this.setState({ currentActuatorData: visualizerData });
  }

  startHapticLoop = () => {
    if (this.hapticIntervalId) return;
    
    this.expectedHapticTime = performance.now();
    const targetInterval = 1000 / this.state.updateRate;
    
    core.notify?.('status:funplayer', { message: `Starting haptic loop at ${this.state.updateRate}Hz`, type: 'log' });
    
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
        core.notify?.('status:funplayer', { message: 'Haptic loop error', type: 'error', error: error.message });
        this.hapticIntervalId = setTimeout(optimizedLoop, targetInterval);
      }
    };
    
    this.hapticIntervalId = setTimeout(optimizedLoop, targetInterval);
  }

  stopHapticLoop = () => {
    if (this.hapticIntervalId) {
      clearTimeout(this.hapticIntervalId);
      this.hapticIntervalId = null;
      core.notify?.('status:funplayer', { message: 'Haptic loop stopped', type: 'log' });
    }
    this.expectedHapticTime = 0;
    this.lastSyncTime = 0;
  }

  restartWithNewRate = () => {
    const wasPlaying = this.hapticIntervalId !== null;
    if (wasPlaying) {
      core.notify?.('status:funplayer', { message: `Restarting haptic loop with new rate: ${this.state.updateRate}Hz`, type: 'log' });
      this.stopHapticLoop();
      this.startHapticLoop();
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

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
    core.notify?.('status:funplayer', { message: `Update rate changed: ${this.state.updateRate}Hz → ${newRate}Hz`, type: 'log' });
    this.setState({ updateRate: newRate });
  }

  // ============================================================================
  // UI CALLBACKS
  // ============================================================================

  triggerResize = () => this.props.onResize?.()

  handleToggleVisualizer = () => {
    const newState = !this.state.showVisualizer;
    core.notify?.('status:funplayer', { message: `Visualizer ${newState ? 'shown' : 'hidden'}`, type: 'log' });
    this.setState({ showVisualizer: newState }, () => {
      this.triggerResize();
    });
  }

  handleToggleDebug = () => {
    const newState = !this.state.showDebug;
    core.notify?.('status:funplayer', { message: `Debug panel ${newState ? 'shown' : 'hidden'}`, type: 'log' });
    this.setState({ showDebug: newState }, () => {
      this.triggerResize();
    });
  }

  // ============================================================================
  // RENDER METHODS
  // ============================================================================

  renderDebugInfo = () => {
    // Afficher seulement si showDebug est activé ET enableConsoleLogging
    if (!this.state.showDebug) {
      return null;
    }

    return (
      <LoggingComponent 
        onResize={this.triggerResize}
      />
    );
  }

  renderHapticSettings() {
    return (
      <div className="fp-block fp-block-first haptic-settings-section">
        <HapticSettingsComponent 
          onUpdateRateChange={this.handleUpdateRateChange}
          onGetUpdateRate={this.getUpdateRate}
          onResize={this.triggerResize}
        />
      </div>
    );
  }

  renderMediaPlayer() {
    const playlistItems = core.playlist.items;
    
    return (
      <div className="fp-block fp-block-middle media-section">
        <MediaPlayer
          ref={this.mediaPlayerRef}
          
          /* Props pour MediaPlayer autonome */
          playlist={playlistItems}
          notify={core.notify}
          
          /* Callbacks haptiques (timing critique) */
          onPlay={this.handleMediaPlay}
          onPause={this.handleMediaPause}
          onEnd={this.handleMediaEnd}
          onTimeUpdate={this.handleMediaTimeUpdate}
          onSeek={this.handleMediaSeek}
          
          /* ✅ NOUVEAU: Callbacks buffering */
          onWaiting={this.handleMediaWaiting}
          onCanPlay={this.handleMediaCanPlay}
          
          /* Callbacks métier */
          onLoadEnd={this.handleMediaLoadEnd}
          onError={this.handleMediaError}
          
          /* Navigation playlist */
          onPlaylistItemChange={this.handlePlaylistItemChange}
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
    const { showVisualizer, showDebug } = this.state;
    
    const coreStatus = core.getStatus();
    const playlistInfo = core.playlist.getPlaylistInfo();
    
    return (
      <div className="fp-block fp-block-last status-bar-section">
        <div className="fp-section-compact fp-layout-horizontal">
          <div className="fp-layout-row">
            <span className={`fp-status-dot ${coreStatus.isReady ? 'ready' : 'loading'}`}>
              {coreStatus.isReady ? '✅' : '⏳'}
            </span>
            <span className="fp-label">
              {coreStatus.error ? `❌ ${coreStatus.error}` : coreStatus.status}
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
            
            {core.funscript.hasFunscript() && (
              <span className="fp-unit">
                {core.funscript.getChannels().length} channels
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
    const playlistInfo = core.playlist.getPlaylistInfo();
    const playlistItems = core.playlist.items;
    
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