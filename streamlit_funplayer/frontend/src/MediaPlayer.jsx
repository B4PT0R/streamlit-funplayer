import React, { Component } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'three';
import 'videojs-vr/dist/videojs-vr';
import 'videojs-vr/dist/videojs-vr.css';
import MediaManager from './MediaManager';

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
    const { playlist } = this.props;
    const hasContent = playlist && playlist.length > 0;
    
    if (hasContent) {
      setTimeout(() => {
        this.initPlayer();
      }, 50);
    }
  }

  componentDidUpdate(prevProps) {
    const { playlist } = this.props;
    const hasContent = playlist && playlist.length > 0;
    const hadContent = prevProps.playlist && prevProps.playlist.length > 0;
    
    if (!hadContent && hasContent && !this.player) {
      setTimeout(() => {
        this.initPlayer();
      }, 50);
      return;
    }
    
    if (this.isPlayerReady && hasContent && prevProps.playlist !== playlist) {
      this.updatePlaylist(playlist);
    }
  }

  componentWillUnmount() {
    this.cleanup();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  initPlayer = () => {
    if (!this.videoRef?.current || this.player) return;

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
        controlBar: {
          children: [
            'playToggle', 'currentTimeDisplay', 'timeDivider', 
            'durationDisplay', 'progressControl', 'PreviousButton', 
            'NextButton', 'volumePanel', 'fullscreenToggle'
          ]
        }
      };

      this.player = videojs(videoElement, options);
      this.setupBasicCallbacks();

      this.player.ready(() => {
        this.isPlayerReady = true;
        this.setupAdvancedCallbacks();
        this.initVRPlugin();
        
        this.initPlaylistPlugin().then(() => {
          console.log('MediaPlayer: Full initialization complete');
        }).catch((error) => {
          console.error('MediaPlayer: Playlist plugin failed:', error);
          this.props.onError?.(error);
        });
      });

    } catch (error) {
      console.error('MediaPlayer: Failed to initialize Video.js:', error);
      this.props.onError?.(error);
    }
  }

  // ============================================================================
  // PLAYLIST PLUGIN
  // ============================================================================

  initPlaylistPlugin = async () => {
    if (!this.player) return;

    try {
      if (typeof this.player.playlist !== 'function') {
        const playlistPlugin = await import('videojs-playlist');
        if (playlistPlugin.default) {
          videojs.registerPlugin('playlist', playlistPlugin.default);
        }
      }

      if (typeof this.player.playlist !== 'function') {
        throw new Error('Playlist plugin failed to load');
      }

      this.player.on('playlistchange', this.handlePlaylistChange);
      this.player.on('playlistitem', this.handlePlaylistItem);
      
      if (this.props.playlist && this.props.playlist.length > 0) {
        this.updatePlaylist(this.props.playlist);
      }
      
    } catch (error) {
      console.error('MediaPlayer: Playlist plugin initialization failed:', error);
    }
  }

  updatePlaylist = async (playlist) => {
    if (!this.player || !this.isPlayerReady || typeof this.player.playlist !== 'function') {
      return;
    }

    try {
      console.log('MediaPlayer: Updating playlist with', playlist.length, 'items');
      
      if (this.state.lastPlaylistProcessed === playlist) {
        console.log('MediaPlayer: Same playlist, skipping processing');
        return;
      }
      
      // ✅ MODIFIÉ: Conversion directe sans enrichissement (déjà fait par FunPlayer)
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
      
      console.log('MediaPlayer: Playlist updated successfully');
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
    console.log('MediaPlayer: Playlist changed');
  }

  handlePlaylistItem = () => {
    const newIndex = this.player.playlist.currentItem();
    console.log('MediaPlayer: Playlist item changed to index', newIndex);
    
    if (newIndex !== this.state.currentPlaylistIndex) {
      this.setState({ currentPlaylistIndex: newIndex });
      
      setTimeout(() => {
        const currentItem = this.getCurrentPlaylistItem();
        if (currentItem && currentItem.poster) {
          console.log(`🖼️ Setting poster for item ${newIndex}:`, currentItem.poster.substring(0, 50) + '...');
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
    if (!this.player) return;

    try {
      if (typeof this.player.vr === 'function') {
        this.configureVRPlugin();
        return;
      }

      if (!videojs.getPlugin('vr')) {
        const vrPlugin = await import('videojs-vr');
        if (vrPlugin.default) {
          const vrWrapper = function(options = {}) {
            return new vrPlugin.default(this, options);
          };
          videojs.registerPlugin('vr', vrWrapper);
        }
      }

      this.configureVRPlugin();
      
    } catch (error) {
      console.error('MediaPlayer: VR plugin initialization failed:', error);
    }
  }

  configureVRPlugin = () => {
    try {
      if (!this.player.mediainfo) {
        this.player.mediainfo = {};
      }
      
      this.player.vr({
        projection: 'AUTO',
        debug: true,
        forceCardboard: true
      });
    } catch (error) {
      console.error('MediaPlayer: VR configuration failed:', error);
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
    if (this.mediaManager) {
      this.mediaManager.cleanup();
    }
    
    if (this.player) {
      try {
        if (typeof this.player.dispose === 'function') {
          this.player.dispose();
        }
      } catch (error) {
        console.error('MediaPlayer: Error during cleanup:', error);
      } finally {
        this.player = null;
        this.isPlayerReady = false;
        this.initRetries = 0;
        
        // ✅ CORRIGÉ: Reset state au lieu de propriétés
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