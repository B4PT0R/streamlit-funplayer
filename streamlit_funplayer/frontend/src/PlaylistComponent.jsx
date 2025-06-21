import React, { Component } from 'react';

/**
 * PlaylistComponent - UI d'affichage de playlist simplifié
 * Ne gère plus la logique métier, juste l'affichage et les clics
 * Communique avec MediaPlayer via les méthodes publiques
 */
class PlaylistComponent extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // ✅ NOUVEAU: État minimal, juste pour l'UI
      currentIndex: -1,
      playlist: []
    };
  }

  componentDidMount() {
    this.updateFromProps();
  }

  componentDidUpdate(prevProps) {
    // ✅ MODIFIÉ: Comparaison plus précise pour éviter les re-renders inutiles
    const playlistChanged = prevProps.playlist !== this.props.playlist;
    const indexChanged = prevProps.currentIndex !== this.props.currentIndex;
    
    if (playlistChanged || indexChanged) {
      this.updateFromProps();
    }
  }

  // ============================================================================
  // ✅ NOUVEAU: SYNCHRONISATION AVEC FUNPLAYER/MEDIAPLAYER
  // ============================================================================

  updateFromProps = () => {
    const { playlist, currentIndex, mediaPlayerRef } = this.props;
    
    let resolvedIndex = currentIndex || -1;
    
    // ✅ NOUVEAU: Fallback - demander l'index actuel au MediaPlayer si pas défini
    if (resolvedIndex === -1 && mediaPlayerRef?.current) {
      const playlistInfo = mediaPlayerRef.current.getPlaylistInfo();
      if (playlistInfo && playlistInfo.currentIndex >= 0) {
        resolvedIndex = playlistInfo.currentIndex;
      }
    }
    
    // ✅ NOUVEAU: Éviter setState inutile si les valeurs n'ont pas changé
    const newPlaylist = playlist || [];
    if (this.state.playlist !== newPlaylist || this.state.currentIndex !== resolvedIndex) {
      this.setState({
        playlist: newPlaylist,
        currentIndex: resolvedIndex
      });
    }
  }

  // ✅ NOUVEAU: Communication via MediaPlayer plutôt que callbacks directs
  handleItemClick = (index) => {
    const { mediaPlayerRef } = this.props;
    
    if (!mediaPlayerRef?.current) {
      console.warn('PlaylistComponent: No MediaPlayer reference');
      return;
    }

    // ✅ NOUVEAU: Utiliser l'API playlist du MediaPlayer
    const success = mediaPlayerRef.current.goToItem(index);
    
    if (!success) {
      console.error('PlaylistComponent: Failed to go to item', index);
    }
    
    // ✅ NOUVEAU: Pas besoin de callback - FunPlayer sera notifié via onPlaylistItemChange
  }

  // ============================================================================
  // ✅ NOUVEAU: GÉNÉRATION DE MINIATURES FALLBACK - ✅ CORRIGÉ: Sans btoa()
  // ============================================================================

  generateFallbackThumbnail = (item, index) => {
    // Déterminer le type et l'icône
    let icon = '📄';
    let bgColor = '#6B7280';

    if (item.media) {
      const mediaLower = item.media.toLowerCase();
      if (mediaLower.includes('audio') || 
          ['.mp3', '.wav', '.ogg', '.m4a', '.aac'].some(ext => mediaLower.includes(ext))) {
        icon = '🎵';
        bgColor = '#10B981';
      }
    } else if (item.funscript) {
      icon = '🎮';
      bgColor = '#8B5CF6';
    } else if (item.duration) {
      icon = '⏱️';
      bgColor = '#F59E0B';
    }

    // ✅ MODIFIÉ: Créer un SVG sans btoa() pour éviter les erreurs Unicode
    const svg = `<svg width="48" height="32" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="32" fill="${bgColor}" rx="4"/><text x="24" y="20" text-anchor="middle" fill="white" font-size="16" font-family="system-ui">${icon}</text></svg>`;
    
    // ✅ MODIFIÉ: Encoder manuellement sans btoa()
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  // ============================================================================
  // ✅ SIMPLIFIÉ: MÉTHODES UTILITAIRES (plus de logique métier)
  // ============================================================================

  getItemTitle = (item, index) => {
    // ✅ PRIORITÉ: Titre explicite
    if (item.title) {
      return item.title;
    }

    // ✅ FALLBACK: Extraire du nom de fichier media
    if (item.media) {
      if (item.media.startsWith('data:')) {
        const mimeMatch = item.media.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'unknown';
        return `Uploaded ${mimeType.split('/')[0]}`;
      }

      const filename = item.media.split('/').pop().split('.')[0];
      return filename || `Item ${index + 1}`;
    }

    // ✅ FALLBACK: Extraire du nom de fichier funscript
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

    // Type de media explicite
    if (item.media_type) {
      info.push(item.media_type.toUpperCase());
    } else if (item.media) {
      if (item.media.startsWith('data:')) {
        info.push('UPLOADED');
      } else {
        const ext = item.media.split('.').pop().toUpperCase();
        info.push(ext);
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
  // ✅ SIMPLIFIÉ: RENDER (pas de logique métier)
  // ============================================================================

  render() {
    const { playlist, currentIndex } = this.state;

    // ✅ NOUVEAU: Toujours afficher si playlist > 1, même en mode simple
    if (!playlist || playlist.length <= 1) {
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
              title={item.media_info || this.getItemTitle(item, index)}
            >
              
              {/* ✅ NOUVEAU: Miniature avec fallback intelligent */}
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