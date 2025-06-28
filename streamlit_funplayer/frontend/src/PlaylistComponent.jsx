import React, { Component } from 'react';
import core from './FunPlayerCore';

/**
 * PlaylistComponent - ✅ REFACTORISÉ selon guidelines
 * 
 * RESPONSABILITÉS SIMPLIFIÉES:
 * - UI pure pour la playlist (uniquement si > 1 item)
 * - Appels directs core.xxx (pas d'indirections)
 * - Re-render sur événements choisis uniquement
 * - ✅ PLUS DE: getters redondants, logique business dans event handlers
 */
class PlaylistComponent extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      renderTrigger: 0
    };
    
    this.coreListener = null;
  }

  componentDidMount() {
    this.coreListener = core.addListener(this.handleEvent);
  }

  componentWillUnmount() {
    if (this.coreListener) {
      this.coreListener();
      this.coreListener = null;
    }
  }

  // ============================================================================
  // ✅ GESTION D'ÉVÉNEMENTS SIMPLIFIÉE - Juste re-render
  // ============================================================================

  handleEvent = (event, data) => {
    const eventsToReact = [
      'playlist:loaded',
      'playlist:itemChanged'
    ];
    
    if (eventsToReact.includes(event)) {
      this._triggerRender();
      this.props.onResize?.();
    }
  }

  _triggerRender = () => {
    this.setState(prevState => ({ 
      renderTrigger: prevState.renderTrigger + 1 
    }));
  }

  // ============================================================================
  // ✅ ACTIONS SIMPLIFIÉES - Appels directs core, pas d'indirections
  // ============================================================================

  handleItemClick = (index) => {
    // ✅ BON: Appel direct core
    const success = core.playlist.goTo(index);
    
    if (!success) {
      console.error('PlaylistComponent: Failed to go to item', index);
    }
  }

  // ============================================================================
  // ✅ HELPERS SIMPLIFIÉS - Accès direct core
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

    // Type detection basée sur item_type (généré par PlaylistManager)
    switch (item.item_type) {
      case 'video': 
        info.push('VIDEO'); 
        break;
      case 'video_haptic': 
        info.push('VIDEO'); 
        break;
      case 'audio': 
        info.push('AUDIO'); 
        break;
      case 'audio_haptic': 
        info.push('AUDIO'); 
        break;
      case 'haptic': 
        info.push('HAPTIC'); 
        break;
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
  // ✅ RENDER SIMPLIFIÉ - Accès direct aux données via core
  // ============================================================================

  render() {
    // ✅ BON: Accès direct core pour toutes les données
    const playlist = core.playlist.items;
    const currentIndex = core.playlist.getCurrentIndex();

    // ✅ OPTIMISATION: Ne s'afficher que si playlist > 1
    if (playlist.length <= 1) {
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
              
              {/* ✅ Thumbnail utilise directement item.poster (généré par PlaylistManager) */}
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