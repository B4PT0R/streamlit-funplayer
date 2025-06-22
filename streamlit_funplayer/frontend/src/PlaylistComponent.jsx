import React, { Component } from 'react';
import managers from './Managers'; 

/**
 * PlaylistComponent - ✅ OPTIMISÉ: Pattern cohérent + state simplifié
 * Utilise directement les props + renderTrigger pour cohérence
 */
class PlaylistComponent extends Component {
  constructor(props) {
    super(props);
    this.playlist = managers.getPlaylist();
    this.state = {
      renderTrigger: 0
    };
  }

  componentDidMount() {    
    // ✅ NOUVEAU: Utiliser le système d'événements Managers
    this.managersListener = managers.addListener(this.handleManagerEvent);
    this._triggerRenderIfNeeded();
  }

  componentWillUnmount() {
    // ✅ MODIFIÉ: Cleanup du listener managers
    if (this.managersListener) {
      this.managersListener();
    }
  }

  // ✅ NOUVEAU: Handler unifié via Managers
  handleManagerEvent = (event, data) => {
    if (event === 'playlist:loaded' || event === 'playlist:itemChanged') {
      this.handlePlaylistRefresh();
    }
  }

  // ✅ CONSERVÉ: handlePlaylistRefresh reste identique
  handlePlaylistRefresh = () => {
    this._triggerRenderIfNeeded();
    if (this.props.onResize) {
      this.props.onResize();
    }
  };

  // ============================================================================
  // ✅ NOUVEAU: HELPERS POUR PATTERN COHÉRENT
  // ============================================================================

  _triggerRender = () => {
    this.setState(prevState => ({ 
      renderTrigger: prevState.renderTrigger + 1 
    }));
  }

  _triggerRenderIfNeeded = () => {
    // ✅ OPTIMISATION: Ne re-render que si on a vraiment du contenu à afficher
    const playlist = this.getPlaylist();
    if (playlist.length > 1) {
      this._triggerRender();
    }
  }

  // ✅ NOUVEAU: Getters pour accès direct aux données (pas de state redondant)
  getPlaylist = () => this.playlist.getItems();

  getCurrentIndex = () => this.playlist.getCurrentIndex();

  shouldShowPlaylist = () => {
    const playlist = this.getPlaylist();
    return playlist.length > 1;
  }

  // ============================================================================
  // ✅ MODIFIÉ: ACTIONS - Communication simplifiée
  // ============================================================================

  handleItemClick = (index) => {
    
    const success = this.playlist.goTo(index);
        
    if (!success) {
      console.error('PlaylistComponent: Failed to go to item', index);
    }
  }

  // ============================================================================
  // ✅ MODIFIÉ: MÉTADONNÉES - Utilise les getters
  // ============================================================================

