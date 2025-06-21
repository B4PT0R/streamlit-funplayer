import React, { Component } from 'react';

class ButtPlugSettingsComponent extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // ✅ SEULS ÉTATS UI - Pas de données métier
      isAutoConnecting: false
    };
  }

  // ============================================================================
  // GETTERS DIRECTS DEPUIS LE MANAGER (stateless)
  // ============================================================================

  getButtplugState = () => {
    const manager = this.props.buttplugRef?.current;
    return {
      isConnected: manager?.isConnected || false,
      devices: manager?.getDevices() || [],
      selectedDevice: manager?.getSelected(),
      capabilities: manager?.getCapabilities(),
      isScanning: manager?.isScanning || false
    };
  }

  getFunscriptState = () => {
    const manager = this.props.funscriptManagerRef?.current;
    return {
      channels: manager?.getChannels() || [],
      duration: manager?.getDuration() || 0
    };
  }

  // ============================================================================
  // ACTIONS SUR LE MANAGER (stateless)
  // ============================================================================

  handleAutoConnect = async () => {
    const manager = this.props.buttplugRef?.current;
    if (!manager || this.state.isAutoConnecting) return;

    this.setState({ isAutoConnecting: true });
    this.props.onStatusChange?.('Connecting to Intiface...');
    
    try {
      // 1. Connect to Intiface
      const connected = await manager.connect();
      if (!connected) {
        this.props.onStatusChange?.('Failed to connect to Intiface');
        return;
      }
      
      this.props.onStatusChange?.('Scanning for devices...');
      
      // 2. Scan for devices (3 secondes)
      const devices = await manager.scan(3000);
      if (!devices || devices.length === 0) {
        this.props.onStatusChange?.('No devices found');
        return;
      }
      
      this.props.onStatusChange?.(`Found ${devices.length} device(s), selecting first...`);
      
      // 3. Auto-select first device
      const selectSuccess = await manager.selectDevice(devices[0].index);
      if (!selectSuccess) {
        this.props.onStatusChange?.('Failed to select device');
        return;
      }
      
      // 4. Trigger auto-map channels (via callback)
      this.props.onAutoConnect?.();
      
      const deviceName = devices[0].name || 'Unknown device';
      this.props.onStatusChange?.(`Connected to ${deviceName} and auto-mapped channels`);
      
      this.forceUpdate(); // Trigger re-render
      
    } catch (error) {
      console.error('AutoConnect failed:', error);
      this.props.onStatusChange?.('AutoConnect failed');
    } finally {
      this.setState({ isAutoConnecting: false });
    }
  }

  handleDisconnect = async () => {
    const manager = this.props.buttplugRef?.current;
    if (!manager) return;

    try {
      await manager.disconnect();
      this.forceUpdate(); // Trigger re-render
      this.props.onStatusChange?.('Disconnected from Intiface');
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  }

  handleDeviceChange = async (deviceIndex) => {
    const manager = this.props.buttplugRef?.current;
    if (!manager) return;

    try {
      const success = await manager.selectDevice(deviceIndex);
      if (success) {
        this.forceUpdate(); // Trigger re-render
        this.props.onDeviceSelect?.(deviceIndex);
        
        if (deviceIndex !== null) {
          const devices = this.getButtplugState().devices;
          const device = devices.find(d => d.index === deviceIndex);
          this.props.onStatusChange?.(`Selected: ${device?.name || 'Unknown device'}`);
        }
      }
    } catch (error) {
      console.error('Device selection failed:', error);
    }
  }

  // ============================================================================
  // RENDER MAIN BAR (Layout identique à l'ancienne barre principale)
  // ============================================================================

  render() {
    const { isConnected, selectedDevice, devices } = this.getButtplugState();
    const { channels } = this.getFunscriptState();
    const { isAutoConnecting } = this.state;
    
    // ✅ MODIFIÉ: Toujours afficher, même sans funscript
    // Adapte juste les contrôles selon la présence de channels
    
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
          {/* ✅ AJOUT: Indication channels même sans funscript */}
          {channels.length === 0 && (
            <span className="fp-unit" style={{ opacity: 0.5 }}>
              No haptic
            </span>
          )}
        </div>
        
        {/* Actions */}
        <div className="fp-layout-row fp-no-shrink">
          
          {/* Connect/Disconnect - toujours présent */}
          {!isConnected ? (
            <button 
              className="fp-btn fp-btn-primary"
              onClick={this.handleAutoConnect}
              disabled={isAutoConnecting || channels.length === 0}
              title={channels.length === 0 ? "Load funscript first" : "Connect to Intiface Central"}
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
          
          {/* Device selector - toujours présent */}
          <select
            className="fp-input fp-select fp-min-width"
            value={selectedDevice?.index ?? ''}
            onChange={(e) => {
              const value = e.target.value === '' ? null : parseInt(e.target.value);
              this.handleDeviceChange(value);
            }}
            disabled={channels.length === 0}
            title={channels.length === 0 ? "Load funscript first" : "Select device"}
          >
            <option value="">Virtual</option>
            {devices.map(device => (
              <option key={device.index} value={device.index}>
                {device.name}
              </option>
            ))}
          </select>
          
          {/* Settings toggle - conditionnel sur la présence de channels */}
          {this.props.onToggleSettings && channels.length > 0 && (
            <button 
              className="fp-btn fp-btn-ghost fp-chevron"
              onClick={this.props.onToggleSettings}
            >
              {this.props.isSettingsExpanded ? '▲' : '▼'}
            </button>
          )}
          
        </div>
      </div>
    );
  }
}

export default ButtPlugSettingsComponent;