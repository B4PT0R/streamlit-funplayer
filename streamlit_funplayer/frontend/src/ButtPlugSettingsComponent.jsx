import React, { Component } from 'react';

/**
 * ButtPlugSettingsComponent - ✅ NETTOYÉ: UI pure sans notifications
 * 
 * RESPONSABILITÉS SIMPLIFIÉES:
 * - Barre horizontale compacte (status + actions)
 * - Appels directs this.core.xxx (pas d'indirections)
 * - Re-render sur événements choisis uniquement
 * - ✅ CLEAN: Pas de notifications status (c'est aux managers de le faire)
 */
class ButtPlugSettingsComponent extends Component {
  constructor(props) {
    super(props);

    this.core=props.core
    
    this.state = {
      isAutoConnecting: false,
      isRescanActive: false,  // ✅ NOUVEAU: État pour le bouton rescan
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
  // GESTION D'ÉVÉNEMENTS SIMPLIFIÉE - Juste re-render
  // ============================================================================

  handleEvent = (event, data) => {
    const eventsToReact = [
      'buttplug:connection',
      'buttplug:device', 
      'funscript:load',
      'funscript:channels',
      'core:autoConnect'
    ];
    
    if (eventsToReact.some(e => event.startsWith(e.split(':')[0]))) {
      if (event === 'core:autoConnect') {
        this.setState({ isAutoConnecting: false });
      }
      
      this.setState(prevState => ({ 
        renderTrigger: prevState.renderTrigger + 1 
      }));
    }
  }

  // ============================================================================
  // ACTIONS SIMPLIFIÉES - Appels directs core, pas d'indirections
  // ============================================================================

  handleAutoConnect = async () => {
    this.setState({ isAutoConnecting: true });
    
    try {
      // Appel direct core - les notifications seront faites par les managers
      const result = await this.core.autoConnect();
      console.log('Auto-connect result:', result);
    } catch (error) {
      console.error('Auto-connect failed:', error);
    } finally {
      this.setState({ isAutoConnecting: false });
    }
  }

  handleDisconnect = async () => {
    try {
      // Appel direct core - les notifications seront faites par ButtPlugManager
      await this.core.buttplug.disconnect();
    } catch (error) {
      console.error('Disconnection failed:', error);
    }
  }

  // ✅ NOUVEAU: Bouton rescan pour chercher de nouveaux devices
  handleRescan = async () => {
    this.setState({ isRescanActive: true });
    
    try {
      // Appel direct this.core.buttplug.scan()
      const newDevices = await this.core.buttplug.scan();
      console.log('Rescan result:', newDevices);
    } catch (error) {
      console.error('Rescan failed:', error);
    } finally {
      this.setState({ isRescanActive: false });
    }
  }

  handleDeviceChange = (deviceIndex) => {
    try {
      const numericIndex = deviceIndex === '-1' ? -1 : parseInt(deviceIndex);
      // Appel direct core - les notifications seront faites par ButtPlugManager
      this.core.buttplug.selectDevice(numericIndex);
    } catch (error) {
      console.error('Device selection failed:', error);
    }
  }

  // ============================================================================
  // RENDER SIMPLIFIÉ - Accès direct aux données via core
  // ============================================================================

  render() {
    const { 
      onToggleSettings, 
      isSettingsExpanded 
    } = this.props;
    
    const { isAutoConnecting, isRescanActive } = this.state;
    
    // Accès direct core pour toutes les données
    const buttplugStatus = this.core.buttplug.getStatus();
    const funscriptChannels = this.core.funscript.getChannelNames();
    const devices = this.core.buttplug.getDevices();
    const selectedDevice = this.core.buttplug.getSelected();
    
    const isConnected = buttplugStatus?.isConnected || false;
    
    return (
      <div className="fp-buttplug-settings">
        
        {/* Zone status à gauche */}
        <div className="fp-buttplug-settings-status">
          <span className="fp-buttplug-settings-connection-dot">
            {isConnected ? '🟢' : '🔴'}
          </span>
          <span className="fp-buttplug-settings-device-name">
            {selectedDevice?.name || 'Unknown device'}
          </span>
          {funscriptChannels.length === 0 && (
            <span className="fp-buttplug-settings-no-haptic-hint">
              No haptic
            </span>
          )}
        </div>
        
        {/* Zone actions à droite */}
        <div className="fp-buttplug-settings-actions">
          
          {/* Connect/Disconnect */}
          {!isConnected ? (
            <button 
              className="fp-buttplug-settings-connect-btn"
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
            <>
              <button 
                className="fp-buttplug-settings-disconnect-btn"
                onClick={this.handleDisconnect}
              >
                🔌 Disconnect
              </button>
              
              {/* Bouton rescan */}
              <button
                className="fp-buttplug-settings-rescan-btn"
                onClick={this.handleRescan}
                disabled={isRescanActive}
                title="Scan for new devices"
              >
                {isRescanActive ? '🔄' : '🔍'}
              </button>
            </>
          )}
          
          {/* Device selector */}
          <select
            className="fp-buttplug-settings-device-select"
            value={selectedDevice?.index ?? -1}
            onChange={(e) => this.handleDeviceChange(e.target.value)}
            disabled={funscriptChannels.length === 0}
            title={funscriptChannels.length === 0 ? 
              "Load funscript first" : 
              "Select haptic device"}
          >
            {devices.map(device => (
              <option key={device.index} value={device.index}>
                {device.name} {device.index === -1 ? '(Virtual)' : ''}
              </option>
            ))}
          </select>
          
          {/* Settings toggle */}
          <button
            className="fp-buttplug-settings-toggle"
            onClick={onToggleSettings}
            title={isSettingsExpanded ? "Hide haptic settings" : "Show haptic settings"}
          >
            {isSettingsExpanded ? '▲' : '▼'}
          </button>
        </div>
        
      </div>
    );
  }
}

export default ButtPlugSettingsComponent;