  generateFallbackThumbnail = (item, index) => {
    // Déterminer le type et l'icône
    let icon = '📄';
    let bgColor = '#6B7280';

    // ✅ Utiliser sources au lieu de media (format Video.js étendu)
    if (item.sources && item.sources.length > 0) {
      const firstSource = item.sources[0];
      const srcLower = firstSource.src.toLowerCase();
      const typeLower = (firstSource.type || '').toLowerCase();
      
      // Vérifier par type MIME d'abord
      if (typeLower.startsWith('audio/') || 
          ['.mp3', '.wav', '.ogg', '.m4a', '.aac'].some(ext => srcLower.includes(ext))) {
        icon = '🎵';
        bgColor = '#10B981';
      } else if (typeLower.startsWith('video/') || 
                 ['.mp4', '.webm', '.mov', '.avi', '.mkv'].some(ext => srcLower.includes(ext))) {
        icon = '🎥';
        bgColor = '#3B82F6';
      }
    } else if (item.funscript) {
      // Funscript seul (pas de sources)
      icon = '🎮';
      bgColor = '#8B5CF6';
    } else if (item.duration) {
      // Timeline mode
      icon = '⏱️';
      bgColor = '#F59E0B';
    }

    // ✅ Créer un SVG sans btoa() pour éviter les erreurs Unicode
    const svg = `<svg width="48" height="32" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="32" fill="${bgColor}" rx="4"/><text x="24" y="20" text-anchor="middle" fill="white" font-size="16" font-family="system-ui">${icon}</text></svg>`;
    
    // ✅ Encoder manuellement sans btoa()
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  getItemTitle = (item, index) => {
    // ✅ Priorité name > title (format Video.js étendu)
    if (item.name) {
      return item.name;
    }
    
    if (item.title) {
      return item.title;
    }

    // ✅ Extraire du nom de fichier sources
    if (item.sources && item.sources.length > 0) {
      const firstSource = item.sources[0];
      
      if (firstSource.src.startsWith('data:')) {
        const mimeMatch = firstSource.src.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'unknown';
        return `Uploaded ${mimeType.split('/')[0]}`;
      }

      const filename = firstSource.src.split('/').pop().split('.')[0];
      return filename || `Item ${index + 1}`;
    }

    // ✅ Extraire du nom de fichier funscript
    if (item.funscript && typeof item.funscript === 'string') {
      if (item.funscript.startsWith('data:')) {
        return `Uploaded funscript`;
      }
      const filename = item.funscript.split('/').pop().split('.')[0];
      return filename || `Haptic ${index + 1}`;
    }

    return `Item ${index + 1}`;
  }

  getItemInfo = (item) => {
    const info = [];

    // ✅ Détecter le type depuis sources
    if (item.sources && item.sources.length > 0) {
      const firstSource = item.sources[0];
      
      // Type de media explicite depuis le type MIME
      if (firstSource.type) {
        const mimeType = firstSource.type.toLowerCase();
        if (mimeType.startsWith('video/')) {
          info.push('VIDEO');
        } else if (mimeType.startsWith('audio/')) {
          info.push('AUDIO');
        } else if (mimeType.includes('mpegurl')) {
          info.push('HLS');
        } else if (mimeType.includes('dash')) {
          info.push('DASH');
        } else {
          info.push('MEDIA');
        }
      } else {
        // Fallback : détecter par extension
        if (firstSource.src.startsWith('data:')) {
          info.push('UPLOADED');
        } else {
          const ext = firstSource.src.split('.').pop().toUpperCase();
          info.push(ext);
        }
      }
    } else {
      // Pas de sources = timeline/haptic mode
      if (item.duration) {
        info.push('TIMELINE');
      } else {
        info.push('HAPTIC');
      }
    }

    // Durée si fournie
    if (item.duration) {
      const minutes = Math.floor(item.duration / 60);
      const seconds = Math.floor(item.duration % 60);
      info.push(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }

    // Haptic indicator
    if (item.funscript) {
      info.push('🎮');
    }

    return info.join(' • ');
  }

  // ============================================================================
  // ✅ MODIFIÉ: RENDER - Utilise les getters au lieu du state
  // ============================================================================

  render() {
    // ✅ MODIFIÉ: Utilise les getters au lieu du state
    const playlist = this.getPlaylist();
    const currentIndex = this.getCurrentIndex();

    // ✅ OPTIMISATION: Toujours afficher si playlist > 1
    if (!this.shouldShowPlaylist()) {
      return null;
    }

    return (
      <div className="fp-playlist-column">
        
        {/* Header simple */}
        <div className="fp-playlist-header">
          <span className="fp-label">Playlist ({playlist.length})</span>
        </div>

        {/* Liste des items */}
        <div className="fp-playlist-items">
          {playlist.map((item, index) => (
            <div
              key={index}
              className={`fp-playlist-item ${index === currentIndex ? 'active' : ''}`}
              onClick={() => this.handleItemClick(index)}
              title={item.description || this.getItemTitle(item, index)}
            >
              
              {/* ✅ Miniature avec fallback intelligent */}
              <div className="fp-item-thumbnail">
                <img 
                  src={item.poster || this.generateFallbackThumbnail(item, index)} 
                  alt={this.getItemTitle(item, index)}
                  onLoad={() => console.log(`🖼️ Thumbnail loaded for item ${index}`)}
                  onError={(e) => { 
                    console.warn(`❌ Thumbnail failed to load for item ${index}, using fallback`);
                    // Si le poster échoue, utiliser le fallback
                    e.target.src = this.generateFallbackThumbnail(item, index);
                  }}
                />
              </div>
              
              {/* Contenu texte */}
              <div className="fp-item-content">
                {/* Titre de l'item */}
                <div className="fp-item-title">
                  {this.getItemTitle(item, index)}
                </div>
                
                {/* Infos de l'item */}
                <div className="fp-item-info">
                  {this.getItemInfo(item)}
                </div>
              </div>
              
            </div>
          ))}
        </div>
        
      </div>
    );
  }
}

export default PlaylistComponent;