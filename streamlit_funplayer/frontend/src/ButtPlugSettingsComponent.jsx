import React, { Component } from 'react';
import managers from './Managers'; // ✅ SEULE IMPORT du singleton

/**
 * ButtPlugSettingsComponent - ✅ REFACTORISÉ: API Managers unifiée
 * Plus aucune référence locale aux managers, tout passe par le singleton
 */
class ButtPlugSettingsComponent extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      isAutoConnecting: false,
      renderTrigger: 0
    };
    
    this.managersListener = null;
  }

  componentDidMount() {
    // ✅ Écouter les événements pour re-render
    this.managersListener = managers.addListener(this.handleManagerEvent);
  }

  componentWillUnmount() {
    if (this.managersListener) {
      this.managersListener();
      this.managersListener = null;
    }
  }

  // ============================================================================
  // ✅ GESTION D'ÉVÉNEMENTS AVEC API MANAGERS UNIFIÉE
  // ============================================================================

  handleManagerEvent = (event, data) => {
    // ✅ Re-render sur événements qui impactent ce composant
    const eventsToReact = [
      'buttplug:connection',     // État de connexion changé
      'buttplug:device',         // Device sélectionné changé
      'funscript:load',          // Funscript chargé (impact les boutons)
      'funscript:channels',      // Canaux changés (impact les boutons)
      'managers:autoConnect'     // AutoConnect terminé
    ];
    
    if (eventsToReact.some(e => event.startsWith(e.split(':')[0]))) {
      // ✅ Trigger re-render via setState
      this.setState(prevState => ({ 
        renderTrigger: prevState.renderTrigger + 1 
      }));
      
      // ✅ Gérer la fin d'autoConnect
      if (event === 'managers:autoConnect') {
        this.setState({ isAutoConnecting: false });
      }
    }
  }

  // ============================================================================
  // ✅ GETTERS AVEC API MANAGERS UNIFIÉE (remplace les props)
  // ============================================================================

  getButtPlugStatus = () => {
    // ✅ MODIFIÉ: Accès direct via le singleton
    return managers.buttplug?.getStatus() || { isConnected: false };
  }

  getFunscriptChannels = () => {
    // ✅ MODIFIÉ: Accès direct via le singleton
    return managers.funscript?.getChannels() || [];
  }

  getDevices = () => {
    // ✅ MODIFIÉ: Accès direct via le singleton
    return managers.buttplug?.getDevices() || [];
  }

  getSelectedDevice = () => {
    // ✅ MODIFIÉ: Accès direct via le singleton
    return managers.buttplug?.getSelected() || null;
  }

  // ✅ SUPPRIMÉ: Plus de propriété computed buttplug
  // get buttplug() { return managers.buttplug; } // ❌

  // ============================================================================
  // ✅ ACTIONS - Appels directs au singleton
  // ============================================================================

  handleAutoConnect = async () => {
    if (this.state.isAutoConnecting) return;

    this.setState({ isAutoConnecting: true });
    
    try {
      // ✅ MODIFIÉ: Appel direct à managers au lieu de prop callback
      await managers.autoConnect(3000);
      // ✅ L'événement 'managers:autoConnect' gérera le setState isAutoConnecting
      
    } catch (error) {
      console.error('AutoConnect failed:', error);
      this.setState({ isAutoConnecting: false });
    }
  }

  handleDisconnect = async () => {
    try {
      // ✅ MODIFIÉ: Accès direct via le singleton
      if (managers.buttplug) {
        await managers.buttplug.disconnect();
        // ✅ L'événement 'buttplug:connection' sera déclenché automatiquement
      }
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  }

  handleDeviceChange = async (deviceIndex) => {
    try {
      // ✅ MODIFIÉ: Accès direct via le singleton
      if (managers.buttplug) {
        const numericIndex = deviceIndex === '' ? null : parseInt(deviceIndex);
        const success = managers.buttplug.selectDevice(numericIndex);
        
        if (success && numericIndex !== null) {
          // Auto-map après sélection
          managers.autoMapChannels();
          // ✅ Les événements 'buttplug:device' et 'managers:autoMap' seront déclenchés
        }
      }
    } catch (error) {
      console.error('Device selection failed:', error);
    }
  }

  // ============================================================================
  // ✅ RENDER - Utilise les getters avec API Managers unifiée
  // ============================================================================

  render() {
    const { 
      onToggleSettings, 
      isSettingsExpanded 
    } = this.props;
    
    // ✅ MODIFIÉ: Données récupérées via getters avec API Managers unifiée
    const { isAutoConnecting } = this.state;
    const buttplugStatus = this.getButtPlugStatus();
    const funscriptChannels = this.getFunscriptChannels();
    const devices = this.getDevices();
    const selectedDevice = this.getSelectedDevice();
    
    const isConnected = buttplugStatus?.isConnected || false;
    
    return (
      <div className="fp-section-compact fp-layout-horizontal">
        
        {/* Status + Device info */}
        <div className="fp-layout-row fp-flex">
          <span className="fp-status-dot">
            {isConnected ? '🟢' : '🔴'}
          </span>
          <span className="fp-label fp-device-name">
            {selectedDevice?.name || 'No device'}
          </span>
          {funscriptChannels.length === 0 && (
            <span className="fp-unit" style={{ opacity: 0.5 }}>
              No haptic
            </span>
          )}
        </div>
        
        {/* Actions */}
        <div className="fp-layout-row fp-no-shrink">
          
          {/* Connect/Disconnect */}
          {!isConnected ? (
            <button 
              className="fp-btn fp-btn-primary"
              onClick={this.handleAutoConnect}
              disabled={isAutoConnecting || funscriptChannels.length === 0}
              title={funscriptChannels.length === 0 ? "Load funscript first" : "Connect to Intiface Central"}
            >
              {isAutoConnecting ? (
                <>🔄 Connecting...</>
              ) : (
                <>🔌 Connect</>
              )}
            </button>
          ) : (
            <button 
              className="fp-btn fp-btn-primary"
              onClick={this.handleDisconnect}
            >
              🔌 Disconnect
            </button>
          )}
          
          {/* Device selector */}
          <select
            className="fp-input fp-select fp-min-width"
            value={selectedDevice?.index ?? ''}
            onChange={(e) => this.handleDeviceChange(e.target.value)}
            disabled={funscriptChannels.length === 0}
            title={funscriptChannels.length === 0 ? "Load funscript first" : "Select device"}
          >
            <option value="">Virtual</option>
            {devices.map(device => (
              <option key={device.index} value={device.index}>
                {device.name}
              </option>
            ))}
          </select>
          
          {/* Settings toggle */}
          {onToggleSettings && funscriptChannels.length > 0 && (
            <button 
              className="fp-btn fp-btn-ghost fp-chevron"
              onClick={onToggleSettings}
            >
              {isSettingsExpanded ? '▲' : '▼'}
            </button>
          )}
          
        </div>
      </div>
    );
  }
}

export default ButtPlugSettingsComponent;