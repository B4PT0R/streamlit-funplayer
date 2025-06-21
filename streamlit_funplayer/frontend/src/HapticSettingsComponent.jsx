import React, { Component } from 'react';
import ButtPlugSettingsComponent from './ButtPlugSettingsComponent';
import ChannelSettingsComponent from './ChannelSettingsComponent';

class HapticSettingsComponent extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isExpanded: false  // État d'expansion des settings détaillés
    };
  }

  // ============================================================================
  // GETTERS STATELESS
  // ============================================================================

  getFunscriptChannels = () => {
    const manager = this.props.funscriptManagerRef?.current;
    return manager?.getChannels() || [];
  }

  getButtplugCapabilities = () => {
    const manager = this.props.buttplugManagerRef?.current;
    return manager?.getCapabilities();
  }

  getUpdateRate = () => {
    return this.props.onGetUpdateRate?.() || 60;
  }

  getGlobalOffset = () => {
    const manager = this.props.funscriptManagerRef?.current;
    return manager?.getGlobalOffset() || 0;
  }

  // ============================================================================
  // ACTIONS
  // ============================================================================

  handleToggleExpanded = () => {
    this.setState({ isExpanded: !this.state.isExpanded }, () => {
      // ✅ AJOUT: Trigger refresh après toggle settings
      if (this.props.onResize) {
        this.props.onResize();
      }
    });
  }

  handleAutoMap = () => {
    const funscriptManager = this.props.funscriptManagerRef?.current;
    
    if (!funscriptManager) return;
    
    // ✅ SIMPLIFIÉ: Utilise la nouvelle méthode du FunscriptManager
    const capabilities = this.getButtplugCapabilities();
    const mapResult = funscriptManager.autoMapChannels(capabilities);
    
    this.forceUpdate(); // Refresh UI
    
    // Callback pour status
    this.props.onSettingsChange?.(null, 'autoMap', mapResult);
  }

  handleUpdateRateChange = (newRate) => {
    this.props.onUpdateRateChange?.(newRate);
  }

  handleGlobalOffsetChange = (offset) => {
    const manager = this.props.funscriptManagerRef?.current;
    if (!manager) return;
    
    manager.setGlobalOffset(offset);
    this.forceUpdate(); // Refresh UI
    this.props.onSettingsChange?.(null, 'globalOffset', offset);
  }

  handleChannelSettingsChange = (channel, key, value) => {
    const manager = this.props.funscriptManagerRef?.current;
    if (!manager) return;
    
    manager.setOptions(channel, { [key]: value });
    this.forceUpdate(); // Refresh UI
    this.props.onSettingsChange?.(channel, key, value);
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  renderExpandedSettings() {
    if (!this.state.isExpanded) return null;
    
    const channels = this.getFunscriptChannels();
    const capabilities = this.getButtplugCapabilities();
    const updateRate = this.getUpdateRate();
    const globalOffset = this.getGlobalOffset();
    
    return (
      <div className="fp-block fp-section">
        
        {/* ✅ SECTION GLOBAL SETTINGS */}
        <div className="fp-layout-horizontal fp-mb-sm">
          <h6 className="fp-title">⚙️ Global Settings</h6>
        </div>
        
        <div className="fp-layout-row fp-mb-lg">
          
          {/* Update Rate */}
          <div className="fp-layout-column fp-flex">
            <label className="fp-label">Update Rate</label>
            <select 
              className="fp-input fp-select"
              value={updateRate} 
              onChange={(e) => this.handleUpdateRateChange(parseInt(e.target.value))}
            >
              <option value={30}>30 Hz</option>
              <option value={60}>60 Hz</option>
              <option value={90}>90 Hz</option>
              <option value={120}>120 Hz</option>
            </select>
          </div>
          
          {/* Global Offset */}
          <div className="fp-layout-column fp-flex">
            <label className="fp-label">
              Global Offset ({(globalOffset * 1000).toFixed(0)}ms)
            </label>
            <div className="fp-layout-row">
              <input
                className="fp-input fp-range fp-flex"
                type="range"
                value={globalOffset}
                onChange={(e) => this.handleGlobalOffsetChange(parseFloat(e.target.value))}
                min="-1"
                max="1"
                step="0.01"
              />
              <input
                className="fp-input fp-input-number"
                type="number"
                value={globalOffset}
                onChange={(e) => this.handleGlobalOffsetChange(parseFloat(e.target.value) || 0)}
                step="0.01"
                min="-1"
                max="1"
              />
            </div>
          </div>
          
        </div>

        {/* ✅ SECTION CHANNEL MAPPING */}
        {channels.length > 0 && (
          <>
            <div className="fp-divider"></div>
            
            <div className="fp-layout-horizontal fp-mb-sm">
              <h6 className="fp-title">🎯 Channel Mapping</h6>
              <button 
                className="fp-btn fp-btn-compact"
                onClick={this.handleAutoMap}
              >
                Auto Map All ({channels.length})
              </button>
            </div>
            
            <div className="fp-layout-column fp-layout-compact">
              {channels.map(channel => (
                <ChannelSettingsComponent
                  key={channel}
                  channel={channel}
                  funscriptManagerRef={this.props.funscriptManagerRef}
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
    const { isExpanded } = this.state;
    
    return (
      <div className="haptic-settings">
        
        {/* Barre principale unique */}
        <ButtPlugSettingsComponent
          buttplugRef={this.props.buttplugManagerRef}
          funscriptManagerRef={this.props.funscriptManagerRef}
          onStatusChange={this.props.onStatusChange}
          onAutoConnect={this.handleAutoMap}
          onDeviceSelect={(deviceIndex) => {
            if (deviceIndex !== null) this.handleAutoMap();
          }}
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