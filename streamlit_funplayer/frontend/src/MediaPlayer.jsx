import React, { Component } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import managers from './Managers'; // ✅ SEULE IMPORT du singleton

// ✅ Import conditionnel pour éviter les Feature Policy warnings
let videojsVR = null;
let videojsPlaylist = null;

const loadVRPlugin = async () => {
  if (!videojsVR) {
    try {
      videojsVR = await import('videojs-vr/dist/videojs-vr');
      await import('videojs-vr/dist/videojs-vr.css');
      console.log('MediaPlayer: VR plugin loaded');
    } catch (error) {
      console.warn('MediaPlayer: VR plugin not available:', error.message);
    }
  }
  return videojsVR;
};

const loadPlaylistPlugin = async () => {
  if (!videojsPlaylist) {
    try {
      videojsPlaylist = await import('videojs-playlist');
      console.log('MediaPlayer: Playlist plugin loaded');
    } catch (error) {
      console.warn('MediaPlayer: Playlist plugin not available:', error.message);
    }
  }
  return videojsPlaylist;
};

/**
 * MediaPlayer - ✅ REFACTORISÉ: API Managers unifiée
 * Plus aucune référence locale aux managers, tout passe par le singleton
 */
class MediaPlayer extends Component {

  constructor(props) {
    super(props);
    this.videoRef = React.createRef();
    this.player = null;
    this.isPlayerReady = false;
    this.initRetries = 0;
    this.maxRetries = 3;

    // ✅ SIMPLIFIÉ: State minimal pour re-render pattern
    this.state = {
      renderTrigger: 0
    };

    // ✅ SIMPLIFIÉ: Flags de contrôle (pas dans state car pas pour UI)
    this.isInitialized = false;
    this.isInitializing = false;
    this.isDestroyed = false;
    
    // ✅ SUPPRIMÉ: Plus de référence locale PlaylistManager
    // this.playlistManager = managers.getPlaylist(); // ❌
    
    this.managersListener = null;
  }

  // ============================================================================
  // ✅ LIFECYCLE AVEC API MANAGERS UNIFIÉE
  // ============================================================================

