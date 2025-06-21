/**
 * MediaManager - Utilitaires pour la gestion des médias
 * Génération de posters, détection de formats, enrichissement de playlist
 */
class MediaManager {
  constructor() {
    // Plus besoin de tracking avec base64
  }

  // ============================================================================
  // DÉTECTION DE FORMATS
  // ============================================================================

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
      'mov': 'video/quicktime', 'avi': 'video/x-msvideo',
      // Audio formats
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'aac': 'audio/aac'
    };
    
    return mimeTypes[extension] || 'video/mp4';
  }

  isVideoSource = (src) => {
    if (src.startsWith('data:')) {
      return src.startsWith('data:video/');
    }
    
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
    const lowercaseSrc = src.toLowerCase();
    
    return videoExtensions.some(ext => lowercaseSrc.includes(ext));
  }

  isAudioSource = (src) => {
    if (src.startsWith('data:')) {
      return src.startsWith('data:audio/');
    }
    
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
    const lowercaseSrc = src.toLowerCase();
    
    return audioExtensions.some(ext => lowercaseSrc.includes(ext));
  }

  // ============================================================================
  // GÉNÉRATION D'AUDIO SILENCIEUX
  // ============================================================================

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

  // ============================================================================
  // EXTRACTION DURÉE FUNSCRIPT
  // ============================================================================

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

  // ============================================================================
  // GÉNÉRATION DE POSTERS BASE64 - ✅ NOUVEAU: Approche simplifiée
  // ============================================================================

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
        
        console.log(`Video: ${video.videoWidth}x${video.videoHeight} → Canvas: ${canvas.width}x${canvas.height}`);
        
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
            console.log(`Generated base64 poster at ${video.currentTime}s (${sizeKB}KB)`);
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
  };

  // ============================================================================
  // ENRICHISSEMENT DE PLAYLIST
  // ============================================================================

  enrichPlaylistWithPosters = async (playlist) => {
    const enrichedPlaylist = [];
    const posterCache = new Map(); // Cache par URL de média
    
    for (const [index, item] of playlist.entries()) {
      const enrichedItem = { ...item };
      
      // Skip si poster déjà présent
      if (item.poster) {
        console.log(`📷 Using existing poster for item ${index + 1}`);
        enrichedPlaylist.push(enrichedItem);
        continue;
      }
      
      // Générer poster pour les vidéos
      if (item.media && this.isVideoSource(item.media)) {
        try {
          // Vérifier le cache d'abord
          if (posterCache.has(item.media)) {
            enrichedItem.poster = posterCache.get(item.media);
            enrichedItem._generatedPoster = true;
            console.log(`🎯 Using cached poster for item ${index + 1}`);
          } else {
            console.log(`🎬 Generating poster for item ${index + 1}...`);
            const posterDataURL = await this.generatePosterFromVideo(item.media, 10);
            enrichedItem.poster = posterDataURL;
            enrichedItem._generatedPoster = true;
            
            // Mettre en cache
            posterCache.set(item.media, posterDataURL);
            console.log(`✅ Poster generated and cached for item ${index + 1}`);
          }
        } catch (error) {
          console.warn(`❌ Failed to generate poster for item ${index + 1}:`, error.message);
        }
      } else {
        console.log(`ℹ️ No poster for item ${index + 1} (not a video or no media)`);
      }
      
      enrichedPlaylist.push(enrichedItem);
    }
    
    return enrichedPlaylist;
  };

  // ============================================================================
  // CONVERSION PLAYLIST POUR VIDEO.JS
  // ============================================================================

  convertToVjsPlaylist = (playlist) => {
    return playlist.map((item, index) => {
      const vjsItem = {};
      
      // Gérer les différents cas de media
      if (item.media) {
        // Cas 1: Media explicite
        vjsItem.sources = [{
          src: item.media,
          type: this.detectMimeType(item.media)
        }];
      } else if (item.duration && item.duration > 0) {
        // Cas 2: Timeline mode avec durée explicite
        try {
          const silentAudioUrl = this.generateSilentAudio(item.duration);
          vjsItem.sources = [{
            src: silentAudioUrl,
            type: 'audio/wav'
          }];
        } catch (error) {
          console.error('Failed to generate silent audio for item', index);
          vjsItem.sources = [];
        }
      } else if (item.funscript) {
        // Cas 3: Funscript seul - extraire la durée automatiquement
        try {
          const funscriptDuration = this.extractFunscriptDuration(item.funscript);
          if (funscriptDuration > 0) {
            const silentAudioUrl = this.generateSilentAudio(funscriptDuration);
            vjsItem.sources = [{
              src: silentAudioUrl,
              type: 'audio/wav'
            }];
            console.log(`Generated silent audio for funscript-only item (${funscriptDuration}s)`);
          } else {
            console.warn('Could not extract duration from funscript');
            vjsItem.sources = [];
          }
        } catch (error) {
          console.error('Failed to process funscript for item', index, error);
          vjsItem.sources = [];
        }
      } else {
        // Cas 4: Item vide
        vjsItem.sources = [];
      }
      
      // Ajouter poster si fourni (important pour Video.js)
      if (item.poster) {
        vjsItem.poster = item.poster;
      }
      
      // Préserver les métadonnées custom
      vjsItem.funscript = item.funscript;
      vjsItem.title = item.title;
      vjsItem.duration = item.duration;
      vjsItem.media_type = item.media_type;
      vjsItem.media_info = item.media_info;
      vjsItem._generatedPoster = item._generatedPoster;
      
      return vjsItem;
    });
  };

  // ============================================================================
  // PIPELINE COMPLET DE TRAITEMENT - ✅ MODIFIÉ: Séparé en deux méthodes publiques
  // ============================================================================

  processPlaylist = async (playlist) => {
    console.log('MediaManager: Processing playlist with', playlist.length, 'items');
    
    // 1. Enrichir avec des posters générés
    const enrichedPlaylist = await this.enrichPlaylistWithPosters(playlist);
    
    // 2. Convertir au format Video.js
    const vjsPlaylist = this.convertToVjsPlaylist(enrichedPlaylist);
    
    console.log('MediaManager: Playlist processing complete');
    return vjsPlaylist;
  };

  // ✅ NOUVEAU: Méthodes publiques séparées pour usage flexible
  // enrichPlaylistWithPosters() → déjà définie plus haut
  // convertToVjsPlaylist() → déjà définie plus haut

  // ============================================================================
  // CLEANUP
  // ============================================================================

  cleanup = () => {
    // Plus rien à nettoyer avec les data URLs base64
    console.log('MediaManager: Cleanup complete (base64 posters)');
  };

  // ============================================================================
  // UTILITAIRES POUR DEBUG
  // ============================================================================

  getStats = () => {
    return {
      processingMethod: 'base64 data URLs'
    };
  };
}

export default MediaManager;