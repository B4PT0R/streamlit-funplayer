import React, { Component } from 'react';
import ButtPlugSettingsComponent from './ButtPlugSettingsComponent';
import ChannelSettingsComponent from './ChannelSettingsComponent';
import managers from './Managers';

/**
 * HapticSettingsComponent - ✅ REFACTORISÉ: État réactif aux événements
 * Plus de state local redondant, accès direct aux managers + re-render sur événements
 */
class HapticSettingsComponent extends Component {
  constructor(props) {
    super(props);
    
    // ✅ SIMPLIFIÉ: State minimal, juste pour l'UI
    this.state = {
      isExpanded: false,
      renderTrigger: 0  // ✅ NOUVEAU: Trigger pour re-render
    };
    
    this.managersListener = null;
  }

  componentDidMount() {
    // ✅ SIMPLIFIÉ: Écouter seulement les événements pour re-render
    this.managersListener = managers.addListener(this.handleManagerEvent);
  }

  componentWillUnmount() {
    if (this.managersListener) {
      this.managersListener();
    }
  }

  // ============================================================================
  // ✅ NOUVEAU: GESTION D'ÉVÉNEMENTS SIMPLIFIÉE
  // ============================================================================

  handleManagerEvent = (event, data) => {
    // ✅ NOUVEAU: Re-render sur tous les événements qui impactent l'UI
    const eventsToReact = [
      'buttplug:connection',
      'buttplug:device', 
      'funscript:load',
      'funscript:channels',
      'funscript:options',
      'managers:autoConnect',
      'managers:autoMap'
    ];
    
    if (eventsToReact.some(e => event.startsWith(e.split(':')[0]))) {
      // ✅ NOUVEAU: Trigger re-render via setState au lieu de forceUpdate()
      this.setState(prevState => ({ 
        renderTrigger: prevState.renderTrigger + 1 
      }));
      
      // ✅ Optionnel: Log pour debug (à supprimer en prod)
      console.log(`HapticSettings: Reacting to ${event}`, data);
    }
  }

  // ============================================================================
  // ✅ NOUVEAU: GETTERS DIRECTS VERS MANAGERS (pour les settings expandés seulement)
  // ============================================================================

  getIntifaceUrl = () => {
    return this.buttplug?.getIntifaceUrl() || 'ws://localhost:12345';
  }

  getFunscriptChannels = () => {
    const funscript = managers.getFunscript();
    return funscript?.getChannels() || [];
  }

  getCapabilities = () => {
    return this.buttplug?.getCapabilities() || null;
  }

  getGlobalScale = () => {
    const funscript = managers.getFunscript();
    return funscript?.getGlobalScale() || 1.0;
  }

  // ✅ NOUVEAU: Propriété computed pour buttplug (avec cache)
  get buttplug() {
    return managers.buttplug;
  }

  // ============================================================================
  // ACTIONS - ✅ MODIFIÉ: Seulement les actions locales
  // ============================================================================

  handleIntifaceUrlChange = (newUrl) => {
    if (this.buttplug) {
      this.buttplug.setIntifaceUrl(newUrl);
      // ✅ L'événement 'buttplug:config' sera déclenché automatiquement
      this.props.onSettingsChange?.(null, 'intifaceUrl', newUrl);
    }
  }

  handleToggleExpanded = () => {
    this.setState({ isExpanded: !this.state.isExpanded }, () => {
      this.props.onResize?.();
    });
  }

  handleAutoMap = () => {
    const mapResult = managers.autoMapChannels();
    this.props.onSettingsChange?.(null, 'autoMap', mapResult);
  }

  handleUpdateRateChange = (newRate) => {
    this.props.onUpdateRateChange?.(newRate);
  }

  handleGlobalScaleChange = (scale) => {
    const funscript = managers.getFunscript();
    funscript.setGlobalScale(scale);
    // ✅ L'événement 'funscript:globalScale' sera déclenché automatiquement
    this.props.onSettingsChange?.(null, 'globalScale', scale);
  }

  handleGlobalOffsetChange = (offset) => {
    const funscript = managers.getFunscript();
    funscript.setGlobalOffset(offset);
    // ✅ L'événement 'funscript:globalOffset' sera déclenché automatiquement
    this.props.onSettingsChange?.(null, 'globalOffset', offset);
  }

  handleChannelSettingsChange = (channel, key, value) => {
    const funscript = managers.getFunscript();
    funscript.setOptions(channel, { [key]: value });
    // ✅ L'événement 'funscript:options' sera déclenché automatiquement
    this.props.onSettingsChange?.(channel, key, value);
  }

  // ============================================================================
  // GETTERS - ✅ MODIFIÉ: Accès direct aux managers
  // ============================================================================

  getUpdateRate = () => {
    return this.props.onGetUpdateRate?.() || 60;
  }

  getGlobalOffset = () => {
    const funscript = managers.getFunscript();
    return funscript?.getGlobalOffset() || 0;
  }

  // ============================================================================
  // RENDER - ✅ MODIFIÉ: Utilise les getters au lieu du state
  // ============================================================================

  renderExpandedSettings() {
    if (!this.state.isExpanded) return null;
    
    const funscriptChannels = this.getFunscriptChannels();
    const capabilities = this.getCapabilities();
    const updateRate = this.getUpdateRate();
    const globalOffset = this.getGlobalOffset();
    const globalScale = this.getGlobalScale();
    const intifaceUrl = this.getIntifaceUrl();
    
    return (
      <div className="fp-block fp-section">
        
        {/* Global Settings */}
        <div className="fp-layout-horizontal fp-mb-sm">
          <h6 className="fp-title">⚙️ Connection</h6>
        </div>
        
        {/* ✅ MODIFIÉ: Intiface URL + Update Rate - Same line for compactness */}
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
              {this.buttplug?.isConnected ? 
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
              <option value={30}>10 Hz</option>
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

        {/* ✅ NOUVEAU: Divider to separate connection settings from haptic controls */}
        <div className="fp-divider"></div>

        <div className="fp-layout-horizontal fp-mb-sm">
          <h6 className="fp-title">🎛️ Master</h6>
        </div>
        
        {/* Global Scale + Global Offset - Haptic control sliders */}
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
                title="Master intensity control for all channels"
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
                title="Global timing offset for all channels"
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

        {/* Channel Mapping section continues unchanged... */}
        {funscriptChannels.length > 0 && (
          <>
            <div className="fp-divider"></div>
            
            <div className="fp-layout-horizontal fp-mb-sm">
              <h6 className="fp-title">🎯 Channels</h6>
              <button 
                className="fp-btn fp-btn-compact"
                onClick={this.handleAutoMap}
              >
                Auto Map All ({funscriptChannels.length})
              </button>
            </div>
            
            <div className="fp-layout-column fp-layout-compact">
              {funscriptChannels.map(channel => (
                <ChannelSettingsComponent
                  key={channel}
                  channel={channel}
                  capabilities={capabilities}
                  onSettingsChange={this.handleChannelSettingsChange}
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
    // ✅ MODIFIÉ: Seul l'état local UI est nécessaire
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