/**
 * PlaylistManager - ✅ NOUVEAU: Manager unifié pour gestion complète des playlists
 * 
 * Combine :
 * - Ex-MediaManager (utilitaires processing)
 * - Logique métier navigation + état centralisé
 * - Système d'événements spécialisés
 * 
 * Élimine la duplication d'état entre FunPlayer et MediaPlayer
 */
class PlaylistManager {
  constructor() {
    // ============================================================================
    // ÉTAT CENTRALISÉ - Remplace l'état dispersé dans FunPlayer/MediaPlayer
    // ============================================================================
    
    this.currentIndex = -1;      // Index de l'item en cours  
    this.items = [];             // Items de playlist traités
    this.originalPlaylist = [];  // Playlist originale (référence)
    
    // État de lecture (synchronisé avec MediaPlayer)
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    
    // ============================================================================
    // SYSTÈME D'ÉVÉNEMENTS - Callbacks spécialisés playlist
    // ============================================================================
    
    this.onPlaylistLoaded = null;    // (items, originalPlaylist) => {} - Playlist traitée
    this.onItemChanged = null;       // (index, item, previousIndex) => {} - Item changé
    this.onPlaybackChanged = null;   // (playbackState) => {} - État lecture changé
    this.onError = null;             // (message, error) => {} - Erreur processing
  }

  // ============================================================================
  // SECTION 1: TRAITEMENT PLAYLIST (ex-MediaManager)
  // ============================================================================

  /**
   * Point d'entrée principal : charge et traite une playlist complète
   */
  loadPlaylist = async (playlist) => {
    if (!playlist || playlist.length === 0) {
      this._resetPlaylist();
      this._notifyPlaylistLoaded([], []);
      return [];
    }

    try {
      console.log('PlaylistManager: Loading playlist with', playlist.length, 'items');
      
      // 1. Sauvegarder la référence originale
      this.originalPlaylist = [...playlist];
      
      // 2. Pipeline de traitement complet (ex-MediaManager)
      const processedItems = await this.processPlaylist(playlist);
      
      // 3. Mettre à jour l'état
      this.items = processedItems;
      this.currentIndex = -1; // Pas d'item sélectionné initialement
      
      console.log('PlaylistManager: Playlist loaded successfully');
      
      // 4. Notifier
      this._notifyPlaylistLoaded(processedItems, playlist);
      
      return processedItems;
      
    } catch (error) {
      console.error('PlaylistManager: Failed to load playlist:', error);
      this._notifyError('Failed to load playlist', error);
      return [];
    }
  }

  /**
   * Pipeline complet de traitement playlist (ex-MediaManager.processPlaylist)
   */
  processPlaylist = async (playlist) => {
    console.log('PlaylistManager: Processing playlist with', playlist.length, 'items');
    
    // 1. Filtrer les items valides
    const validItems = this.filterValidItems(playlist);
    
    // 2. Enrichir avec des posters générés
    const enrichedPlaylist = await this.enrichPlaylistWithPosters(validItems);
    
    // 3. Traiter les cas sans media (funscript seul)
    const withMedia = this.processNoMediaItems(enrichedPlaylist);
    
    // 4. Normaliser les sources (autodétection types MIME)
    const normalizedPlaylist = this.normalizeSources(withMedia);
    
    console.log('PlaylistManager: Playlist processing complete');
    return normalizedPlaylist;
  }

  /**
   * Filtre les items de playlist valides (élimine timeline pur)
   */
  filterValidItems = (playlist) => {
    return playlist.filter((item, index) => {
      // ✅ VALIDE: A des sources (media)
      if (item.sources && item.sources.length > 0) {
        return true;
      }
      
      // ✅ VALIDE: A un funscript (mode haptic pur)
      if (item.funscript) {
        return true;
      }
      
      // ❌ INVALIDE: Timeline pur (duration seule sans media ni funscript)
      if (item.duration && !item.sources && !item.funscript) {
        console.warn(`PlaylistManager: Filtering out timeline-only item ${index + 1}`);
        return false;
      }
      
      // ❌ INVALIDE: Item vide
      console.warn(`PlaylistManager: Filtering out empty item ${index + 1}`);
      return false;
    });
  }

