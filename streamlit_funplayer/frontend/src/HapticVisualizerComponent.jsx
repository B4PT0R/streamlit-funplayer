import React, { Component } from 'react';

class HapticVisualizerComponent extends Component {
  constructor(props) {
    super(props);

    this.core=props.core
    
    this.state = {
      isPlaying: false,
      showConfig: false
    };
    
    // Canvas
    this.canvasRef = React.createRef();
    this.ctx = null;
    
    // Animation
    this.animationId = null;
    
    // ✅ SUPPRIMÉ: Trail system (trailHistory, maxTrailFrames)
    
    // Configuration - ✅ AJOUT: Rainbow rotation
    this.config = {
      resolution: 300,
      heightScale: 0.95,
      sigmaMin: 0.07,
      sigmaMax: 0.15,
      rainbowIntensity: 0.25,
      rainbowRotation: 0.0  // ✅ NOUVEAU: Rotation de l'arc-en-ciel (0 à 1)
    };
    
    // Cache de normalisation
    this.normalizationCache = new Map();
    
    // ✅ NOUVEAU: Cache des couleurs pour performance
    this.colorCache = {
      rainbowColors: null,    // Array[resolution+1] des couleurs arc-en-ciel
      actuatorColors: null,   // Map des couleurs par position µ
      lastRotation: -1,
      lastResolution: -1,
      lastNActive: -1         // ✅ AJOUT: Nombre d'actuateurs actifs
    };
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  componentDidMount() {
    this.initCanvas();
    this.startAnimation();
  }

  componentDidUpdate(prevProps) {
    const isPlaying = this.props.isPlaying || false;
    if (isPlaying !== this.state.isPlaying) {
      this.setState({ isPlaying });
    }
    if (prevProps.visible !== this.props.visible) {
      this.core.notify('component:resize', {
        source: 'HapticVisualizerComponent',
        reason: `visibility-${this.props.visible ? 'shown' : 'hidden'}`
      });
    }
  }

  componentWillUnmount() {
    // ✅ AMÉLIORÉ: Cleanup plus explicite
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
      console.log('🧹 HapticVisualizer animation cleanup completed');
    }
  }

  // ============================================================================
  // CANVAS
  // ============================================================================

  initCanvas = () => {
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    
    this.ctx = canvas.getContext('2d');
    
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    this.ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  }

  // ============================================================================
  // MATHÉMATIQUES - INCHANGÉ
  // ============================================================================

  gaussian = (x, mu, sigma) => {
    const coef = 1 / (sigma * Math.sqrt(2 * Math.PI));
    const exp = Math.exp(-Math.pow(x - mu, 2) / (2 * Math.pow(sigma, 2)));
    return coef * exp;
  }

  calculateSigma = (intensity) => {
    const { sigmaMin, sigmaMax } = this.config;
    return sigmaMax - intensity * (sigmaMax - sigmaMin);
  }

  getActuatorPosition = (index, total) => {
    if (total <= 1) return 0.5;
    return (index + 1) / (total + 1);
  }

  getCurrentActuatorData = () => {
    return this.props.getCurrentActuatorData?.() || new Map();
  }

  getConfiguredActuatorCount = () => {
    const actuatorData = this.getCurrentActuatorData();
    return Math.max(1, actuatorData.size);
  }

  calculateNormalizationFactor = (n) => {
    if (this.normalizationCache.has(n)) {
      return this.normalizationCache.get(n);
    }

    const { resolution, sigmaMin } = this.config;
    let maxIntensity = 0;

    for (let i = 0; i <= resolution; i++) {
      const x = i / resolution;
      let total = 0;

      for (let j = 0; j < n; j++) {
        const mu = this.getActuatorPosition(j, n);
        total += this.gaussian(x, mu, sigmaMin);
      }

      maxIntensity = Math.max(maxIntensity, total);
    }

    const factor = maxIntensity > 0 ? 1.0 / maxIntensity : 1.0;
    this.normalizationCache.set(n, factor);
    return factor;
  }

  // ============================================================================
  // RENDU - SIMPLIFIÉ
  // ============================================================================

  getActiveActuators = (actuatorData) => {
    // ✅ CORRIGÉ: Un actuateur est actif s'il est présent dans actuatorData
    // peu importe sa valeur (peut être 0)
    return Array.from(actuatorData.entries());
  }

