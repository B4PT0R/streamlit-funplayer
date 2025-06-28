import React, { Component } from 'react';
import core from './FunPlayerCore';

/**
 * ChannelSettingsComponent - Configuration manuelle des champs d'actions
 * 
 * RESPONSABILITÉS:
 * - UI minimaliste pour configurer timeField, valueField, directionField, durationField
 * - Bouton discret "Configure Action Channels" en bas des settings
 * - Dropdowns simples avec options détectées + "none"
 * - Permet de convertir canaux polar → scalar via "none" sur directionField
 */
class ChannelSettingsComponent extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      isExpanded: false,
      renderTrigger: 0,
      pendingConfig: {} // Config en cours avant validation
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
  // GESTION D'ÉVÉNEMENTS
  // ============================================================================

  handleEvent = (event, data) => {
    const eventsToReact = [
      'funscript:load',     // Nouveau funscript → reset config
      'funscript:reset'     // Reset → masquer
    ];
    
    if (eventsToReact.includes(event)) {
      if (event === 'funscript:load') {
        this.setState({ pendingConfig: {}});
      }
      if (event === 'funscript:reset') {
        this.setState({ isExpanded: false });
      }
      this._triggerRender();
    }
  }

  _triggerRender = () => {
    this.setState(prevState => ({ 
      renderTrigger: prevState.renderTrigger + 1 
    }));
  }

  // ============================================================================
  // ACTIONS
  // ============================================================================

  handleToggleExpanded = () => {
    this.setState({ isExpanded: !this.state.isExpanded }, () => {
      this.props.onResize?.();
    });
  }

  handleFieldChange = (channelName, fieldType, value) => {
    this.setState(prevState => ({
      pendingConfig: {
        ...prevState.pendingConfig,
        [channelName]: {
          ...prevState.pendingConfig[channelName],
          [fieldType]: value === 'none' ? null : value
        }
      }
    }));
  }

  handleValidate = () => {  // Enlever async
    try {
      const originalData = core.funscript.data;
      if (originalData) {
        core.funscript.loadWithCustomFieldConfig(originalData, pendingConfig); // Enlever await
        this.setState({ pendingConfig: {}, isExpanded: false });
      }
    } catch (error) {
      console.error('Failed to apply channel configuration:', error);
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  getCurrentConfig = (channelName, fieldType) => {
    const { pendingConfig } = this.state;
    const channel = core.funscript.getChannel(channelName);
    
    // Valeur en cours d'édition ou valeur actuelle du canal
    if (pendingConfig[channelName] && pendingConfig[channelName][fieldType] !== undefined) {
      return pendingConfig[channelName][fieldType] || 'none';
    }
    
    if (channel && channel.fieldConfig) {
      return channel.fieldConfig[fieldType] || 'none';
    }
    
    // Defaults par type
    const defaults = {
      timeField: 'at',
      valueField: 'pos',
      directionField: 'none',
      durationField: 'none'
    };
    
    return defaults[fieldType] || 'none';
  }

  getAvailableFields = (detectedFields, fieldType) => {
    const fieldMap = {
      timeField: 'availableTimeFields',
      valueField: 'availableValueFields', 
      directionField: 'availableDirectionFields',
      durationField: 'availableDurationFields'
    };
    
    const availableKey = fieldMap[fieldType];
    return detectedFields[availableKey] || [];
  }

  hasPendingChanges = () => {
    return Object.keys(this.state.pendingConfig).length > 0;
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  renderChannelConfig = (channelName, detectedFields) => {
    const fieldTypes = [
      { key: 'timeField', label: 'Time' },
      { key: 'valueField', label: 'Value' },
      { key: 'directionField', label: 'Direction' },
      { key: 'durationField', label: 'Duration' }
    ];

    return (
      <div key={channelName} className="fp-layout-column">
        
        {/* Header du canal */}
        <div className="fp-layout-row">
          <span className="fp-badge fp-no-shrink">{channelName}</span>
        </div>
        
        {/* Config des 4 champs */}
        <div className="fp-layout-column fp-layout-compact">
          {fieldTypes.map(({ key, label }) => {
            const availableFields = this.getAvailableFields(detectedFields, key);
            const currentValue = this.getCurrentConfig(channelName, key);
            
            return (
              <div key={key} className="fp-layout-row">
                <label className="fp-label fp-no-shrink" style={{ minWidth: '60px' }}>
                  {label}:
                </label>
                <select
                  className="fp-input fp-select fp-flex"
                  value={currentValue}
                  onChange={(e) => this.handleFieldChange(channelName, key, e.target.value)}
                >
                  <option value="none">none</option>
                  {availableFields.map(field => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
        
      </div>
    );
  }

  renderExpandedSettings = () => {
    if (!this.state.isExpanded) return null;
    
    const detectedFields = core.funscript.getDetectedFields();
    const channelNames = Object.keys(detectedFields);
    
    if (channelNames.length === 0) {
      return (
        <div className="fp-expanded">
          <div style={{ 
            textAlign: 'center', 
            color: 'var(--text-color)', 
            opacity: 0.6,
            padding: 'var(--spacing)' 
          }}>
            No channels detected. Load a funscript first.
          </div>
        </div>
      );
    }

    return (
      <div className="fp-expanded">
        <div className="fp-layout-column">
          
          {/* Config par canal */}
          {channelNames.map(channelName => 
            this.renderChannelConfig(channelName, detectedFields[channelName])
          )}
          
          {/* Bouton valider */}
          <div className="fp-layout-row" style={{ marginTop: 'var(--spacing)' }}>
            <button 
              className="fp-btn fp-btn-primary"
              onClick={this.handleValidate}
              disabled={!this.hasPendingChanges()}
            >
              ✓ Validate Changes
            </button>
            
            {this.hasPendingChanges() && (
              <button 
                className="fp-btn fp-btn-ghost"
                onClick={() => this.setState({ pendingConfig: {} })}
              >
                Cancel
              </button>
            )}
          </div>
          
        </div>
      </div>
    );
  }

  render() {
      const { isExpanded } = this.state;
      
      // Ne s'afficher que si funscript chargé
      if (!core.funscript.hasFunscript()) {
        return null;
      }
      
      const detectedFields = core.funscript.getDetectedFields();
      const channelCount = Object.keys(detectedFields).length;
      
      return (
        <div className="channel-settings">
          
          {/* Bouton discret */}
          <div className="fp-expandable">
            {/* ✅ MODIFIÉ: Ajout de fp-justify-between pour pousser le chevron à droite */}
            <div className="fp-compact-line fp-justify-between">
              <span className="fp-label">Configure Action Channels ({channelCount})</span>
              
              <button
                className="fp-btn fp-btn-ghost fp-chevron"
                onClick={this.handleToggleExpanded}
              >
                {isExpanded ? '▲' : '▼'}
              </button>
            </div>
            
            {/* Zone expandue */}
            {this.renderExpandedSettings()}
          </div>
          
        </div>
      );
    }
}

export default ChannelSettingsComponent;