  componentDidMount() {
    this.isDestroyed = false;
    this.isInitialized = false;
    this.isInitializing = false;
    
    // ✅ Écouter les événements managers
    this.managersListener = managers.addListener(this.handleManagerEvent);
    
    const hasContent = this._hasValidPlaylist();
    
    if (hasContent && !this.isInitialized && !this.isInitializing) {
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.initPlayer();
        }
      }, 50);
    }
  }

  componentDidUpdate(prevProps) {
    if (this.isDestroyed) return;
    
    // ✅ SIMPLE: Juste l'initialisation si pas encore fait
    const hasContent = this._hasValidPlaylist();
    
    if (hasContent && !this.isInitialized && !this.isInitializing) {
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.initPlayer();
        }
      }, 50);
    }
  }

  componentWillUnmount() {
    this.isDestroyed = true;
    
    // ✅ Cleanup listener AVANT cleanup
    if (this.managersListener) {
      this.managersListener(); // Unsubscribe
      this.managersListener = null;
    }
    
    // Puis cleanup le reste
    this.cleanup();
  }

  // ============================================================================
  // ✅ GESTION D'ÉVÉNEMENTS AVEC API MANAGERS UNIFIÉE
  // ============================================================================

  handleManagerEvent = (event, data) => {
    console.log('🎬 MediaPlayer.handleManagerEvent received:', event, data);
    
    switch (event) {
      case 'playlist:itemChanged':
        console.log('🎬 Processing playlist:itemChanged, target index:', data.index);
        this._syncVideoJsToManagers(data.index);
        this._triggerRender();
        break;
        
      case 'playlist:loaded':
        console.log('🎬 Processing playlist:loaded');
        // ✅ Mettre à jour Video.js quand playlist est chargée
        const items = managers.playlist.getItems();
        if (items.length > 0) {
          this.updatePlaylist();
        }
        this._triggerRender();
        break;
        
      case 'playlist:playbackChanged':
        // Pas de re-render, juste sync d'état
        break;
        
      default:
        //console.log('🎬 MediaPlayer ignoring event:', event);
    }
  }

  // ✅ Synchronise Video.js avec Managers (évite boucles infinies)
  _syncVideoJsToManagers = (targetIndex) => {
    if (!this.player || !this._isPlaylistMode()) return;
    
    const currentVideoJsIndex = this.player.playlist.currentItem();
    
    if (currentVideoJsIndex !== targetIndex) {
      console.log(`MediaPlayer: Syncing Video.js to Managers index ${targetIndex}`);
      // Temporairement désactiver les listeners Video.js pour éviter boucle
      this.player.off('playlistitem', this.handlePlaylistItem);
      
      try {
        this.player.playlist.currentItem(targetIndex);
      } catch (error) {
        console.error('MediaPlayer: Failed to sync Video.js playlist:', error);
      } finally {
        // Réactiver les listeners
        this.player.on('playlistitem', this.handlePlaylistItem);
      }
    }
  }

  // ============================================================================
  // HELPERS - ✅ API MANAGERS UNIFIÉE
  // ============================================================================

  _hasValidPlaylist = () => {
    // ✅ MODIFIÉ: Accès direct via singleton
    const items = managers.playlist?.getItems();
    return items && items.length > 0;
  }

  _triggerRender = () => {
    this.setState(prevState => ({ 
      renderTrigger: prevState.renderTrigger + 1 
    }));
  }

  _isPlaylistMode = () => {
    return this.player && typeof this.player.playlist === 'function' && this.player.playlist().length > 0;
  }

  // ============================================================================
  // PLAYLIST PLUGIN - ✅ HANDLERS INTÉGRÉS API MANAGERS UNIFIÉE
  // ============================================================================

  initPlaylistPlugin = async () => {
    if (!this.player || this.isDestroyed) return;

    try {
      const playlistPlugin = await loadPlaylistPlugin();

      if (!playlistPlugin) {
        console.log('MediaPlayer: Playlist plugin not available, skipping');
        return;
      }

      if (typeof this.player.playlist !== 'function' && playlistPlugin.default) {
        videojs.registerPlugin('playlist', playlistPlugin.default);
      }

      if (typeof this.player.playlist !== 'function') {
        throw new Error('Playlist plugin failed to register');
      }

      // ✅ Setup event listeners avec intégration Managers
      this.player.on('playlistchange', this.handlePlaylistChange);
      this.player.on('playlistitem', this.handlePlaylistItem);
      
    } catch (error) {
      console.error('MediaPlayer: Playlist plugin initialization failed:', error);
      throw error;
    }
  }

  // ✅ Filtrer seulement funscript (API Video.js + funscript)
  filterForVideojs = (playlist) => {
    return playlist.map(item => {
      const { funscript, ...vjsItem } = item;  // Destructuring magic !
      return vjsItem;
    });
  };

  // ✅ MODIFIÉ: API Managers unifiée
  updatePlaylist = async () => {
    if (!this.player || !this.isPlayerReady || typeof this.player.playlist !== 'function') {
      return;
    }

    // ✅ MODIFIÉ: Récupérer depuis Managers singleton
    const playlistItems = managers.playlist.getItems();
    
    if (!playlistItems || playlistItems.length === 0) {
      this.player.playlist([]);
      return;
    }

    try {
      console.log('🎬 MediaPlayer.updatePlaylist called with:', playlistItems.length, 'items');
      
      const vjsPlaylist = this.filterForVideojs(playlistItems);
      this.player.playlist(vjsPlaylist);
      
      if (this.player.playlist.currentItem() === -1) {
        this.player.playlist.currentItem(0);
      }
      
    } catch (error) {
      console.error('MediaPlayer: Error updating playlist:', error);
      this.props.onError?.(error);
    }
  }

  // ============================================================================
  // ✅ PLAYLIST EVENT HANDLERS - INTÉGRATION API MANAGERS UNIFIÉE
  // ============================================================================

  handlePlaylistChange = () => {
    // ✅ Trigger re-render pour mettre à jour les buttons
    this._triggerRender();
  }

  handlePlaylistItem = () => {
    const newVideoJsIndex = this.player.playlist.currentItem();
    
    console.log('MediaPlayer: Video.js playlistitem event:', { newVideoJsIndex });
    
    // ✅ MODIFIÉ: Synchroniser Managers avec Video.js
    if (newVideoJsIndex >= 0) {
      const currentManagersIndex = managers.playlist.getCurrentIndex();
      
      if (newVideoJsIndex !== currentManagersIndex) {
        console.log(`MediaPlayer: Syncing Managers to Video.js index ${newVideoJsIndex}`);
        
        // Utiliser Managers pour changer l'item
        managers.playlist.goTo(newVideoJsIndex);
        // L'événement 'playlist:itemChanged' déclenchera _syncVideoJsToManagers
        // et notifiera FunPlayer via handleManagerEvent
      }
    }
    
    // ✅ Gestion poster simplifiée
    setTimeout(() => {
      const currentItem = this.getCurrentPlaylistItem();
      if (currentItem && currentItem.poster) {
        this.player.poster(currentItem.poster);
      }
    }, 100);
    
    // ✅ SUPPRIMÉ: Plus d'appel direct this.props.onPlaylistItemChange
    // La notification se fait maintenant via Managers → événements → FunPlayer
  }

  // ============================================================================
  // ✅ PLAYLIST PUBLIC API - API MANAGERS UNIFIÉE
  // ============================================================================

  getCurrentPlaylistItem = () => {
    if (!this._isPlaylistMode()) return null;
    const index = this.player.playlist.currentItem();
    const playlist = this.player.playlist();
    return index >= 0 && index < playlist.length ? playlist[index] : null;
  }

  goToPlaylistItem = (index) => {
    // ✅ MODIFIÉ: Utiliser Managers au lieu de Video.js directement
    if (managers.playlist) {
      return managers.playlist.goTo(index);
      // La synchronisation Video.js se fera via handleManagerEvent
    }
    
    // ✅ FALLBACK: Si Managers pas disponible, utiliser Video.js directement
    if (!this._isPlaylistMode()) return false;
    try {
      this.player.playlist.currentItem(index);
      return true;
    } catch (error) {
      console.error('MediaPlayer: Failed to go to playlist item', index, error);
      return false;
    }
  }

  handleNext = () => {
    // ✅ MODIFIÉ: Utiliser Managers
    if (managers.playlist) {
      managers.playlist.next();
    } else if (this._isPlaylistMode()) {
      // Fallback Video.js
      this.player.playlist.next();
    }
  }

  handlePrevious = () => {
    // ✅ MODIFIÉ: Utiliser Managers
    if (managers.playlist) {
      managers.playlist.previous();
    } else if (this._isPlaylistMode()) {
      // Fallback Video.js
      this.player.playlist.previous();
    }
  }

  getPlaylistInfo = () => {
    // ✅ MODIFIÉ: Priorité Managers, fallback Video.js
    if (managers.playlist) {
      return managers.playlist.getPlaylistInfo();
    }
    
    // Fallback Video.js original
    if (!this._isPlaylistMode()) {
      return { hasPlaylist: false, currentIndex: -1, totalItems: 0 };
    }
    
    return {
      hasPlaylist: true,
      currentIndex: this.player.playlist.currentItem(),
      totalItems: this.player.playlist().length,
      // ✅ Noms cohérents avec PlaylistManager
      canGoNext: this.player.playlist.currentItem() < this.player.playlist().length - 1,
      canGoPrevious: this.player.playlist.currentItem() > 0
    };
  }

  // ============================================================================
  // PLAYLIST COMPONENTS REGISTRATION - Inchangé
  // ============================================================================

  registerPlaylistComponents = () => {
    const Button = videojs.getComponent('Button');

    class PreviousButton extends Button {
      constructor(player, options) {
        super(player, options);
        this.controlText('Previous item');
      }

      handleClick() {
        if (this.player().playlist) {
          this.player().playlist.previous();
        }
      }

      createEl() {
        const el = super.createEl('button', {
          className: 'vjs-previous-button vjs-control vjs-button'
        });
        el.innerHTML = '<span aria-hidden="true">⏮</span>';
        el.title = 'Previous item';
        return el;
      }
    }

    class NextButton extends Button {
      constructor(player, options) {
        super(player, options);
        this.controlText('Next item');
      }

      handleClick() {
        if (this.player().playlist) {
          this.player().playlist.next();
        }
      }

      createEl() {
        const el = super.createEl('button', {
          className: 'vjs-next-button vjs-control vjs-button'
        });
        el.innerHTML = '<span aria-hidden="true">⏭</span>';
        el.title = 'Next item';
        return el;
      }
    }

    videojs.registerComponent('PreviousButton', PreviousButton);
    videojs.registerComponent('NextButton', NextButton);
  }

  // ✅ Utilise helper _isPlaylistMode et getPlaylistInfo() intégré
  updatePlaylistButtons = () => {
    if (!this.player) return;

    const controlBar = this.player.getChild('controlBar');
    if (!controlBar) return;

    const prevBtn = controlBar.getChild('PreviousButton');
    const nextBtn = controlBar.getChild('NextButton');
    const playlistInfo = this.getPlaylistInfo();

    console.log('🎬 updatePlaylistButtons - playlistInfo:', playlistInfo);

    if (prevBtn) {
      // ✅ CORRIGÉ: Bon nom de propriété
      prevBtn.el().disabled = !playlistInfo.canPrevious;
      prevBtn.el().style.opacity = playlistInfo.canPrevious ? '1' : '0.3';
      console.log('🎬 Previous button - canPrevious:', playlistInfo.canPrevious, 'disabled:', prevBtn.el().disabled);
    }

    if (nextBtn) {
      // ✅ CORRIGÉ: Bon nom de propriété  
      nextBtn.el().disabled = !playlistInfo.canNext;
      nextBtn.el().style.opacity = playlistInfo.canNext ? '1' : '0.3';
      console.log('🎬 Next button - canNext:', playlistInfo.canNext, 'disabled:', nextBtn.el().disabled);
    }
  }

  // ============================================================================
  // INITIALIZATION - ✅ Gestion d'erreur améliorée
  // ============================================================================

  initPlayer = async () => {
    if (this.isDestroyed || this.isInitialized || this.isInitializing) {
      return;
    }

    if (!this.videoRef?.current) {
      console.error('MediaPlayer: Video element not available');
      return;
    }

    this.isInitializing = true;

    try {
      const videoElement = this.videoRef.current;
      this.registerPlaylistComponents();

      const options = {
        controls: true,
        responsive: true,
        fluid: true,
        playsinline: true,
        preload: 'metadata',
        techOrder: ['html5'],
        html5: {
          vhs: {
            overrideNative: false
          }
        },
        controlBar: {
          children: [
            'playToggle', 'currentTimeDisplay', 'timeDivider', 
            'durationDisplay', 'progressControl', 'PreviousButton', 
            'NextButton', 'volumePanel', 'fullscreenToggle'
          ]
        }
      };

      this.player = videojs(videoElement, options);
      
      if (!this.player) {
        throw new Error('Failed to create Video.js player');
      }

      this.setupBasicCallbacks();

      this.player.ready(() => {
        if (this.isDestroyed) return;

        this.isPlayerReady = true;
        this.isInitialized = true;
        this.isInitializing = false;
        
        this.setupAdvancedCallbacks();
        
        this.initPlugins().then(() => {
          console.log('MediaPlayer: Initialization complete');
          this._triggerRender(); // ✅ Trigger re-render après init
        }).catch((error) => {
          console.error('MediaPlayer: Plugin initialization failed:', error);
          this.props.onError?.(error);
        });
      });

    } catch (error) {
      console.error('MediaPlayer: Failed to initialize Video.js:', error);
      this.isInitializing = false;
      this.props.onError?.(error);
    }
  }

  initPlugins = async () => {
    if (this.isDestroyed || !this.player) return;

    try {
      const [vrResult, playlistResult] = await Promise.allSettled([
        this.initVRPlugin(),
        this.initPlaylistPlugin()
      ]);

      if (vrResult.status === 'rejected') {
        console.warn('MediaPlayer: VR plugin initialization failed:', vrResult.reason);
      }

      if (playlistResult.status === 'rejected') {
        console.warn('MediaPlayer: Playlist plugin initialization failed:', playlistResult.reason);
      }

      // Traiter la playlist initiale si disponible
      if (this._hasValidPlaylist()) {
        await this.updatePlaylist();
      }

    } catch (error) {
      console.error('MediaPlayer: Plugin initialization error:', error);
      throw error;
    }
  }

  // ============================================================================
  // VR PLUGIN - Inchangé
  // ============================================================================
  
  initVRPlugin = async () => {
    if (!this.player || this.isDestroyed) return;

    try {
      const vrPlugin = await loadVRPlugin();
      
      if (!vrPlugin) return;

      if (typeof this.player.vr === 'function') {
        this.configureVRPlugin();
        return;
      }

      if (!videojs.getPlugin('vr')) {
        if (vrPlugin.default) {
          const vrWrapper = function(options = {}) {
            return new vrPlugin.default(this, options);
          };
          videojs.registerPlugin('vr', vrWrapper);
        }
      }

      this.configureVRPlugin();
      
    } catch (error) {
      console.warn('MediaPlayer: VR plugin initialization failed:', error);
    }
  }

  configureVRPlugin = () => {
    if (!this.player || this.isDestroyed) return;
    
    try {
      if (!this.player.mediainfo) {
        this.player.mediainfo = {};
      }
      
      this.player.vr({
        projection: 'AUTO',
        debug: false,
        forceCardboard: false
      });
      
      console.log('MediaPlayer: VR plugin configured');
    } catch (error) {
      console.warn('MediaPlayer: VR configuration failed:', error);
    }
  }

  // ============================================================================
  // CALLBACKS - ✅ Trigger re-render quand approprié
  // ============================================================================

  setupBasicCallbacks = () => {
    if (!this.player) return;
    this.player.on('error', (error) => {
      console.error('MediaPlayer: Video.js error:', error);
      this.props.onError?.(error);
    });
  }

  setupAdvancedCallbacks = () => {
    if (!this.player) return;

    this.player.on('loadedmetadata', () => {
      const duration = this.player.duration() || 0;
      this.props.onLoadEnd?.({ 
        duration, 
        type: this._isPlaylistMode() ? 'playlist' : 'media' 
      });
      this.updatePlaylistButtons();
      this._triggerRender(); // ✅ Re-render après load
    });

    this.player.on('play', () => {
      const currentTime = this.player.currentTime() || 0;
      this.props.onPlay?.({ currentTime });
      this.updatePlaylistButtons();
    });

    this.player.on('pause', () => {
      const currentTime = this.player.currentTime() || 0;
      this.props.onPause?.({ currentTime });
    });

    this.player.on('ended', () => {
      this.props.onEnd?.({ currentTime: 0 });
    });

    this.player.on('seeked', () => {
      const currentTime = this.player.currentTime() || 0;
      this.props.onSeek?.({ currentTime });
    });

    this.player.on('timeupdate', () => {
      const currentTime = this.player.currentTime() || 0;
      this.props.onTimeUpdate?.({ currentTime });
    });
  }

  // ============================================================================
  // ✅ CLEANUP - Reset state simplifié + cleanup listeners
  // ============================================================================

  cleanup = () => {
    this.isDestroyed = true;
    this.isInitialized = false;
    this.isInitializing = false;
    
    // ✅ Cleanup listeners managers
    if (this.managersListener) {
      this.managersListener();
      this.managersListener = null;
    }
    
    if (this.player) {
      try {
        if (!this.player.paused()) {
          this.player.pause();
        }
        
        if (typeof this.player.dispose === 'function') {
          this.player.dispose();
        }
      } catch (error) {
        console.error('MediaPlayer: Error during player cleanup:', error);
      } finally {
        this.player = null;
        this.isPlayerReady = false;
        this.initRetries = 0;
        
        // ✅ Reset state simplifié
        this.setState({
          renderTrigger: 0
        });
      }
    }
  }

  // ============================================================================
  // PUBLIC API - ✅ Utilise helper _isPlaylistMode
  // ============================================================================

  play = () => this.player?.play()
  pause = () => this.player?.pause()
  stop = () => { 
    this.player?.pause(); 
    this.player?.currentTime(0); 
  }
  seek = (time) => this.player?.currentTime(time)
  getTime = () => this.player?.currentTime() || 0
  getDuration = () => this.player?.duration() || 0
  isPlaying = () => this.player ? !this.player.paused() : false

  // ✅ API Playlist utilise les méthodes intégrées Managers
  nextItem = () => this.handleNext()
  previousItem = () => this.handlePrevious()
  goToItem = (index) => this.goToPlaylistItem(index)
  getCurrentItem = () => this.getCurrentPlaylistItem()
  getPlaylist = () => this._isPlaylistMode() ? this.player.playlist() : []

  getState = () => ({
    currentTime: this.getTime(),
    duration: this.getDuration(),
    isPlaying: this.isPlaying(),
    mediaType: this._isPlaylistMode() ? 'playlist' : 'media',
    playlistInfo: this.getPlaylistInfo() // Utilise la méthode intégrée
  })

  // ============================================================================
  // RENDER - ✅ Utilise helper _hasValidPlaylist
  // ============================================================================

  render() {
    const { className = '' } = this.props;
    
    const hasContent = this._hasValidPlaylist();
    
    return (
      <div className={`media-player ${className}`}>
        {hasContent ? (
          <div data-vjs-player>
            <video
              ref={this.videoRef}
              className="video-js vjs-default-skin vjs-theme-funplayer"
              playsInline
              data-setup="{}"
            />
          </div>
        ) : (
          <div 
            className="media-placeholder"
            style={{
              width: '100%',
              height: '300px',
              backgroundColor: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
              fontSize: '1rem',
              borderRadius: 'calc(var(--base-radius) * 0.5)'
            }}
          >
            📁 No media loaded
          </div>
        )}
      </div>
    );
  }
}

export default MediaPlayer;