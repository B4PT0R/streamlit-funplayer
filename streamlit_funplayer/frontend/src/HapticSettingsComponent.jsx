import React, { Component } from 'react';
import ButtPlugSettingsComponent from './ButtPlugSettingsComponent';
import ActuatorSettingsComponent from './ActuatorSettingsComponent';
import ChannelSettingsComponent from './ChannelSettingsComponent'; // ✅ NOUVEAU: Import du composant de config des canaux

/**
 * HapticSettingsComponent - ✅ NETTOYÉ: UI pure sans notifications sauf resize
 * 
 * RESPONSABILITÉS SIMPLIFIÉES:
 * - Orchestrateur UI simple (ButtPlug + Actuators + Channel Settings)
 * - Appels directs this.core.xxx (pas d'indirections)
 * - Re-render intelligent sur événements globaux uniquement
 * - ✅ CLEAN: Pas de notifications status (c'est aux managers de le faire)
 * - Laisse les sous-composants gérer leurs propres événements granulaires
 */
class HapticSettingsComponent extends Component {
  constructor(props) {
    super(props);

    this.core=props.core
    
    this.state = {
      isExpanded: false,
      renderTrigger: 0
    };
    
    this.coreListener = null;
  }

  componentDidMount() {
    this.coreListener = this.core.addListener(this.handleEvent);
  }

  componentWillUnmount() {
    if (this.coreListener) {
      this.coreListener();
      this.coreListener = null;
    }
  }

  // ============================================================================
  // GESTION D'ÉVÉNEMENTS GRANULAIRES - Filtrage des événements globaux
  // ============================================================================

  handleEvent = (event, data) => {
    // Filtrage intelligent: Ne réagir qu'aux événements qui affectent 
    // la structure globale ou les paramètres master
    
    // 1. Événements de structure (qui changent la liste/config des actuateurs)
    const structuralEvents = [
      'buttplug:device',        // Device changé → nouveaux actuateurs
      'funscript:load',         // Nouveau funscript → nouveaux canaux
      'funscript:channels',     // Canaux mis à jour
      'buttplug:connection'     // Connection status → affecte l'affichage global
    ];

    // 2. Événements master/globaux (qui affectent tous les actuateurs)
    const masterEvents = [
      'buttplug:globalScale',   // Master scale changé
      'buttplug:globalOffset',  // Master offset changé
      'core:autoConnect',       // Auto-connect terminé
      'core:autoMap'           // Auto-map terminé
    ];

    // Réaction: Uniquement aux événements structurels et master
    if (structuralEvents.includes(event) || masterEvents.includes(event)) {
      this._triggerRender();
    }
  }

  _triggerRender = () => {
    this.setState(prevState => ({ 
      renderTrigger: prevState.renderTrigger + 1 
    }));
  }

  // ============================================================================
  // ACTIONS SIMPLIFIÉES - Appels directs core, pas d'indirections
  // ============================================================================

  handleToggleExpanded = () => {
    this.setState({ isExpanded: !this.state.isExpanded }, () => {
      // ✅ ANCIEN: this.props.onResize?.();
      // ✅ NOUVEAU: Bus d'événements
      this.core.notify('component:resize', {
        source: 'HapticSettingsComponent',
        reason: `main-settings-${this.state.isExpanded ? 'expanded' : 'collapsed'}`
      });
    });
  }

  handleAutoMap = () => {
    // Appel direct core - les notifications seront faites par FunPlayerCore
    const mapResult = this.core.autoMapChannels();
  }

  handleUpdateRateChange = (newRate) => {
    // Délégation props (technique UI)
    this.props.onUpdateRateChange?.(newRate);
  }

  handleGlobalScaleChange = (scale) => {
    // Appel direct core - les notifications seront faites par ButtPlugManager
    this.core.buttplug.setGlobalScale(scale);
  }

  handleGlobalOffsetChange = (offset) => {
    // Appel direct core - les notifications seront faites par ButtPlugManager
    this.core.buttplug.setGlobalOffset(offset);
  }

  handleIntifaceUrlChange = (newUrl) => {
    // Appel direct core - les notifications seront faites par ButtPlugManager
    this.core.buttplug.setIntifaceUrl(newUrl);
  }

  // ============================================================================
  // RENDER PRINCIPAL - Déjà clean
  // ============================================================================
  render() {
    const { isExpanded } = this.state;
    
    return (
      <div className="fp-haptic-settings">
        
        {/* Barre principale */}
        <ButtPlugSettingsComponent
          core={this.core}
          onToggleSettings={this.handleToggleExpanded}
          isSettingsExpanded={isExpanded}
        />
        
        {/* Settings détaillés */}
        {this.renderExpandedSettings()}
        
      </div>
    );
  }

