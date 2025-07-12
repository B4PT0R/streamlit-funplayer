/**
 * MediaUtils - Utilitaires média centralisés
 * 
 * RESPONSABILITÉS :
 * - Détection MIME types
 * - Génération audio silencieux
 * - Génération posters SVG fallback
 * - Extraction métadonnées funscript
 * - Génération thumbnails vidéo
 */
class PlaylistUtils {
  
  // ============================================================================
  // SECTION 1: MIME TYPE DETECTION
  // ============================================================================
  
  /**
   * Détecte le type MIME d'un fichier depuis son URL/extension
   */
  static detectMimeType(src) {
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

  // ============================================================================
  // SECTION 2: AUDIO GENERATION
  // ============================================================================
  
  /**
   * Génère un fichier audio silencieux de la durée spécifiée
   */
  static generateSilentAudio(duration) {
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
    
    // WAV header
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
    
    // Silent audio data
    for (let i = 0; i < samples; i++) {
      view.setInt16(44 + i * 2, 0, true);
    }
    
    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  // ============================================================================
  // SECTION 3: SVG POSTER GENERATION
  // ============================================================================
  
  /**
   * Génère un poster SVG de fallback basé sur le type d'item
   */
  static generateSVGPoster(item, index) {
    let icon = '📄';
    const bgColor = '#374151'; // Gris sombre neutre
    
    if (item.sources && item.sources.length > 0) {
      const firstSource = item.sources[0];
      const srcLower = firstSource.src.toLowerCase();
      const typeLower = (firstSource.type || '').toLowerCase();
      
      if (typeLower.startsWith('audio/') || 
          ['.mp3', '.wav', '.ogg', '.m4a', '.aac'].some(ext => srcLower.includes(ext))) {
        icon = '🎵';
      } else if (typeLower.startsWith('video/') || 
                ['.mp4', '.webm', '.mov', '.avi', '.mkv'].some(ext => srcLower.includes(ext))) {
        icon = '🎥';
      }
    } else if (item.funscript) {
      icon = '🎮';
    } else if (item.duration) {
      icon = '⏱️';
    }

    const svg = `<svg width="48" height="32" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="32" fill="${bgColor}" rx="4"/><text x="24" y="20" text-anchor="middle" fill="white" font-size="16" font-family="system-ui">${icon}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  // ============================================================================
  // SECTION 4: FUNSCRIPT METADATA EXTRACTION
  // ============================================================================
  
  /**
   * Extrait la durée d'un funscript depuis ses métadonnées ou actions
   */
  static extractFunscriptDuration(funscriptData) {
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
      return durationSeconds;      
    } catch (error) {
      return 0;
    }
  }

  // ============================================================================
  // SECTION 5: VIDEO THUMBNAIL GENERATION
  // ============================================================================
  
  /**
   * Génère un poster depuis une frame vidéo
   */
  static async generatePosterFromVideo(videoSrc, timeOffset = 10, maxWidth = 480) {
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
  // SECTION 6: FILE VALIDATION & HELPERS
  // ============================================================================
  
  /**
   * Vérifie si un fichier est un media supporté
   */
  static isSupportedMediaFile(filename) {
    const extension = filename.toLowerCase().split('.').pop();
    const supportedExtensions = [
      // Video
      'mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv', 'm4v',
      // Audio  
      'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'
    ];
    return supportedExtensions.includes(extension);
  }
  
  /**
   * Vérifie si un fichier est un funscript
   */
  static isFunscriptFile(filename) {
    const extension = filename.toLowerCase().split('.').pop();
    return ['funscript', 'json'].includes(extension);
  }
  
  /**
   * Extrait le nom de fichier depuis une URL
   */
  static extractFilename(src) {
    if (src.startsWith('data:')) {
      return 'uploaded_file';
    }
    
    try {
      const url = new URL(src, window.location.href);
      return url.pathname.split('/').pop().split('.')[0] || 'unnamed';
    } catch {
      return 'unnamed';
    }
  }

  // ============================================================================
  // COMPARAISON PROFONDE DE PLAYLISTS
  // ============================================================================

  /**
   * Compare deux playlists en profondeur pour détecter les vrais changements
   * Ignore les propriétés générées automatiquement (_id, poster généré, etc.)
   * @param {Array} playlist1 - Première playlist à comparer
   * @param {Array} playlist2 - Deuxième playlist à comparer
   * @returns {boolean} true si les playlists sont identiques en contenu
   */
  static deepComparePlaylist(playlist1, playlist2) {
    // Cas de base : références identiques
    if (playlist1 === playlist2) return true;
    
    // Cas de base : null/undefined
    if (!playlist1 || !playlist2) return playlist1 === playlist2;
    
    // Longueurs différentes
    if (playlist1.length !== playlist2.length) return false;
    
    // Comparaison item par item
    for (let i = 0; i < playlist1.length; i++) {
      if (!PlaylistUtils.deepComparePlaylistItem(playlist1[i], playlist2[i])) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Compare deux items de playlist en profondeur
   * Ignore les propriétés générées automatiquement
   * @param {Object} item1 - Premier item à comparer
   * @param {Object} item2 - Deuxième item à comparer
   * @returns {boolean} true si les items sont identiques en contenu
   */
  static deepComparePlaylistItem(item1, item2) {
    // Cas de base : références identiques
    if (item1 === item2) return true;
    
    // Cas de base : null/undefined
    if (!item1 || !item2) return item1 === item2;
    
    // Propriétés à ignorer (générées automatiquement)
    const ignoredProps = new Set([
      '_id',           // ID généré automatiquement
      '_generatedPoster', // Flag de poster généré
      'poster'         // Poster peut être généré automatiquement
    ]);
    
    // Récupérer toutes les clés des deux objets
    const keys1 = Object.keys(item1).filter(key => !ignoredProps.has(key));
    const keys2 = Object.keys(item2).filter(key => !ignoredProps.has(key));
    
    // Nombre de propriétés différent
    if (keys1.length !== keys2.length) return false;
    
    // Vérifier chaque propriété
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      
      const val1 = item1[key];
      const val2 = item2[key];
      
      // Comparaison récursive pour les objets/arrays
      if (typeof val1 === 'object' && typeof val2 === 'object') {
        if (Array.isArray(val1) && Array.isArray(val2)) {
          // Comparaison d'arrays
          if (!PlaylistUtils.deepCompareArray(val1, val2)) return false;
        } else if (Array.isArray(val1) || Array.isArray(val2)) {
          // Un array et un objet : différents
          return false;
        } else {
          // Comparaison d'objets
          if (!PlaylistUtils.deepCompareObject(val1, val2)) return false;
        }
      } else {
        // Comparaison de primitives
        if (val1 !== val2) return false;
      }
    }
    
    return true;
  }

  /**
   * Compare deux arrays en profondeur
   * @param {Array} arr1 - Premier array
   * @param {Array} arr2 - Deuxième array
   * @returns {boolean} true si identiques
   */
  static deepCompareArray(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    
    for (let i = 0; i < arr1.length; i++) {
      const val1 = arr1[i];
      const val2 = arr2[i];
      
      if (typeof val1 === 'object' && typeof val2 === 'object') {
        if (Array.isArray(val1) && Array.isArray(val2)) {
          if (!PlaylistUtils.deepCompareArray(val1, val2)) return false;
        } else if (!Array.isArray(val1) && !Array.isArray(val2)) {
          if (!PlaylistUtils.deepCompareObject(val1, val2)) return false;
        } else {
          return false; // Un array et un objet
        }
      } else if (val1 !== val2) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Compare deux objets en profondeur
   * @param {Object} obj1 - Premier objet
   * @param {Object} obj2 - Deuxième objet
   * @returns {boolean} true si identiques
   */
  static deepCompareObject(obj1, obj2) {
    if (!obj1 || !obj2) return obj1 === obj2;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      
      const val1 = obj1[key];
      const val2 = obj2[key];
      
      if (typeof val1 === 'object' && typeof val2 === 'object') {
        if (Array.isArray(val1) && Array.isArray(val2)) {
          if (!PlaylistUtils.deepCompareArray(val1, val2)) return false;
        } else if (!Array.isArray(val1) && !Array.isArray(val2)) {
          if (!PlaylistUtils.deepCompareObject(val1, val2)) return false;
        } else {
          return false;
        }
      } else if (val1 !== val2) {
        return false;
      }
    }
    
    return true;
  }
}

export default PlaylistUtils;