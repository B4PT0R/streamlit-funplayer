import React, { Component } from 'react';

/**
 * StatusBarComponent - Barre de status et contrôles UI
 * 
 * RESPONSABILITÉS:
 * - Affichage status lecture (play/pause, updateRate)
 * - Boutons toggle (visualizer, debug)
 * - UI pure, pas de logique métier
 */
class StatusBarComponent extends Component {
  
  render() {
    const { 
      isPlaying, 
      updateRate, 
      showVisualizer, 
      showDebug,
      onToggleVisualizer,
      onToggleDebug 
    } = this.props;
    
    return (
      <div className="fp-status-bar">
        
        {/* Status lecture */}
        <span className="fp-status-bar-status">
          {isPlaying ? '▶️' : '⏸️'} 
          {updateRate}Hz
        </span>
        
        {/* Contrôles UI */}
        <div className="fp-status-bar-controls">
          <button 
            className="fp-status-bar-visualizer-btn"
            onClick={onToggleVisualizer}
            title={showVisualizer ? "Hide Visualizer" : "Show Visualizer"}
          >
            {showVisualizer ? '📊' : '📈'}
          </button>
          
          <button 
            className="fp-status-bar-debug-btn"
            onClick={onToggleDebug}
            title={showDebug ? "Hide Debug" : "Show Debug"}
          >
            {showDebug ? '🐛' : '🔍'}
          </button>
        </div>
        
      </div>
    );
  }
}

export default StatusBarComponent;