import React, { Component } from 'react';
import core from './FunPlayerCore';

/**
 * ActuatorSettingsComponent - ✅ NETTOYÉ: UI pure sans notifications
 * 
 * RESPONSABILITÉS SIMPLIFIÉES:
 * - UI pure pour un actuateur (instance passée en props)
 * - Appels directs core.xxx (pas d'indirections)
 * - Re-render uniquement sur événements concernant CET actuateur
 * - ✅ CLEAN: Pas de notifications status (c'est aux managers de le faire)
 */
class ActuatorSettingsComponent extends Component {
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
  // GESTION D'ÉVÉNEMENTS GRANULAIRES - Filtrage par actuateur
  // ============================================================================

  handleEvent = (event, data) => {
    const { actuator } = this.props;
    if (!actuator) return;

    // Événements granulaires concernant CET actuateur spécifiquement
    if (event === 'actuator:settingsChanged' || 
        event === 'actuator:settingsReset' ||
        event === 'actuator:plugged' ||
        event === 'actuator:unplugged') {
      
      // Filtrage: Ne re-render que si c'est NOTRE actuateur
      if (data.actuatorIndex === actuator.index) {
        this._triggerRender();
      }
      return;
    }

    // Événements de canal concernant CET actuateur
    if (event === 'channel:plugged' || event === 'channel:unplugged') {
      // Filtrage: Ne re-render que si c'est NOTRE actuateur qui est affecté
      if (data.actuatorIndex === actuator.index) {
        this._triggerRender();
      }
      return;
    }

    // Événements globaux qui peuvent affecter la compatibilité
    const globalEvents = [
      'funscript:load',     // Nouveaux canaux disponibles
      'funscript:channels', // Liste des canaux mise à jour
      'buttplug:device'     // Device changé (peut affecter l'actuateur)
    ];
    
    if (globalEvents.includes(event)) {
      this._triggerRender();
    }
  }

  _triggerRender = () => {
    this.setState(prevState => ({ 
      renderTrigger: prevState.renderTrigger + 1 
    }));
  }

  handleToggleExpanded = () => {
    this.setState({ isExpanded: !this.state.isExpanded }, () => {
      this.props.onResize?.();
    });
  }

  // ============================================================================
  // ACTIONS SIMPLIFIÉES - Appels directs core, pas d'indirections
  // ============================================================================

  handleGlobalScaleChange = (scale) => {
    // Appel direct core - la notification sera faite par ButtPlugManager
    core.buttplug.setGlobalScale(scale);
  }

  handleActuatorSettingChange = (key, value) => {
    const { actuator } = this.props;
    if (!actuator) return;
    
    // Mise à jour directe sur l'instance - la notification sera faite par Actuator
    actuator.updateSettings({ [key]: value });
  }

  handleChannelMapping = (channelName) => {
    const { actuator } = this.props;
    if (!actuator) return;
    
    if (channelName === '' || channelName === null) {
      // Appel direct instance - la notification sera faite par Channel/Actuator
      actuator.unplug();
    } else {
      // Appel direct core + instance - la notification sera faite par Channel
      const channel = core.funscript.getChannel(channelName);
      if (channel) {
        channel.plug(actuator);
      }
    }
  }

  // ============================================================================
  // RENDER SIMPLIFIÉ - Accès direct aux données via core + props
  // ============================================================================