  // ============================================================================
  // CACHE DES COULEURS POUR PERFORMANCE
  // ============================================================================

  rebuildColorCache = () => {
    const { resolution, rainbowRotation } = this.config;
    
    // Cache arc-en-ciel (resolution+1 points)
    this.colorCache.rainbowColors = Array.from({length: resolution + 1}, (_, i) => 
      this.getColorAt(i / resolution)
    );
    
    // Cache couleurs actuateurs (positions µ typiques)
    this.colorCache.actuatorColors = new Map();
    for (let nActuators = 1; nActuators <= 8; nActuators++) {
      for (let i = 0; i < nActuators; i++) {
        const mu = this.getActuatorPosition(i, nActuators);
        const color = this.getColorAt(mu);
        this.colorCache.actuatorColors.set(`${nActuators}-${i}`, color);
      }
    }
    
    // Marquer comme à jour
    this.colorCache.lastRotation = rainbowRotation;
    this.colorCache.lastResolution = resolution;
  }

  ensureColorCache = (nActive) => {
    const { resolution, rainbowRotation } = this.config;
    
    if (this.colorCache.lastRotation !== rainbowRotation || 
        this.colorCache.lastResolution !== resolution ||
        this.colorCache.lastNActive !== nActive) {
      this.rebuildColorCache();
      this.colorCache.lastNActive = nActive;  // ✅ AJOUT: Sauvegarder nActive
    }
  }

  getCachedRainbowColor = (xIndex) => {
    return this.colorCache.rainbowColors[xIndex];
  }

  getCachedActuatorColor = (nActuators, actuatorIndex, intensity = 1) => {
    const baseColor = this.colorCache.actuatorColors.get(`${nActuators}-${actuatorIndex}`);
    if (!baseColor) return [255, 255, 255]; // Fallback blanc
    
    return [
      Math.round(baseColor[0] * intensity),
      Math.round(baseColor[1] * intensity),
      Math.round(baseColor[2] * intensity)
    ];
  }

  // ============================================================================
  // SYSTÈME DE COULEURS CENTRALISÉ - HSV pour arc-en-ciel smooth
  // ============================================================================

