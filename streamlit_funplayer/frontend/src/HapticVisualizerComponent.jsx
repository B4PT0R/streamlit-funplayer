import React, { Component } from 'react';

class HapticVisualizerComponent extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      isPlaying: false,
      showConfig: false
    };
    
    // Canvas
    this.canvasRef = React.createRef();
    this.ctx = null;
    
    // Animation
    this.animationId = null;
    
    // Trail system
    this.trailHistory = [];
    this.maxTrailFrames = 8;
    
    // Configuration - ✅ MODIFIÉ: Plus de couleurs fixes par type
    this.config = {
      resolution: 300,
      heightScale: 0.95,
      trailDecay: 0.85,
      sigmaMin: 0.07,
      sigmaMax: 0.15,
      rainbowIntensity: 0.15  // ✅ NOUVEAU: Intensité du talon arc-en-ciel
    };
    
    // Cache de normalisation
    this.normalizationCache = new Map();
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
      if (!isPlaying) {
        this.trailHistory = [];
      }
    }
  }

  componentWillUnmount() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
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

  // ✅ NOUVEAU: Récupération des données via callback
  getCurrentActuatorData = () => {
    return this.props.getCurrentActuatorData?.() || new Map();
  }

  getConfiguredActuatorCount = () => {
    // Nombre d'actuators dans actuatorData = nombre configuré et enabled
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
  // RENDU - INCHANGÉ
  // ============================================================================

  getActiveActuators = (actuatorData) => {
    return Array.from(actuatorData.entries())
      .filter(([_, data]) => Math.abs(data.value) > 0.001);
  }

  // ✅ NOUVEAU: Couleur avec effet arc-en-ciel de fond
  getActuatorColor = (mu, intensity = 1) => {
    // Couleur principale basée sur µ
    const colors = [
      [255, 0, 0],     // Rouge (µ=0)
      [255, 165, 0],   // Orange 
      [255, 255, 0],   // Jaune
      [0, 255, 0],     // Vert
      [0, 0, 255],     // Bleu
      [128, 0, 128]    // Violet (µ=1)
    ];
    
    const scaledMu = mu * (colors.length - 1);
    const index = Math.floor(scaledMu);
    const t = scaledMu - index;
    
    const color1 = colors[Math.min(index, colors.length - 1)];
    const color2 = colors[Math.min(index + 1, colors.length - 1)];
    
    const mainColor = [
      color1[0] * (1 - t) + color2[0] * t,
      color1[1] * (1 - t) + color2[1] * t,
      color1[2] * (1 - t) + color2[2] * t
    ];
    
    return [
      Math.round(mainColor[0] * intensity),
      Math.round(mainColor[1] * intensity),
      Math.round(mainColor[2] * intensity)
    ];
  }

  // ✅ NOUVEAU: Couleur de fond arc-en-ciel pour effet de révélation
  getRainbowBackgroundColor = (x) => {
    // Arc-en-ciel continu sur l'axe x (0 à 1)
    const colors = [
      [255, 0, 0],     // Rouge
      [255, 165, 0],   // Orange 
      [255, 255, 0],   // Jaune
      [0, 255, 0],     // Vert
      [0, 0, 255],     // Bleu
      [128, 0, 128]    // Violet
    ];
    
    const scaledX = x * (colors.length - 1);
    const index = Math.floor(scaledX);
    const t = scaledX - index;
    
    const color1 = colors[Math.min(index, colors.length - 1)];
    const color2 = colors[Math.min(index + 1, colors.length - 1)];
    
    return [
      color1[0] * (1 - t) + color2[0] * t,
      color1[1] * (1 - t) + color2[1] * t,
      color1[2] * (1 - t) + color2[2] * t
    ];
  }

  calculatePoints = (activeActuators, width, height) => {
    const nConfigured = this.getConfiguredActuatorCount();
    const nActive = activeActuators.length;
    const { resolution, heightScale } = this.config;
    const normFactor = this.calculateNormalizationFactor(nConfigured);
    const points = [];

    for (let i = 0; i <= resolution; i++) {
      const x = i / resolution;
      let totalIntensity = 0;
      let weightedColor = [0, 0, 0];

      // ✅ MODIFIÉ: Couleur de fond arc-en-ciel configurable
      const backgroundIntensity = this.config.rainbowIntensity;
      const rainbowColor = this.getRainbowBackgroundColor(x);
      
      // Commencer avec le fond arc-en-ciel
      weightedColor[0] = rainbowColor[0] * backgroundIntensity;
      weightedColor[1] = rainbowColor[1] * backgroundIntensity;
      weightedColor[2] = rainbowColor[2] * backgroundIntensity;
      totalIntensity = backgroundIntensity;

      // Ajouter les contributions des actuators
      activeActuators.forEach(([actuatorIndex, data], arrayIndex) => {
        const mu = this.getActuatorPosition(arrayIndex, nActive);
        const intensity = Math.abs(data.value);
        const sigma = this.calculateSigma(intensity);
        const gaussianValue = this.gaussian(x, mu, sigma) * intensity;

        if (gaussianValue > 0.001) {
          const color = this.getActuatorColor(mu, intensity);
          
          // Ajouter à la moyenne pondérée
          weightedColor[0] += color[0] * gaussianValue;
          weightedColor[1] += color[1] * gaussianValue;
          weightedColor[2] += color[2] * gaussianValue;
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

  renderTrailStroke = (points, alpha) => {
    if (points.length < 2) return;

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.beginPath();

    points.forEach((point, i) => {
      if (i === 0) {
        this.ctx.moveTo(point.x, point.y);
      } else {
        const prevPoint = points[i - 1];
        const cpX = (prevPoint.x + point.x) / 2;
        this.ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, cpX, (prevPoint.y + point.y) / 2);
      }
    });

    const gradient = this.ctx.createLinearGradient(0, 0, this.canvasRef.current.clientWidth, 0);
    points.forEach((point, i) => {
      const stop = i / (points.length - 1);
      const [r, g, b] = point.color;
      gradient.addColorStop(stop, `rgb(${r}, ${g}, ${b})`);
    });

    this.ctx.strokeStyle = gradient;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.restore();
  }

  renderCurrentFrame = () => {
    const actuatorData = this.getCurrentActuatorData();
    const activeActuators = this.getActiveActuators(actuatorData);
    
    if (activeActuators.length === 0) return;

    const canvas = this.canvasRef.current;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    const points = this.calculatePoints(activeActuators, width, height);
    this.renderGradientFill(points, width, height);
  }

  renderTrails = () => {
    this.trailHistory.forEach((trailData, index) => {
      const age = this.trailHistory.length - index - 1;
      const alpha = Math.pow(this.config.trailDecay, age);
      
      const activeActuators = this.getActiveActuators(trailData.actuatorData);
      if (activeActuators.length === 0) return;

      const canvas = this.canvasRef.current;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      
      const points = this.calculatePoints(activeActuators, width, height);
      this.renderTrailStroke(points, alpha);
    });
  }

  // ============================================================================
  // ANIMATION - INCHANGÉ
  // ============================================================================

  startAnimation = () => {
    const animate = () => {
      this.renderFrame();
      this.animationId = requestAnimationFrame(animate);
    };
    this.animationId = requestAnimationFrame(animate);
  }

  renderFrame = () => {
    if (!this.ctx) return;

    const canvas = this.canvasRef.current;
    this.ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    if (this.state.isPlaying) {
      this.renderTrails();
    }

    this.renderCurrentFrame();

    if (this.state.isPlaying) {
      const snapshot = {
        timestamp: performance.now(),
        actuatorData: this.getCurrentActuatorData()
      };

      this.trailHistory.push(snapshot);

      if (this.trailHistory.length > this.maxTrailFrames) {
        this.trailHistory.shift();
      }
    }
  }

  // ============================================================================
  // ✅ NOUVEAUTÉ: CONFIGURATION UI
  // ============================================================================

  toggleConfig = () => {
    this.setState({ showConfig: !this.state.showConfig }, () => {
      // ✅ AJOUT: Trigger refresh après toggle settings
      if (this.props.onResize) {
        this.props.onResize();
      }
    });
  }

  updateConfig = (key, value) => {
    this.config[key] = value;
    // Vider le cache de normalisation si on change les sigmas
    if (key === 'sigmaMin' || key === 'sigmaMax') {
      this.normalizationCache.clear();
    }
    this.forceUpdate(); // Re-render pour appliquer les changements
  }

  renderConfigPanel = () => {
    if (!this.state.showConfig) return null;
    
    const { heightScale, sigmaMin, sigmaMax, rainbowIntensity } = this.config;
    
    return (
      <div className="fp-section fp-section-compact" style={{ 
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--background-color)'
      }}>
        <div className="fp-layout-column fp-layout-compact">
          
          {/* Height Scale */}
          <div className="fp-layout-row">
            <label className="fp-label fp-no-shrink" style={{ minWidth: '80px' }}>
              Height: {(heightScale * 100).toFixed(0)}%
            </label>
            <input
              className="fp-input fp-range fp-flex"
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={heightScale}
              onChange={(e) => this.updateConfig('heightScale', parseFloat(e.target.value))}
            />
          </div>
          
          {/* Sigma Min */}
          <div className="fp-layout-row">
            <label className="fp-label fp-no-shrink" style={{ minWidth: '80px' }}>
              Sigma Min: {(sigmaMin * 100).toFixed(1)}
            </label>
            <input
              className="fp-input fp-range fp-flex"
              type="range"
              min="0.005"
              max="0.1"
              step="0.005"
              value={sigmaMin}
              onChange={(e) => this.updateConfig('sigmaMin', parseFloat(e.target.value))}
            />
          </div>
          
          {/* Sigma Max */}
          <div className="fp-layout-row">
            <label className="fp-label fp-no-shrink" style={{ minWidth: '80px' }}>
              Sigma Max: {(sigmaMax * 100).toFixed(1)}
            </label>
            <input
              className="fp-input fp-range fp-flex"
              type="range"
              min="0.05"
              max="0.3"
              step="0.01"
              value={sigmaMax}
              onChange={(e) => this.updateConfig('sigmaMax', parseFloat(e.target.value))}
            />
          </div>
          
          {/* ✅ NOUVEAU: Rainbow Intensity */}
          <div className="fp-layout-row">
            <label className="fp-label fp-no-shrink" style={{ minWidth: '80px' }}>
              Rainbow: {(rainbowIntensity * 100).toFixed(0)}%
            </label>
            <input
              className="fp-input fp-range fp-flex"
              type="range"
              min="0.0"
              max="0.5"
              step="0.05"
              value={rainbowIntensity}
              onChange={(e) => this.updateConfig('rainbowIntensity', parseFloat(e.target.value))}
            />
          </div>
          
        </div>
      </div>
    );
  }

  // ============================================================================
  // ✅ NOUVEAUTÉ: RENDER AVEC CONTRÔLES
  // ============================================================================

  render() {
    return (
      <div className="haptic-visualizer">
        
        {/* Canvas avec bouton config */}
        <div className="fp-section" style={{ position: 'relative' }}>
          <canvas
            ref={this.canvasRef}
            className="haptic-visualizer-canvas"
            style={{
              width: '100%',
              height: '120px',
              backgroundColor: 'var(--background-color)',
              border: '1px solid var(--border-color)',
              borderRadius: 'calc(var(--base-radius) * 0.5)',
              display: 'block'
            }}
          />
          
          {/* Bouton config discret */}
          <button
            className="fp-btn fp-btn-ghost"
            onClick={this.toggleConfig}
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '24px',
              height: '24px',
              padding: '0',
              fontSize: '12px',
              opacity: '0.6',
              background: 'rgba(0,0,0,0.1)',
              border: 'none',
              borderRadius: '50%'
            }}
            title="Configuration"
          >
            ⚙️
          </button>
        </div>
        
        {/* Panneau de configuration */}
        {this.renderConfigPanel()}
        
      </div>
    );
  }
}

export default HapticVisualizerComponent;