  /**
   * Génère des sources audio silencieuses pour les items sans media
   */
  processNoMediaItems = (playlist) => {
    return playlist.map((item, index) => {
      // Si sources déjà présentes, ne pas toucher
      if (item.sources && item.sources.length > 0) {
        return item;
      }
      
      // ✅ SEUL CAS RESTANT: Funscript seul (timeline pur déjà filtré)
      if (item.funscript) {
        try {
          const funscriptDuration = this.extractFunscriptDuration(item.funscript);
          if (funscriptDuration > 0) {
            const silentAudioUrl = this.generateSilentAudio(funscriptDuration);
            return {
              ...item,
              sources: [{ src: silentAudioUrl, type: 'audio/wav' }]
            };
          }
        } catch (error) {
          console.error('Failed to process funscript for item', index, error);
        }
      }
      
      console.warn(`PlaylistManager: Unexpected item without sources or funscript at index ${index}`);
      return item;
    });
  }

  /**
   * Normalise les sources : ajoute les types MIME manquants
   */
  normalizeSources = (playlist) => {
    return playlist.map(item => {
      if (!item.sources || item.sources.length === 0) {
        return item;
      }
      
      const normalizedSources = item.sources.map(source => ({
        ...source,
        type: source.type || this.detectMimeType(source.src)
      }));
      
      return {
        ...item,
        sources: normalizedSources
      };
    });
  }

  /**
   * Enrichissement avec posters générés (ex-MediaManager)
   */
  enrichPlaylistWithPosters = async (playlist) => {
    const enrichedPlaylist = [];
    const posterCache = new Map();
    
    for (const [index, item] of playlist.entries()) {
      const enrichedItem = { ...item };
      
      // Skip si poster déjà présent
      if (item.poster) {
        enrichedPlaylist.push(enrichedItem);
        continue;
      }
      
      // Générer poster pour les vidéos (si sources présentes)
      if (item.sources && item.sources.length > 0) {
        const videoSource = item.sources.find(src => {
          const mimeType = src.type || this.detectMimeType(src.src);
          return mimeType.startsWith('video/');
        });
        
        if (videoSource) {
          try {
            // Vérifier le cache d'abord
            if (posterCache.has(videoSource.src)) {
              enrichedItem.poster = posterCache.get(videoSource.src);
              enrichedItem._generatedPoster = true;
            } else {
              const posterDataURL = await this.generatePosterFromVideo(videoSource.src, 10);
              enrichedItem.poster = posterDataURL;
              enrichedItem._generatedPoster = true;
              
              // Mettre en cache
              posterCache.set(videoSource.src, posterDataURL);
            }
          } catch (error) {
            console.warn(`Failed to generate poster for item ${index + 1}:`, error.message);
          }
        }
      }
      
      enrichedPlaylist.push(enrichedItem);
    }
    
    return enrichedPlaylist;
  }

  // ============================================================================
  // SECTION 2: UTILITAIRES MEDIA (ex-MediaManager)
  // ============================================================================

  /**
   * Détection MIME type (ex-MediaManager)
   */
  detectMimeType = (src) => {
    if (src.startsWith('data:')) {
      const mimeMatch = src.match(/data:([^;]+)/);
      return mimeMatch ? mimeMatch[1] : 'video/mp4';
    }
    
    const url = new URL(src, window.location.href);
    const extension = url.pathname.toLowerCase().split('.').pop();
    
    const mimeTypes = {
      // Video formats
      'mp4': 'video/mp4', 'webm': 'video/webm', 'ogg': 'video/ogg',
      'mov': 'video/quicktime', 'avi': 'video/x-msvideo', 'mkv': 'video/x-matroska',
      'm4v': 'video/mp4', 'ogv': 'video/ogg',
      
      // Audio formats  
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
      'm4a': 'audio/mp4', 'aac': 'audio/aac', 'flac': 'audio/flac',
      'oga': 'audio/ogg',
      
      // Streaming formats
      'm3u8': 'application/x-mpegURL',      // HLS
      'mpd': 'application/dash+xml',        // DASH
      'ism': 'application/vnd.ms-sstr+xml', // Smooth Streaming
      
      // Autres
      'json': 'application/json',
      'funscript': 'application/json'
    };
    
    return mimeTypes[extension] || 'video/mp4';
  }

  /**
   * Génération d'audio silencieux (ex-MediaManager)
   */
  generateSilentAudio = (duration) => {
    const sampleRate = 44100;
    const channels = 1;
    const samples = Math.floor(duration * sampleRate);
    
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples * 2, true);
    