  renderCompactLine() {
    const { actuator } = this.props;
    const { isExpanded } = this.state;
    
    if (!actuator) {
      return <div className="fp-compact-line">No actuator provided</div>;
    }
    
    // Accès direct core pour canaux compatibles
    const allChannels = core.funscript.getChannels();
    const compatibleChannels = allChannels.filter(channel => 
      channel.canPlugTo(actuator)
    );
    
    const assignedChannel = actuator.assignedChannel;
    
    // Logique diagnostic en place
    let usabilityMessage = null;
    if (actuator.settings.enabled) {
      if (allChannels.length === 0) {
        usabilityMessage = 'Load funscript first';
      } else if (compatibleChannels.length === 0) {
        // Diagnostic rapide
        const hasRotateCapability = actuator.capability === 'rotate';
        const hasNegativeChannels = allChannels.some(channel => channel.type === 'polar');
        
        if (hasNegativeChannels && !hasRotateCapability) {
          usabilityMessage = 'Funscript has bipolar channels (needs rotate actuator)';
        } else if (!hasNegativeChannels && hasRotateCapability) {
          usabilityMessage = 'Funscript has only unipolar channels (rotate not needed)';
        } else {
          usabilityMessage = 'No compatible channels in current funscript';
        }
      }
    }
    
    return (
      <div className="fp-compact-line">
        
        {/* Nom actuateur avec indicateur de statut */}
        <span className={`fp-badge fp-no-shrink ${!actuator.settings.enabled ? 'fp-disabled' : ''}`}>
          #{actuator.index} ({actuator.capability})
          {!actuator.settings.enabled && (
            <span 
              title={usabilityMessage}
              style={{ marginLeft: '4px', opacity: 0.7 }}
            >
              ⚠️
            </span>
          )}
        </span>
        
        {/* Enable toggle */}
        <label className="fp-toggle">
          <input
            className="fp-checkbox"
            type="checkbox"
            checked={actuator.settings.enabled}
            onChange={(e) => this.handleActuatorSettingChange('enabled', e.target.checked)}
            title={!actuator.settings.enabled ? usabilityMessage : "Enable/disable this actuator"}
          />
        </label>
        
        {/* Sélecteur canaux compatibles */}
        <select
          className="fp-input fp-select fp-flex"
          value={assignedChannel?.name || ''}
          onChange={(e) => this.handleChannelMapping(e.target.value)}
          disabled={!actuator.settings.enabled}
          title={!actuator.settings.enabled ? usabilityMessage : "Assign compatible channel to this actuator"}
        >
          <option value="">None</option>
          {compatibleChannels.map((channel) => {
            const bipolarIndicator = channel.type === 'polar' ? ' (±)' : '';
            return (
              <option key={channel.name} value={channel.name}>
                {channel.name}{bipolarIndicator}
              </option>
            );
          })}
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
    
    const { actuator } = this.props;
    
    if (!actuator) return null;
    
    // Accès direct core pour canaux compatibles
    const allChannels = core.funscript.getChannels();
    const compatibleChannels = allChannels.filter(channel => 
      channel.canPlugTo(actuator)
    );
  
    
    return (
      <div className="fp-expanded fp-layout-column fp-layout-compact">
        
        {/* Message de diagnostic si pas utilisable */}
        {!actuator.settings.enabled && allChannels.length === 0 && (
          <div className="fp-warning" style={{ 
            padding: 'calc(var(--spacing) * 0.5)', 
            background: 'rgba(255, 193, 7, 0.1)', 
            border: '1px solid rgba(255, 193, 7, 0.3)', 
            borderRadius: 'calc(var(--base-radius) * 0.5)',
            fontSize: '0.75rem',
            color: 'var(--text-color)',
            opacity: '0.8'
          }}>
            📄 Load a funscript first
          </div>
        )}
        
        {/* Info sur les canaux compatibles si utilisable */}
        {actuator.settings.enabled && compatibleChannels.length > 0 && (
          <div className="fp-info" style={{ 
            fontSize: '0.7rem', 
            opacity: '0.7',
            marginBottom: 'calc(var(--spacing) * 0.5)'
          }}>
            Compatible with {compatibleChannels.length} channel(s): {compatibleChannels.map(ch => ch.name).join(', ')}
          </div>
        )}
        
        {/* Scale */}
        <div className="fp-layout-column">
          <label className="fp-label">
            Scale: {((actuator.settings.scale || 1) * 100).toFixed(0)}%
          </label>
          <input
            className="fp-input fp-range"
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={actuator.settings.scale || 1}
            onChange={(e) => this.handleActuatorSettingChange('scale', parseFloat(e.target.value))}
            disabled={!actuator.settings.enabled}
          />
        </div>

        {/* Time Offset */}
        <div className="fp-layout-column">
          <label className="fp-label">
            Time Offset: {((actuator.settings.timeOffset || 0) * 1000).toFixed(0)}ms
          </label>
          <input
            className="fp-input fp-range"
            type="range"
            min="-0.5"
            max="0.5"
            step="0.001"
            value={actuator.settings.timeOffset || 0}
            onChange={(e) => this.handleActuatorSettingChange('timeOffset', parseFloat(e.target.value))}
            disabled={!actuator.settings.enabled}
          />
        </div>

        {/* Invert */}
        <label className="fp-toggle">
          <input
            className="fp-checkbox"
            type="checkbox"
            checked={actuator.settings.invert || false}
            onChange={(e) => this.handleActuatorSettingChange('invert', e.target.checked)}
            disabled={!actuator.settings.enabled}
          />
          <span className="fp-label">Invert Values</span>
        </label>        
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

export default ActuatorSettingsComponent;