import React, { Component } from 'react';
import managers from './Managers'; 

/**
 * PlaylistComponent - ✅ NETTOYÉ: Plus de génération de thumbnails
 * Utilise directement les posters générés par PlaylistManager
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
    // ✅ Utiliser le système d'événements Managers
    this.managersListener = managers.addListener(this.handleManagerEvent);
    this._triggerRenderIfNeeded();
  }

  componentWillUnmount() {
    // ✅ Cleanup du listener managers
    if (this.managersListener) {
      this.managersListener();
    }
  }

  // ✅ Handler unifié via Managers
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
  // ✅ HELPERS POUR PATTERN COHÉRENT
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

  // ✅ Getters pour accès direct aux données (pas de state redondant)
  getPlaylist = () => this.playlist.getItems();

  getCurrentIndex = () => this.playlist.getCurrentIndex();

  shouldShowPlaylist = () => {
    const playlist = this.getPlaylist();
    return playlist.length > 1;
  }

  // ============================================================================
  // ✅ ACTIONS - Communication simplifiée
  // ============================================================================

  handleItemClick = (index) => {
    const success = this.playlist.goTo(index);
        
    if (!success) {
      console.error('PlaylistComponent: Failed to go to item', index);
    }
  }

  // ============================================================================
  // ✅ MÉTADONNÉES - Utilise les getters
  // ============================================================================

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

    // Type detection...
    switch (item.item_type) {
      case 'video': info.push('VIDEO'); break;
      case 'video_haptic': info.push('VIDEO'); break;
      case 'audio': info.push('AUDIO'); break;
      case 'audio_haptic': info.push('AUDIO'); break;
      case 'haptic': info.push('HAPTIC'); break;
      // ✅ SUPPRIMÉ : case 'timeline'
    }

    // ✅ Durée cosmétique (sera corrigée par MediaPlayer)
    if (item.duration) {
      const minutes = Math.floor(item.duration / 60);
      const seconds = Math.floor(item.duration % 60);
      info.push(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }

    // Haptic indicator
    if (['video_haptic', 'audio_haptic', 'haptic'].includes(item.item_type)) {
      info.push('🎮');
    }

    return info.join(' • ');
  }

  // ============================================================================
  // ✅ RENDER SIMPLIFIÉ - Plus de génération de thumbnails
  // ============================================================================

  render() {
    // ✅ Utilise les getters au lieu du state
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
              
              {/* ✅ SIMPLIFIÉ: Thumbnail utilise directement item.poster */}
              <div className="fp-item-thumbnail">
                <img 
                  src={item.poster} // ✅ Toujours défini par PlaylistManager
                  alt={this.getItemTitle(item, index)}
                  onError={(e) => { 
                    // ✅ Fallback d'urgence si même le SVG échoue
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '📄';
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