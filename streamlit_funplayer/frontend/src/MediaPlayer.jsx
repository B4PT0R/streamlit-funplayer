import React, { Component } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
//import 'three';
import MediaManager from './MediaManager';

// ✅ MODIFIÉ: Import conditionnel pour éviter les Feature Policy warnings
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
 * MediaPlayer - Simplifié avec MediaManager
 * Focus sur Video.js et playlist, délègue les utilitaires au MediaManager
 */
class MediaPlayer extends Component {
  constructor(props) {
    super(props);
    this.videoRef = React.createRef();
    this.player = null;
    this.isPlayerReady = false;
    this.initRetries = 0;
    this.maxRetries = 3;
    
    // ✅ NOUVEAU: MediaManager pour les utilitaires
    this.mediaManager = new MediaManager();

    // ✅ AJOUT: Flags pour éviter double initialisation
    this.isInitialized = false;
    this.isInitializing = false;
    this.isDestroyed = false;
    
    // ✅ CORRIGÉ: Tout dans le state React
    this.state = {
      currentPlaylistIndex: -1,
      hasPlaylist: false,
      lastPlaylistProcessed: null
    };
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  componentDidMount() {
    // ✅ FIX: S'assurer qu'on n'est pas marqué comme destroyed
    this.isDestroyed = false;
    this.isInitialized = false;
    this.isInitializing = false;
    
    const { playlist } = this.props;
    const hasContent = playlist && playlist.length > 0;
    
    if (hasContent && !this.isInitialized && !this.isInitializing) {
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.initPlayer();
        }
      }, 50);
    }
  }

  componentDidUpdate(prevProps) {
    // ✅ FIX: Ne skip que si vraiment détruit
    if (this.isDestroyed) return;
    
    const { playlist } = this.props;
    const hasContent = playlist && playlist.length > 0;
    const hadContent = prevProps.playlist && prevProps.playlist.length > 0;
    
    if (!hadContent && hasContent && !this.isInitialized && !this.isInitializing) {
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.initPlayer();
        }
      }, 50);
      return;
    }
    
    if (this.isPlayerReady && hasContent && prevProps.playlist !== playlist) {
      this.updatePlaylist(playlist);
    }
  }

  componentWillUnmount() {
    // ✅ AJOUT: Marquer comme détruit
    this.isDestroyed = true;
    this.cleanup();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  initPlayer = async () => {
    // Guards multiples
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
        
        // Initialisation async des plugins
        this.initPlugins().then(() => {
          console.log('MediaPlayer: Initialization complete');
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
      if (this.props.playlist && this.props.playlist.length > 0) {
        await this.updatePlaylist(this.props.playlist);
      }

    } catch (error) {
      console.error('MediaPlayer: Plugin initialization error:', error);
      throw error;
    }
  }

  // ============================================================================
  // PLAYLIST PLUGIN
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

      // Setup event listeners
      this.player.on('playlistchange', this.handlePlaylistChange);
      this.player.on('playlistitem', this.handlePlaylistItem);
      
    } catch (error) {
      console.error('MediaPlayer: Playlist plugin initialization failed:', error);
      throw error;
    }
  }

  updatePlaylist = async (playlist) => {
    if (!this.player || !this.isPlayerReady || typeof this.player.playlist !== 'function') {
      return;
    }

    try {
      if (this.state.lastPlaylistProcessed === playlist) {
        return;
      }
      
      const vjsPlaylist = this.mediaManager.convertToVjsPlaylist(playlist);
      
      if (vjsPlaylist.length === 0) {
        this.player.playlist([]);
        this.setState({ 
          hasPlaylist: false,
          lastPlaylistProcessed: playlist 
        });
        return;
      }

      this.player.playlist(vjsPlaylist);
      
      if (this.player.playlist.currentItem() === -1) {
        this.player.playlist.currentItem(0);
      }
      
      this.setState({ 
        hasPlaylist: true,
        lastPlaylistProcessed: playlist 
      });
      
      this.props.onPlaylistProcessed?.(vjsPlaylist);
      
    } catch (error) {
      console.error('MediaPlayer: Error updating playlist:', error);
      this.props.onError?.(error);
    }
  }

  // ============================================================================
  // PLAYLIST EVENT HANDLERS
  // ============================================================================

  handlePlaylistChange = () => {
  }

  handlePlaylistItem = () => {
    const newIndex = this.player.playlist.currentItem();
    
    if (newIndex !== this.state.currentPlaylistIndex) {
      this.setState({ currentPlaylistIndex: newIndex });
      
      setTimeout(() => {
        const currentItem = this.getCurrentPlaylistItem();
        if (currentItem && currentItem.poster) {
          this.player.poster(currentItem.poster);
        }
      }, 100);
      
      const currentItem = this.getCurrentPlaylistItem();
      this.props.onPlaylistItemChange?.(currentItem, newIndex);
    }
  }

  // ============================================================================
  // PLAYLIST PUBLIC API
  // ============================================================================

  getCurrentPlaylistItem = () => {
    if (!this.state.hasPlaylist || !this.player) return null;
    const index = this.player.playlist.currentItem();
    const playlist = this.player.playlist();
    return index >= 0 && index < playlist.length ? playlist[index] : null;
  }

  goToPlaylistItem = (index) => {
    if (!this.state.hasPlaylist || !this.player) return false;
    try {
      this.player.playlist.currentItem(index);
      return true;
    } catch (error) {
      console.error('MediaPlayer: Failed to go to playlist item', index, error);
      return false;
    }
  }

  handleNext = () => {
    if (this.state.hasPlaylist && this.player) {
      this.player.playlist.next();
    }
  }

  handlePrevious = () => {
    if (this.state.hasPlaylist && this.player) {
      this.player.playlist.previous();
    }
  }

  getPlaylistInfo = () => {
    if (!this.state.hasPlaylist || !this.player) {
      return { hasPlaylist: false, currentIndex: -1, totalItems: 0 };
    }
    
    return {
      hasPlaylist: true,
      currentIndex: this.player.playlist.currentItem(),
      totalItems: this.player.playlist().length,
      canGoPrevious: this.player.playlist.currentItem() > 0,
      canGoNext: this.player.playlist.currentItem() < this.player.playlist().length - 1
    };
  }

  // ============================================================================
  // PLAYLIST COMPONENTS REGISTRATION
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

  updatePlaylistButtons = () => {
    if (!this.player) return;

    const controlBar = this.player.getChild('controlBar');
    if (!controlBar) return;

    const prevBtn = controlBar.getChild('PreviousButton');
    const nextBtn = controlBar.getChild('NextButton');
    const playlistInfo = this.getPlaylistInfo();

    if (prevBtn) {
      prevBtn.el().disabled = !playlistInfo.canGoPrevious;
      prevBtn.el().style.opacity = playlistInfo.canGoPrevious ? '1' : '0.3';
    }

    if (nextBtn) {
      nextBtn.el().disabled = !playlistInfo.canGoNext;
      nextBtn.el().style.opacity = playlistInfo.canGoNext ? '1' : '0.3';
    }
  }

  // ============================================================================
  // VR PLUGIN
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
        debug: false, // ✅ MODIFIÉ: Réduire les logs
        forceCardboard: false // ✅ MODIFIÉ: Plus conservateur
      });
      
      console.log('MediaPlayer: VR plugin configured');
    } catch (error) {
      console.warn('MediaPlayer: VR configuration failed:', error);
    }
  }

  // ============================================================================
  // CALLBACKS
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
        type: this.hasPlaylist ? 'playlist' : 'media' 
      });
      this.updatePlaylistButtons();
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
  // CLEANUP
  // ============================================================================

  cleanup = () => {
    this.isDestroyed = true;
    this.isInitialized = false;
    this.isInitializing = false;
    
    if (this.mediaManager) {
      try {
        this.mediaManager.cleanup();
      } catch (error) {
        console.error('MediaPlayer: MediaManager cleanup error:', error);
      }
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
        
        this.setState({
          currentPlaylistIndex: -1,
          hasPlaylist: false,
          lastPlaylistProcessed: null
        });
      }
    }
  }

  // ============================================================================
  // PUBLIC API
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

  // API Playlist
  nextItem = () => this.handleNext()
  previousItem = () => this.handlePrevious()
  goToItem = (index) => this.goToPlaylistItem(index)
  getCurrentItem = () => this.getCurrentPlaylistItem()
  getPlaylist = () => this.state.hasPlaylist ? this.player.playlist() : []

  getState = () => ({
    currentTime: this.getTime(),
    duration: this.getDuration(),
    isPlaying: this.isPlaying(),
    mediaType: this.state.hasPlaylist ? 'playlist' : 'media',
    playlistInfo: this.getPlaylistInfo()
  })

  // ============================================================================
  // RENDER
  // ============================================================================

  render() {
    const { className = '', playlist } = this.props;
    
    const hasContent = playlist && playlist.length > 0;
    
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