    for (let i = 0; i < samples; i++) {
      view.setInt16(44 + i * 2, 0, true);
    }
    
    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  /**
   * Extraction durée funscript (ex-MediaManager)
   */
  extractFunscriptDuration = (funscriptData) => {
    try {
      let data = funscriptData;
      
      if (typeof funscriptData === 'string') {
        if (funscriptData.startsWith('http') || funscriptData.startsWith('/')) {
          console.warn('Cannot extract duration from funscript URL synchronously');
          return 0;
        }
        data = JSON.parse(funscriptData);
      }
      
      if (!data || typeof data !== 'object') {
        return 0;
      }
      
      // Cas 1: Durée explicite dans les métadonnées
      if (data.duration && typeof data.duration === 'number') {
        return data.duration;
      }
      
      // Cas 2: Calculer depuis les actions
      let maxTime = 0;
      
      // Chercher dans les actions principales
      if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
        const lastAction = data.actions[data.actions.length - 1];
        if (lastAction && typeof lastAction.at === 'number') {
          maxTime = Math.max(maxTime, lastAction.at);
        }
      }
      
      // Chercher dans tous les champs qui pourraient contenir des actions
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value) && value.length > 0) {
          const lastItem = value[value.length - 1];
          if (lastItem && typeof lastItem.at === 'number') {
            maxTime = Math.max(maxTime, lastItem.at);
          } else if (lastItem && typeof lastItem.t === 'number') {
            maxTime = Math.max(maxTime, lastItem.t);
          } else if (lastItem && typeof lastItem.time === 'number') {
            maxTime = Math.max(maxTime, lastItem.time);
          }
        }
      }
      
      // Convertir ms en secondes et ajouter un petit buffer
      const durationSeconds = maxTime > 0 ? (maxTime / 1000) + 1 : 0;
      
      console.log(`Extracted funscript duration: ${durationSeconds.toFixed(2)}s (from ${maxTime}ms)`);
      return durationSeconds;
      
    } catch (error) {
      console.error('Error extracting funscript duration:', error);
      return 0;
    }
  }

  /**
   * Génération poster depuis vidéo (ex-MediaManager)
   */
  generatePosterFromVideo = async (videoSrc, timeOffset = 10, maxWidth = 480) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.style.display = 'none';
      document.body.appendChild(video);
      
      const cleanup = () => {
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
      };
      
      video.onloadedmetadata = () => {
        // Calculer les dimensions
        const aspectRatio = video.videoWidth / video.videoHeight;
        if (video.videoWidth > maxWidth) {
          canvas.width = maxWidth;
          canvas.height = maxWidth / aspectRatio;
        } else {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        
        // Aller au temps voulu
        video.currentTime = Math.min(timeOffset, video.duration - 1);
      };
      
      video.onseeked = () => {
        try {
          // Capturer la frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Générer le data URL base64
          const dataURL = canvas.toDataURL('image/jpeg', 0.8);
          
          if (dataURL && dataURL.length > 1000) {
            const sizeKB = Math.round(dataURL.length * 0.75 / 1024);
            console.log(`Generated poster (${sizeKB}KB)`);
            cleanup();
            resolve(dataURL);
          } else {
            cleanup();
            reject(new Error('Failed to generate valid poster'));
          }
          
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      
      video.onerror = () => {
        cleanup();
        reject(new Error('Video loading failed'));
      };
      
      video.src = videoSrc;
      video.load();
    });
  }

  // ============================================================================
  // SECTION 3: LOGIQUE MÉTIER - NAVIGATION
  // ============================================================================

  /**
   * Navigation vers l'item suivant
   */
  next = () => {
    if (this.items.length === 0) return false;
    
    const nextIndex = this.currentIndex + 1;
    if (nextIndex >= this.items.length) {
      return false; // Fin de playlist
    }
    
    return this.goTo(nextIndex);
  }

  /**
   * Navigation vers l'item précédent
   */
  previous = () => {
    if (this.items.length === 0) return false;
    
    const prevIndex = this.currentIndex - 1;
    if (prevIndex < 0) {
      return false; // Début de playlist
    }
    
    return this.goTo(prevIndex);
  }

  /**
   * Navigation vers un item spécifique
   */
  goTo = (index) => {
    if (this.items.length === 0) return false;
    if (index < 0 || index >= this.items.length) return false;
    
    const previousIndex = this.currentIndex;
    this.currentIndex = index;
    
    const currentItem = this.items[index];
    
    // Notifier le changement
    this._notifyItemChanged(index, currentItem, previousIndex);
    
    return true;
  }

  /**
   * Vérifie si on peut aller au suivant
   */
  canNext = () => {
    return this.items.length > 0 && this.currentIndex < this.items.length - 1;
  }

  /**
   * Vérifie si on peut aller au précédent
   */
  canPrevious = () => {
    return this.items.length > 0 && this.currentIndex > 0;
  }

  // ============================================================================
  // SECTION 4: GETTERS D'ÉTAT
  // ============================================================================

  getCurrentIndex = () => this.currentIndex

  getCurrentItem = () => {
    if (this.currentIndex >= 0 && this.currentIndex < this.items.length) {
      return this.items[this.currentIndex];
    }
    return null;
  }

  getItems = () => [...this.items] // Copie pour éviter mutation

  getOriginalPlaylist = () => [...this.originalPlaylist]

  getPlaylistInfo = () => ({
    currentIndex: this.currentIndex,
    totalItems: this.items.length,
    hasPlaylist: this.items.length > 0,
    canNext: this.canNext(),
    canPrevious: this.canPrevious(),
    isPlaying: this.isPlaying,
    currentTime: this.currentTime,
    duration: this.duration
  })

  // ============================================================================
  // SECTION 5: SYNCHRONISATION PLAYBACK
  // ============================================================================

  /**
   * Synchronise l'état de lecture avec MediaPlayer
   */
  updatePlaybackState = (isPlaying, currentTime = null, duration = null) => {
    let hasChanged = false;
    
    if (this.isPlaying !== isPlaying) {
      this.isPlaying = isPlaying;
      hasChanged = true;
    }
    
    if (currentTime !== null && this.currentTime !== currentTime) {
      this.currentTime = currentTime;
      hasChanged = true;
    }
    
    if (duration !== null && this.duration !== duration) {
      this.duration = duration;
      hasChanged = true;
    }
    
    if (hasChanged) {
      this._notifyPlaybackChanged({
        isPlaying: this.isPlaying,
        currentTime: this.currentTime,
        duration: this.duration,
        currentIndex: this.currentIndex,
        currentItem: this.getCurrentItem()
      });
    }
  }

  // ============================================================================
  // SECTION 6: SYSTÈME D'ÉVÉNEMENTS PRIVÉ
  // ============================================================================

  _notifyPlaylistLoaded = (items, originalPlaylist) => {
    if (this.onPlaylistLoaded && typeof this.onPlaylistLoaded === 'function') {
      try {
        this.onPlaylistLoaded([...items], [...originalPlaylist]);
      } catch (error) {
        console.error('PlaylistManager: onPlaylistLoaded callback error:', error);
      }
    }
  }

  _notifyItemChanged = (index, item, previousIndex) => {
    console.log('📻 PlaylistManager._notifyItemChanged called:', { index, item: item?.name, previousIndex });
    
    if (this.onItemChanged && typeof this.onItemChanged === 'function') {
      try {
        console.log('📻 Calling onItemChanged callback...');
        this.onItemChanged(index, item ? { ...item } : null, previousIndex);
      } catch (error) {
        console.error('PlaylistManager: onItemChanged callback error:', error);
      }
    } else {
      console.warn('📻 PlaylistManager: onItemChanged callback not set!');
    }
  }

  _notifyPlaybackChanged = (playbackState) => {
    if (this.onPlaybackChanged && typeof this.onPlaybackChanged === 'function') {
      try {
        this.onPlaybackChanged({ ...playbackState });
      } catch (error) {
        console.error('PlaylistManager: onPlaybackChanged callback error:', error);
      }
    }
  }

  _notifyError = (message, error = null) => {
    console.error(`PlaylistManager: ${message}`, error);
    
    if (this.onError && typeof this.onError === 'function') {
      try {
        this.onError(message, error?.message || String(error) || null);
      } catch (callbackError) {
        console.error('PlaylistManager: onError callback error:', callbackError);
      }
    }
  }

  // ============================================================================
  // SECTION 7: RESET & CLEANUP
  // ============================================================================

  _resetPlaylist = () => {
    this.currentIndex = -1;
    this.items = [];
    this.originalPlaylist = [];
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
  }

  reset = () => {
    this._resetPlaylist();
    console.log('PlaylistManager: Reset complete');
  }

  cleanup = () => {
    this._resetPlaylist();
    
    // Désactiver les callbacks
    this.onPlaylistLoaded = null;
    this.onItemChanged = null;
    this.onPlaybackChanged = null;
    this.onError = null;
    
    console.log('PlaylistManager: Cleanup complete');
  }

  // ============================================================================
  // SECTION 8: DEBUG & STATS
  // ============================================================================

  getStats = () => ({
    totalItems: this.items.length,
    currentIndex: this.currentIndex,
    isPlaying: this.isPlaying,
    hasGeneratedPosters: this.items.filter(item => item._generatedPoster).length,
    processingComplete: true
  })

  getDebugInfo = () => ({
    state: {
      currentIndex: this.currentIndex,
      totalItems: this.items.length,
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration
    },
    currentItem: this.getCurrentItem(),
    navigation: {
      canNext: this.canNext(),
      canPrevious: this.canPrevious()
    },
    stats: this.getStats()
  })
}

export default PlaylistManager;