import React, { Component } from 'react';
import managers from './Managers';

/**
 * ButtPlugSettingsComponent - ✅ REFACTORISÉ: Réactif aux événements
 * Plus de props redondantes, accès direct aux managers + événements
 */
class ButtPlugSettingsComponent extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      isAutoConnecting: false,
      renderTrigger: 0  // ✅ NOUVEAU: Trigger pour re-render
    };
    
    this.managersListener = null;
  }

  componentDidMount() {
    // ✅ NOUVEAU: Écouter les événements pour re-render
    this.managersListener = managers.addListener(this.handleManagerEvent);
  }

  componentWillUnmount() {
    if (this.managersListener) {
      this.managersListener();
    }
  }

  // ============================================================================
  // ✅ NOUVEAU: GESTION D'ÉVÉNEMENTS
  // ============================================================================

  handleManagerEvent = (event, data) => {
    // ✅ NOUVEAU: Re-render sur événements qui impactent ce composant
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
      
      // ✅ NOUVEAU: Gérer la fin d'autoConnect
      if (event === 'managers:autoConnect') {
        this.setState({ isAutoConnecting: false });
      }
    }
  }

  // ============================================================================
  // ✅ NOUVEAU: GETTERS - Accès direct aux managers (remplace les props)
  // ============================================================================

  getButtPlugStatus = () => {
    // ✅ Accès direct via la propriété computed du manager
    return this.buttplug?.getStatus() || { isConnected: false };
  }

  getFunscriptChannels = () => {
    const funscript = managers.getFunscript();
    return funscript?.getChannels() || [];
  }

  getDevices = () => {
    return this.buttplug?.getDevices() || [];
  }

  getSelectedDevice = () => {
    return this.buttplug?.getSelected() || null;
  }

  // ✅ NOUVEAU: Propriété computed pour buttplug (avec cache)
  get buttplug() {
    return managers.buttplug;
  }

  // ============================================================================
  // ✅ MODIFIÉ: ACTIONS - Appels directs au lieu de callbacks props
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
      // ✅ MODIFIÉ: Accès direct via propriété computed
      if (this.buttplug) {
        await this.buttplug.disconnect();
        // ✅ L'événement 'buttplug:connection' sera déclenché automatiquement
      }
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  }

  handleDeviceChange = async (deviceIndex) => {
    try {
      // ✅ MODIFIÉ: Accès direct via propriété computed  
      if (this.buttplug) {
        const numericIndex = deviceIndex === '' ? null : parseInt(deviceIndex);
        const success = this.buttplug.selectDevice(numericIndex);
        
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
  // ✅ MODIFIÉ: RENDER - Utilise les getters au lieu des props
  // ============================================================================

  render() {
    const { 
      onToggleSettings, 
      isSettingsExpanded 
    } = this.props;
    
    // ✅ MODIFIÉ: Données récupérées via getters au lieu de props
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