  // ============================================================================
  // SETTINGS EXPANDUS - Suppression de tout le sur-nesting
  // ============================================================================
  renderExpandedSettings() {
    if (!this.state.isExpanded) return null;
    
    // Accès direct core pour toutes les données globales
    const funscriptChannels = this.core.funscript.getChannelNames();
    const actuators = this.core.buttplug.getActuators();
    const updateRate = this.props.onGetUpdateRate?.() || 60;
    const globalOffset = this.core.buttplug.getGlobalOffset();
    const globalScale = this.core.buttplug.getGlobalScale();
    const intifaceUrl = this.core.buttplug.getIntifaceUrl();
    const isConnected = this.core.buttplug.getStatus()?.isConnected || false;
    
    return (
      <div className="fp-haptic-settings-expanded">
        
        {/* Section Connection */}
        <div className="fp-haptic-settings-connection-section">
          <h6 className="fp-haptic-settings-section-title">⚙️ Connection</h6>
          
          {/* Intiface URL + Update Rate */}
          <div className="fp-haptic-settings-connection-controls">
            
            {/* Intiface WebSocket URL */}
            <div className="fp-haptic-settings-url-control">
              <label className="fp-haptic-settings-url-label">Intiface WebSocket URL</label>
              <div className="fp-haptic-settings-url-input-group">
                <input
                  className="fp-haptic-settings-url-input"
                  type="text"
                  value={intifaceUrl}
                  onChange={(e) => this.handleIntifaceUrlChange(e.target.value)}
                  placeholder="ws://localhost:12345"
                  title="WebSocket URL for Intiface Central connection"
                />
                <button
                  className="fp-haptic-settings-url-reset-btn"
                  onClick={() => this.handleIntifaceUrlChange('ws://localhost:12345')}
                  title="Reset to default"
                >
                  🔄
                </button>
              </div>
              <span className="fp-haptic-settings-url-status">
                {isConnected ? 
                  `✅ Connected to ${intifaceUrl}` : 
                  `⚠️ Not connected`
                }
              </span>
            </div>
            
            {/* Update Rate */}
            <div className="fp-haptic-settings-rate-control">
              <label className="fp-haptic-settings-rate-label">Update Rate</label>
              <select 
                className="fp-haptic-settings-rate-select"
                value={updateRate} 
                onChange={(e) => this.handleUpdateRateChange(parseInt(e.target.value))}
                title="Haptic command frequency (higher = smoother but more CPU)"
              >
                <option value={10}>10 Hz</option>
                <option value={30}>30 Hz</option>
                <option value={60}>60 Hz</option>
                <option value={90}>90 Hz</option>
                <option value={120}>120 Hz</option>
              </select>
              <span className="fp-haptic-settings-rate-info">
                {(1000/updateRate).toFixed(1)}ms interval
              </span>
            </div>
            
          </div>
        </div>

        {/* Divider */}
        <div className="fp-haptic-settings-divider"></div>

        {/* Section Master */}
        <div className="fp-haptic-settings-master-section">
          <h6 className="fp-haptic-settings-section-title">📊 Master</h6>
          
          {/* Global Scale + Global Offset */}
          <div className="fp-haptic-settings-master-controls">
            
            {/* Global Scale */}
            <div className="fp-haptic-settings-scale-control">
              <label className="fp-haptic-settings-scale-label">
                Global Scale: {((globalScale || 1) * 100).toFixed(0)}%
              </label>
              <div className="fp-haptic-settings-scale-input-group">
                <input
                  className="fp-haptic-settings-scale-range"
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={globalScale || 1}
                  onChange={(e) => this.handleGlobalScaleChange(parseFloat(e.target.value))}
                  title="Master intensity control for all actuators"
                />
                <input
                  className="fp-haptic-settings-scale-number"
                  type="number"
                  value={globalScale || 1}
                  onChange={(e) => this.handleGlobalScaleChange(parseFloat(e.target.value) || 1)}
                  step="0.01"
                  min="0"
                  max="2"
                />
              </div>
            </div>
            
            {/* Global Offset */}
            <div className="fp-haptic-settings-offset-control">
              <label className="fp-haptic-settings-offset-label">
                Global Offset: {((globalOffset || 0) * 1000).toFixed(0)}ms
              </label>
              <div className="fp-haptic-settings-offset-input-group">
                <input
                  className="fp-haptic-settings-offset-range"
                  type="range"
                  value={globalOffset || 0}
                  onChange={(e) => this.handleGlobalOffsetChange(parseFloat(e.target.value))}
                  min="-1"
                  max="1"
                  step="0.01"
                  title="Global timing offset for all actuators"
                />
                <input
                  className="fp-haptic-settings-offset-number"
                  type="number"
                  value={globalOffset || 0}
                  onChange={(e) => this.handleGlobalOffsetChange(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  min="-1"
                  max="1"
                />
              </div>
            </div>
            
          </div>
        </div>
        
        {/* Section Channel Configuration */}
        {funscriptChannels.length > 0 && (
          <>
            <div className="fp-haptic-settings-divider"></div>
            <div className="fp-haptic-settings-channels-header">
              <h6 className="fp-haptic-settings-section-title">🎼 Channels</h6>
            </div>
            <ChannelSettingsComponent core={this.core}/>
          </>
        )}

        {/* Section Actuators */}
        {funscriptChannels.length > 0 && (
          <>
            <div className="fp-haptic-settings-divider"></div>
            
            <div className="fp-haptic-settings-actuators-section">
              <div className="fp-haptic-settings-actuators-header">
                <h6 className="fp-haptic-settings-section-title">🎮 Actuators</h6>
                <button 
                  className="fp-haptic-settings-automap-btn"
                  onClick={this.handleAutoMap}
                >
                  Auto Map All ({actuators.length})
                </button>
              </div>
              
              <div className="fp-haptic-settings-actuators-list">
                {actuators.map(actuator => (
                  <ActuatorSettingsComponent
                    core={this.core}
                    key={actuator.index}
                    actuator={actuator}
                  />
                ))}
              </div>
            </div>
          </>
        )}
        
      </div>
    );
  }
}

export default HapticSettingsComponent;