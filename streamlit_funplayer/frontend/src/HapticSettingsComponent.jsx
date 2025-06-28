import React, { Component } from 'react';
import ButtPlugSettingsComponent from './ButtPlugSettingsComponent';
import ActuatorSettingsComponent from './ActuatorSettingsComponent';
import ChannelSettingsComponent from './ChannelSettingsComponent'; // ✅ NOUVEAU: Import du composant de config des canaux
import core from './FunPlayerCore';

/**
 * HapticSettingsComponent - ✅ NETTOYÉ: UI pure sans notifications
 * 
 * RESPONSABILITÉS SIMPLIFIÉES:
 * - Orchestrateur UI simple (ButtPlug + Actuators + Channel Settings)
 * - Appels directs core.xxx (pas d'indirections)
 * - Re-render intelligent sur événements globaux uniquement
 * - ✅ CLEAN: Pas de notifications status (c'est aux managers de le faire)
 * - Laisse les sous-composants gérer leurs propres événements granulaires
 */
class HapticSettingsComponent extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      isExpanded: false,
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
      this.props.onResize?.();
    });
  }

  handleAutoMap = () => {
    // Appel direct core - les notifications seront faites par FunPlayerCore
    const mapResult = core.autoMapChannels();
    console.log('Auto-map result:', mapResult);
  }

  handleUpdateRateChange = (newRate) => {
    // Délégation props (technique UI)
    this.props.onUpdateRateChange?.(newRate);
  }

  handleGlobalScaleChange = (scale) => {
    // Appel direct core - les notifications seront faites par ButtPlugManager
    core.buttplug.setGlobalScale(scale);
  }

  handleGlobalOffsetChange = (offset) => {
    // Appel direct core - les notifications seront faites par ButtPlugManager
    core.buttplug.setGlobalOffset(offset);
  }

  handleIntifaceUrlChange = (newUrl) => {
    // Appel direct core - les notifications seront faites par ButtPlugManager
    core.buttplug.setIntifaceUrl(newUrl);
  }

  // ============================================================================
  // RENDER SIMPLIFIÉ - Accès direct aux données via core
  // ============================================================================

  renderExpandedSettings() {
    if (!this.state.isExpanded) return null;
    
    // Accès direct core pour toutes les données globales
    const funscriptChannels = core.funscript.getChannelNames();
    const actuators = core.buttplug.getActuators();
    const updateRate = this.props.onGetUpdateRate?.() || 60;
    const globalOffset = core.buttplug.getGlobalOffset();
    const globalScale = core.buttplug.getGlobalScale();
    const intifaceUrl = core.buttplug.getIntifaceUrl();
    const isConnected = core.buttplug.getStatus()?.isConnected || false;
    
    return (
      <div className="fp-block fp-section">
        
        {/* Global Settings */}
        <div className="fp-layout-horizontal fp-mb-sm">
          <h6 className="fp-title">⚙️ Connection</h6>
        </div>
        
        {/* Intiface URL + Update Rate */}
        <div className="fp-layout-row fp-mb-lg">
          
          {/* Intiface WebSocket URL */}
          <div className="fp-layout-column fp-flex">
            <label className="fp-label">Intiface WebSocket URL</label>
            <div className="fp-layout-row">
              <input
                className="fp-input fp-flex"
                type="text"
                value={intifaceUrl}
                onChange={(e) => this.handleIntifaceUrlChange(e.target.value)}
                placeholder="ws://localhost:12345"
                title="WebSocket URL for Intiface Central connection"
              />
              <button
                className="fp-btn fp-btn-compact"
                onClick={() => this.handleIntifaceUrlChange('ws://localhost:12345')}
                title="Reset to default"
              >
                🔄
              </button>
            </div>
            <span className="fp-unit" style={{ fontSize: '0.7rem', opacity: 0.6 }}>
              {isConnected ? 
                `✅ Connected to ${intifaceUrl}` : 
                `⚠️ Not connected`
              }
            </span>
          </div>
          
          {/* Update Rate */}
          <div className="fp-layout-column fp-no-shrink" style={{ minWidth: '120px' }}>
            <label className="fp-label">Update Rate</label>
            <select 
              className="fp-input fp-select"
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
            <span className="fp-unit" style={{ fontSize: '0.7rem', opacity: 0.6 }}>
              {(1000/updateRate).toFixed(1)}ms interval
            </span>
          </div>
          
        </div>

        <div className="fp-divider"></div>

        <div className="fp-layout-horizontal fp-mb-sm">
          <h6 className="fp-title">📊 Master</h6>
        </div>
        
        {/* Global Scale + Global Offset */}
        <div className="fp-layout-row fp-mb-lg">
          
          {/* Global Scale */}
          <div className="fp-layout-column fp-flex">
            <label className="fp-label">
              Global Scale: {((globalScale || 1) * 100).toFixed(0)}%
            </label>
            <div className="fp-layout-row">
              <input
                className="fp-input fp-range fp-flex"
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={globalScale || 1}
                onChange={(e) => this.handleGlobalScaleChange(parseFloat(e.target.value))}
                title="Master intensity control for all actuators"
              />
              <input
                className="fp-input fp-input-number"
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
          <div className="fp-layout-column fp-flex">
            <label className="fp-label">
              Global Offset: {((globalOffset || 0) * 1000).toFixed(0)}ms
            </label>
            <div className="fp-layout-row">
              <input
                className="fp-input fp-range fp-flex"
                type="range"
                value={globalOffset || 0}
                onChange={(e) => this.handleGlobalOffsetChange(parseFloat(e.target.value))}
                min="-1"
                max="1"
                step="0.01"
                title="Global timing offset for all actuators"
              />
              <input
                className="fp-input fp-input-number"
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

        {/* ✅ NOUVEAU: Section Channel Configuration */}
        {funscriptChannels.length > 0 && (
          <>
            <div className="fp-divider"></div>
            <ChannelSettingsComponent onResize={this.props.onResize} />
          </>
        )}

        {/* Section actuators: Ne re-render que si structure change */}
        {funscriptChannels.length > 0 && (
          <>
            <div className="fp-divider"></div>
            
            <div className="fp-layout-horizontal fp-mb-sm">
              <h6 className="fp-title">🎮 Actuators</h6>
              <button 
                className="fp-btn fp-btn-compact"
                onClick={this.handleAutoMap}
              >
                Auto Map All ({actuators.length})
              </button>
            </div>
            
            <div className="fp-layout-column fp-layout-compact">
              {/* Boucle directe sur les instances 
                   Chaque ActuatorSettingsComponent gère ses propres événements granulaires */}
              {actuators.map(actuator => (
                <ActuatorSettingsComponent
                  key={actuator.index}
                  actuator={actuator}  // Instance directe
                  onResize={this.props.onResize}
                />
              ))}
            </div>
          </>
        )}
        
      </div>
    );
  }

  render() {
    const { isExpanded } = this.state;
    
    return (
      <div className="haptic-settings">
        
        {/* Barre principale */}
        <ButtPlugSettingsComponent
          onToggleSettings={this.handleToggleExpanded}
          isSettingsExpanded={isExpanded}
        />
        
        {/* Settings détaillés */}
        {this.renderExpandedSettings()}
        
      </div>
    );
  }
}

export default HapticSettingsComponent;