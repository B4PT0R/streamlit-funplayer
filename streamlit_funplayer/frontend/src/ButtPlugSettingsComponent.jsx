import React, { Component } from 'react';
import core from './FunPlayerCore';

/**
 * ButtPlugSettingsComponent - ✅ NETTOYÉ: UI pure sans notifications
 * 
 * RESPONSABILITÉS SIMPLIFIÉES:
 * - Barre horizontale compacte (status + actions)
 * - Appels directs core.xxx (pas d'indirections)
 * - Re-render sur événements choisis uniquement
 * - ✅ CLEAN: Pas de notifications status (c'est aux managers de le faire)
 */
class ButtPlugSettingsComponent extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      isAutoConnecting: false,
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
      const result = await core.autoConnect();
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
      await core.buttplug.disconnect();
    } catch (error) {
      console.error('Disconnection failed:', error);
    }
  }

  handleDeviceChange = (deviceIndex) => {
    try {
      const numericIndex = deviceIndex === '-1' ? -1 : parseInt(deviceIndex);
      // Appel direct core - les notifications seront faites par ButtPlugManager
      core.buttplug.selectDevice(numericIndex);
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
    
    const { isAutoConnecting } = this.state;
    
    // Accès direct core pour toutes les données
    const buttplugStatus = core.buttplug.getStatus();
    const funscriptChannels = core.funscript.getChannelNames();
    const devices = core.buttplug.getDevices();
    const selectedDevice = core.buttplug.getSelected();
    
    const isConnected = buttplugStatus?.isConnected || false;
    
    return (
      <div className="fp-section-compact fp-layout-horizontal">
        
        {/* Status + Device info */}
        <div className="fp-layout-row fp-flex">
          <span className="fp-status-dot">
            {isConnected ? '🟢' : '🔴'}
          </span>
          <span className="fp-label fp-device-name">
            {selectedDevice?.name || 'Unknown device'}
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
            className="fp-btn fp-btn-ghost fp-chevron"
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