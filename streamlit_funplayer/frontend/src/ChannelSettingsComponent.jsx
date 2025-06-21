import React, { Component } from 'react';

class ChannelSettingsComponent extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // ✅ SEUL ÉTAT UI - Collapsé par défaut
      isExpanded: false
    };
  }

  // ============================================================================
  // ACTIONS SUR LE FUNSCRIPT MANAGER (stateless)
  // ============================================================================

  updateChannelOption = (key, value) => {
    const { channel, funscriptManagerRef, onSettingsChange } = this.props;
    const funscriptManager = funscriptManagerRef?.current;
    
    if (!funscriptManager) return;
    
    funscriptManager.setOptions(channel, { [key]: value });
    onSettingsChange?.(channel, key, value);
  }

  resetChannel = () => {
    const { channel, funscriptManagerRef, onSettingsChange } = this.props;
    const funscriptManager = funscriptManagerRef?.current;
    
    if (!funscriptManager) return;
    
    funscriptManager.resetOptions(channel);
    onSettingsChange?.(channel, 'reset', null);
  }

  // ============================================================================
  // GETTERS DIRECTS DEPUIS LES MANAGERS (stateless)
  // ============================================================================

  getChannelOptions = () => {
    const { channel, funscriptManagerRef } = this.props;
    const funscriptManager = funscriptManagerRef?.current;
    return funscriptManager?.getOptions(channel) || {};
  }

  getActuatorOptions = () => {
    const { capabilities } = this.props;
    
    if (capabilities && capabilities.actuators.length > 0) {
      // Device connecté - actuateurs réels
      return capabilities.actuators.map((caps, index) => {
        const types = [];
        if (caps.vibrate) types.push('vibrate');
        if (caps.oscillate) types.push('oscillate');
        if (caps.linear) types.push('linear');
        if (caps.rotate) types.push('rotate');
        
        return {
          index,
          label: `#${index} (${types.join(', ')})`,
          value: index
        };
      });
    } else {
      // Pas de device - actuateurs virtuels
      return [
        { index: 0, label: '#0 (linear)', value: 0 },
        { index: 1, label: '#1 (vibrate)', value: 1 },
        { index: 2, label: '#2 (rotate)', value: 2 },
        { index: 3, label: '#3 (oscillate)', value: 3 }
      ];
    }
  }

  // ============================================================================
  // RENDER METHODS
  // ============================================================================

  handleToggleExpanded = () => {
    this.setState({ isExpanded: !this.state.isExpanded }, () => {
      // ✅ AJOUT: Trigger refresh après toggle settings
      if (this.props.onResize) {
        this.props.onResize();
      }
    });
  }

  renderCompactLine() {
    const { channel } = this.props;
    const options = this.getChannelOptions();
    const actuatorOptions = this.getActuatorOptions();
    const { isExpanded } = this.state;
    
    return (
      <div className="fp-compact-line">
        
        {/* Channel name */}
        <span className="fp-badge fp-no-shrink">
          {channel}
        </span>
        
        {/* Enable toggle */}
        <label className="fp-toggle">
          <input
            className="fp-checkbox"
            type="checkbox"
            checked={options.enabled || false}
            onChange={(e) => this.updateChannelOption('enabled', e.target.checked)}
          />
        </label>
        
        {/* Actuator selector */}
        <select
          className="fp-input fp-select fp-flex"
          value={options.actuatorIndex ?? ''}
          onChange={(e) => {
            const value = e.target.value === '' ? null : parseInt(e.target.value);
            this.updateChannelOption('actuatorIndex', value);
          }}
          disabled={!options.enabled}
        >
          <option value="">None</option>
          {actuatorOptions.map((opt) => (
            <option key={opt.index} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        
        {/* Expand toggle */}
        <button 
          className="fp-btn fp-btn-ghost fp-chevron"
          onClick={this.handleToggleExpanded}
        >
          {isExpanded ? '▲' : '▼'}
        </button>
        
      </div>
    );
  }

  renderExpandedSettings() {
    if (!this.state.isExpanded) return null;
    
    const options = this.getChannelOptions();

    return (
      <div className="fp-expanded fp-layout-column fp-layout-compact">
        
        {/* Scale */}
        <div className="fp-layout-column">
          <label className="fp-label">
            Scale: {((options.scale || 1) * 100).toFixed(0)}%
          </label>
          <input
            className="fp-input fp-range"
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={options.scale || 1}
            onChange={(e) => this.updateChannelOption('scale', parseFloat(e.target.value))}
            disabled={!options.enabled}
          />
        </div>

        {/* Time Offset */}
        <div className="fp-layout-column">
          <label className="fp-label">
            Time Offset: {((options.timeOffset || 0) * 1000).toFixed(0)}ms
          </label>
          <input
            className="fp-input fp-range"
            type="range"
            min="-0.5"
            max="0.5"
            step="0.001"
            value={options.timeOffset || 0}
            onChange={(e) => this.updateChannelOption('timeOffset', parseFloat(e.target.value))}
            disabled={!options.enabled}
          />
        </div>

        {/* Invert */}
        <label className="fp-toggle">
          <input
            className="fp-checkbox"
            type="checkbox"
            checked={options.invert || false}
            onChange={(e) => this.updateChannelOption('invert', e.target.checked)}
            disabled={!options.enabled}
          />
          <span className="fp-label">Invert Values</span>
        </label>

        {/* Reset */}
        <button 
          className="fp-btn fp-btn-compact"
          onClick={this.resetChannel}
        >
          🔄 Reset Channel
        </button>
        
      </div>
    );
  }

  render() {
    return (
      <div className="fp-expandable">
        {this.renderCompactLine()}
        {this.renderExpandedSettings()}
      </div>
    );
  }
}

export default ChannelSettingsComponent;