  hsvToRgb = (h, s, v) => {
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    
    let r, g, b;
    
    if (h >= 0 && h < 60) {
      [r, g, b] = [c, x, 0];
    } else if (h >= 60 && h < 120) {
      [r, g, b] = [x, c, 0];
    } else if (h >= 120 && h < 180) {
      [r, g, b] = [0, c, x];
    } else if (h >= 180 && h < 240) {
      [r, g, b] = [0, x, c];
    } else if (h >= 240 && h < 300) {
      [r, g, b] = [x, 0, c];
    } else {
      [r, g, b] = [c, 0, x];
    }
    
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    ];
  }

  getColorAt = (x) => {
    // Arc-en-ciel HSV parfaitement smooth qui boucle
    const hue = ((x + this.config.rainbowRotation) % 1.0) * 360;
    const saturation = 1.0;  // Couleurs vives
    const value = 1.0;       // Luminosité max
    
    return this.hsvToRgb(hue, saturation, value);
  }

  getActuatorColor = (mu, intensity = 1) => {
    const baseColor = this.getColorAt(mu);
    return [
      Math.round(baseColor[0] * intensity),
      Math.round(baseColor[1] * intensity),
      Math.round(baseColor[2] * intensity)
    ];
  }

  getRainbowBackgroundColor = (x) => {
    return this.getColorAt(x);
  }

  calculatePoints = (activeActuators, width, height) => {
    const nConfigured = this.getConfiguredActuatorCount();
    const nActive = activeActuators.length;
    const { resolution, heightScale } = this.config;
    const normFactor = this.calculateNormalizationFactor(nConfigured);
    
    // ✅ NOUVEAU: S'assurer que le cache couleurs est à jour
    this.ensureColorCache(nActive);
    
    const points = [];

    for (let i = 0; i <= resolution; i++) {
      const x = i / resolution;
      let totalIntensity = 0;
      let weightedColor = [0, 0, 0];

      // ✅ MODIFIÉ: Plus de base arc-en-ciel globale
      // L'arc-en-ciel influence maintenant chaque gaussienne individuellement

      // Ajouter les contributions des actuators
      activeActuators.forEach(([actuatorIndex, data], arrayIndex) => {
        const mu = this.getActuatorPosition(arrayIndex, nActive);
        const intensity = Math.abs(data.value);
        const sigma = this.calculateSigma(intensity);
        const gaussianValue = this.gaussian(x, mu, sigma) * intensity;

        if (gaussianValue > 0.001) {
          // ✅ OPTIMISÉ: Couleurs depuis le cache
          const actuatorColor = this.getCachedActuatorColor(nActive, arrayIndex, intensity);
          const rainbowColorAtX = this.getCachedRainbowColor(i);
          
          // ✅ NOUVEAU: Mélange selon rainbowIntensity
          const blendFactor = this.config.rainbowIntensity;
          const finalColor = [
            actuatorColor[0] * (1 - blendFactor) + rainbowColorAtX[0] * blendFactor,
            actuatorColor[1] * (1 - blendFactor) + rainbowColorAtX[1] * blendFactor,
            actuatorColor[2] * (1 - blendFactor) + rainbowColorAtX[2] * blendFactor
          ];
          
          // Ajouter à la moyenne pondérée
          weightedColor[0] += finalColor[0] * gaussianValue;
          weightedColor[1] += finalColor[1] * gaussianValue;
          weightedColor[2] += finalColor[2] * gaussianValue;
          totalIntensity += gaussianValue;
        }
      });

      if (totalIntensity > 0) {
        // Normaliser les couleurs par le total
        weightedColor = weightedColor.map(c => Math.round(c / totalIntensity));
      }

      points.push({
        x: x * width,
        y: height - (totalIntensity * normFactor * heightScale * height),
        intensity: totalIntensity * normFactor,
        color: weightedColor
      });
    }

    return points;
  }

  renderGradientFill = (points, width, height) => {
    if (points.length < 2) return;

    this.ctx.beginPath();
    this.ctx.moveTo(0, height);
    
    points.forEach((point, i) => {
      if (i === 0) {
        this.ctx.lineTo(point.x, point.y);
      } else {
        const prevPoint = points[i - 1];
        const cpX = (prevPoint.x + point.x) / 2;
        this.ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, cpX, (prevPoint.y + point.y) / 2);
      }
    });

    this.ctx.lineTo(width, height);
    this.ctx.closePath();

    const gradient = this.ctx.createLinearGradient(0, 0, width, 0);
    points.forEach((point, i) => {
      const stop = i / (points.length - 1);
      const [r, g, b] = point.color;
      const alpha = Math.min(1, point.intensity * 0.8);
      gradient.addColorStop(stop, `rgba(${r}, ${g}, ${b}, ${alpha})`);
    });

    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    this.ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
    this.ctx.shadowBlur = 8;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
  }

  // ✅ SUPPRIMÉ: renderTrails() et renderTrailStroke()

  renderCurrentFrame = () => {
    const actuatorData = this.getCurrentActuatorData();
    const activeActuators = this.getActiveActuators(actuatorData);
    
    if (activeActuators.length === 0) return;

    const canvas = this.canvasRef.current;
    // ✅ AJOUTÉ: Vérification canvas null avant accès aux propriétés
    if (!canvas) {
      return;
    }
    
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    const points = this.calculatePoints(activeActuators, width, height);
    this.renderGradientFill(points, width, height);
  }

  // ============================================================================
  // ANIMATION - SIMPLIFIÉ
  // ============================================================================

  startAnimation = () => {
    const animate = () => {
      // ✅ AJOUTÉ: Vérification que le composant est toujours monté
      if (!this.canvasRef.current) {
        return;
      }
      
      this.renderFrame();
      this.animationId = requestAnimationFrame(animate);
    };
    this.animationId = requestAnimationFrame(animate);
  }


  renderFrame = () => {
    if (!this.ctx) return;

    const canvas = this.canvasRef.current;
    // ✅ AJOUTÉ: Vérification canvas null avant accès aux propriétés
    if (!canvas) {
      return;
    }

    this.ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    // ✅ SIMPLIFIÉ: Rendu direct de la frame courante, pas de trails
    this.renderCurrentFrame();
  }

  // ============================================================================
  // CONFIGURATION UI
  // ============================================================================

  toggleConfig = () => {
    const newState = !this.state.showConfig;
    
    this.setState({ showConfig: newState }, () => {
      this.core.notify('component:resize', {
        source: 'HapticVisualizerComponent',
        reason: `config-panel-${newState ? 'expanded' : 'collapsed'}`
      });
    });
  }

  updateConfig = (key, value) => {
    this.config[key] = value;
    if (key === 'sigmaMin' || key === 'sigmaMax') {
      this.normalizationCache.clear();
    }
    this.forceUpdate();
  }

  // ============================================================================
  // RENDER PRINCIPAL
  // ============================================================================
  
  render() {

    const { visible = true } = this.props;  // ✅ Défaut visible pour rétrocompatibilité
  
    // ✅ Option 1: Return null (plus performant, pas d'espace DOM)
    if (!visible) {
      return null;
    }

    return (
      <div className="fp-haptic-visualizer">
        
        {/* Canvas avec bouton config */}
        <div className="fp-haptic-visualizer-canvas-area">
          <canvas
            ref={this.canvasRef}
            className="fp-haptic-visualizer-canvas"
          />
          
          {/* Bouton config discret */}
          <button
            className="fp-haptic-visualizer-config-btn"
            onClick={this.toggleConfig}
            title="Visualizer settings"
          >
            ⚙️
          </button>
        </div>
        
        {/* Panel de configuration */}
        {this.state.showConfig && (
          <div className="fp-haptic-visualizer-config">
            <div className="fp-haptic-visualizer-config-row">
              <label className="fp-haptic-visualizer-config-label">
                Resolution: {this.config.resolution}
              </label>
              <input
                className="fp-haptic-visualizer-config-range"
                type="range"
                min="50"
                max="500"
                step="25"
                value={this.config.resolution}
                onChange={(e) => this.updateConfig('resolution', parseInt(e.target.value))}
              />
            </div>
            
            <div className="fp-haptic-visualizer-config-row">
              <label className="fp-haptic-visualizer-config-label">
                Height: {(this.config.heightScale * 100).toFixed(0)}%
              </label>
              <input
                className="fp-haptic-visualizer-config-range"
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={this.config.heightScale}
                onChange={(e) => this.updateConfig('heightScale', parseFloat(e.target.value))}
              />
            </div>
            
            <div className="fp-haptic-visualizer-config-row">
              <label className="fp-haptic-visualizer-config-label">
                Sigma Min: {this.config.sigmaMin.toFixed(2)}
              </label>
              <input
                className="fp-haptic-visualizer-config-range"
                type="range"
                min="0.01"
                max="0.2"
                step="0.01"
                value={this.config.sigmaMin}
                onChange={(e) => this.updateConfig('sigmaMin', parseFloat(e.target.value))}
              />
            </div>
            
            <div className="fp-haptic-visualizer-config-row">
              <label className="fp-haptic-visualizer-config-label">
                Sigma Max: {this.config.sigmaMax.toFixed(2)}
              </label>
              <input
                className="fp-haptic-visualizer-config-range"
                type="range"
                min="0.05"
                max="0.3"
                step="0.01"
                value={this.config.sigmaMax}
                onChange={(e) => this.updateConfig('sigmaMax', parseFloat(e.target.value))}
              />
            </div>
            
            <div className="fp-haptic-visualizer-config-row">
              <label className="fp-haptic-visualizer-config-label">
                Rainbow: {(this.config.rainbowIntensity * 100).toFixed(0)}%
              </label>
              <input
                className="fp-haptic-visualizer-config-range"
                type="range"
                min="0.0"
                max="1"
                step="0.05"
                value={this.config.rainbowIntensity}
                onChange={(e) => this.updateConfig('rainbowIntensity', parseFloat(e.target.value))}
              />
            </div>
            
            <div className="fp-haptic-visualizer-config-row">
              <label className="fp-haptic-visualizer-config-label">
                Hue: {(this.config.rainbowRotation * 360).toFixed(0)}°
              </label>
              <input
                className="fp-haptic-visualizer-config-range"
                type="range"
                min="0.0"
                max="1.0"
                step="0.02"
                value={this.config.rainbowRotation}
                onChange={(e) => this.updateConfig('rainbowRotation', parseFloat(e.target.value))}
              />
            </div>
            
          </div>
        )}
        
      </div>
    );
  }
}

export default HapticVisualizerComponent;