class FunscriptManager {
  constructor() {
    this.data = null;
    this.channels = new Map(); // channel -> sorted actions [{time, value}]
    this.duration = 0;
    this.options = new Map(); // channel -> options

    this.globalScale = 1.0;
    this.globalOffset = 0.0;
    
    // ✅ NOUVEAU: Cache d'interpolation par canal
    this.interpolationCache = new Map(); // channel -> { leftIndex, rightIndex, lastTime }
    this.seekThreshold = 100; // ms - seuil pour détecter un seek vs progression normale
    
    // Default channel options
    this.defaults = {
      enabled: true,
      scale: 1.0,
      timeOffset: 0.0,
      invert: false,
      actuatorIndex: null
    };

    // ✅ NOUVEAU: Système d'événements
    this.onLoad = null;           // (data) => {} - Quand un funscript est chargé
    this.onReset = null;          // () => {} - Quand le manager est remis à zéro
    this.onChannelsChanged = null; // (channels) => {} - Quand les canaux changent
    this.onOptionsChanged = null; // (channel, options) => {} - Quand des options changent
    this.onGlobalOffsetChanged = null; // (offset) => {} - Quand l'offset global change
    this.onGlobalScaleChanged = null;
  }

  // ============================================================================
  // MÉTHODES EXISTANTES (inchangées)
  // ============================================================================

  load(funscriptData) {
    try {
      this.data = typeof funscriptData === 'string' ? JSON.parse(funscriptData) : funscriptData;
      this._extractChannels();
      this._calculateDuration();
      this._initOptions();
      this._initInterpolationCache();
      
      console.log(`Loaded: ${this.getChannels().length} channels, ${this.duration.toFixed(2)}s`);
      
      // ✅ NOUVEAU: Déclencher événement de chargement
      this._notifyLoad(this.data);
      this._notifyChannelsChanged(this.getChannels());
      
      return true;
    } catch (error) {
      console.error('Load failed:', error);
      this._reset();
      return false;
    }
  }

  reset() {
    this._reset();
    this._notifyReset();
  }

  getChannels() {
    return Array.from(this.channels.keys());
  }

  hasChannel(channel) {
    return this.channels.has(channel);
  }

  getActionCount(channel) {
    return this.channels.get(channel)?.length || 0;
  }

  getDuration() {
    return this.duration;
  }

  setGlobalScale(scale) {
    const newScale = typeof scale === 'number' ? Math.max(0, Math.min(5.0, scale)) : 1.0;
    
    // ✅ NOUVEAU: Déclencher événement seulement si changement
    if (this.globalScale !== newScale) {
      this.globalScale = newScale;
      this._notifyGlobalScaleChanged(newScale);
    }
  }

  getGlobalScale() {
    return this.globalScale;
  }

  setGlobalOffset(offset) {
    const newOffset = typeof offset === 'number' ? offset : 0.0;
    
    // ✅ NOUVEAU: Déclencher événement seulement si changement
    if (this.globalOffset !== newOffset) {
      this.globalOffset = newOffset;
      this._clearInterpolationCache();
      this._notifyGlobalOffsetChanged(newOffset);
    }
  }

  getGlobalOffset() {
    return this.globalOffset;
  }

  // Options management (inchangé)
  setOptions(channel, opts) {
    if (!this.hasChannel(channel)) return false;
    
    const current = this.options.get(channel) || { ...this.defaults };
    const updated = { ...current, ...opts };
    
    if (!this._validateOptions(updated)) return false;
    
    this.options.set(channel, updated);
    
    // ✅ NOUVEAU: Vider le cache si timeOffset change
    if (opts.timeOffset !== undefined) {
      this._clearChannelCache(channel);
    }
    
    // ✅ NOUVEAU: Déclencher événement de changement d'options
    this._notifyOptionsChanged(channel, updated);
    
    return true;
  }

  getOptions(channel) {
    if (!this.hasChannel(channel)) return null;
    return this.options.get(channel) || { ...this.defaults };
  }

  getAllOptions() {
    const result = {};
    for (const channel of this.getChannels()) {
      result[channel] = this.getOptions(channel);
    }
    return result;
  }

  resetOptions(channel = null) {
    if (channel === null) {
      // Reset all
      for (const ch of this.getChannels()) {
        this.options.set(ch, { ...this.defaults });
      }
      this._clearInterpolationCache();
      
      // ✅ NOUVEAU: Notifier pour tous les canaux
      for (const ch of this.getChannels()) {
        this._notifyOptionsChanged(ch, { ...this.defaults });
      }
    } else if (this.hasChannel(channel)) {
      this.options.set(channel, { ...this.defaults });
      this._clearChannelCache(channel);
      
      // ✅ NOUVEAU: Notifier pour le canal spécifique
      this._notifyOptionsChanged(channel, { ...this.defaults });
    }
  }

  // ============================================================================
  // ✅ NOUVELLES MÉTHODES DE NOTIFICATION PRIVÉES
  // ============================================================================

  _notifyLoad(data) {
    if (this.onLoad && typeof this.onLoad === 'function') {
      try {
        this.onLoad(data);
      } catch (error) {
        console.error('FunscriptManager: onLoad callback error:', error);
      }
    }
  }

  _notifyReset() {
    if (this.onReset && typeof this.onReset === 'function') {
      try {
        this.onReset();
      } catch (error) {
        console.error('FunscriptManager: onReset callback error:', error);
      }
    }
  }

  _notifyChannelsChanged(channels) {
    if (this.onChannelsChanged && typeof this.onChannelsChanged === 'function') {
      try {
        this.onChannelsChanged([...channels]); // Copie pour éviter mutation
      } catch (error) {
        console.error('FunscriptManager: onChannelsChanged callback error:', error);
      }
    }
  }

  _notifyOptionsChanged(channel, options) {
    if (this.onOptionsChanged && typeof this.onOptionsChanged === 'function') {
      try {
        this.onOptionsChanged(channel, { ...options }); // Copie pour éviter mutation
      } catch (error) {
        console.error('FunscriptManager: onOptionsChanged callback error:', error);
      }
    }
  }

  _notifyGlobalScaleChanged(scale) {
    if (this.onGlobalScaleChanged && typeof this.onGlobalScaleChanged === 'function') {
      try {
        this.onGlobalScaleChanged(scale);
      } catch (error) {
        console.error('FunscriptManager: onGlobalScaleChanged callback error:', error);
      }
    }
  }

  _notifyGlobalOffsetChanged(offset) {
    if (this.onGlobalOffsetChanged && typeof this.onGlobalOffsetChanged === 'function') {
      try {
        this.onGlobalOffsetChanged(offset);
      } catch (error) {
        console.error('FunscriptManager: onGlobalOffsetChanged callback error:', error);
      }
    }
  }

  // ============================================================================
  // ✅ NOUVELLE INTERPOLATION OPTIMISÉE
  // ============================================================================

  interpolateAt(t, channel = 'pos') {
    const actions = this.channels.get(channel);
    if (!actions?.length) return null;

    const opts = this.getOptions(channel);
    if (!opts.enabled) return null;

    // Appliquer global offset + individual offset
    const totalOffset = this.globalOffset + (opts.timeOffset || 0);
    const adjustedTime = (t + totalOffset) * 1000; // Convert to ms
    
    const rawValue = this._interpolateRawOptimized(adjustedTime, actions, channel);
    
    return rawValue !== null ? this._processValue(rawValue, opts) : null;
  }

  interpolateAll(t) {
    const result = {};
    for (const channel of this.channels.keys()) {
      const value = this.interpolateAt(t, channel);
      if (value !== null) {
        result[channel] = value;
      }
    }
    return result;
  }

  interpolateToActuators(t) {
    const result = {};
    for (const channel of this.channels.keys()) {
      const value = this.interpolateAt(t, channel);
      if (value !== null) {
        const actuator = this.getOptions(channel).actuatorIndex;
        if (actuator !== null) {
          result[actuator] = value;
        }
      }
    }
    return result;
  }

  // ============================================================================
  // ✅ NOUVELLE MÉTHODE D'INTERPOLATION AVEC CACHE
  // ============================================================================

  _interpolateRawOptimized(timeMs, actions, channel) {
    const clampedTime = Math.max(0, Math.min(this.duration * 1000, timeMs));
    
    if (actions.length === 1) return actions[0].value;
    
    // Récupérer ou initialiser le cache pour ce canal
    let cache = this.interpolationCache.get(channel);
    if (!cache) {
      cache = { leftIndex: 0, rightIndex: 1, lastTime: -1 };
      this.interpolationCache.set(channel, cache);
    }

    // Détecter un seek (saut temporel important)
    const isSeek = cache.lastTime >= 0 && Math.abs(clampedTime - cache.lastTime) > this.seekThreshold;
    
    if (isSeek) {
      // En cas de seek, réinitialiser avec recherche binaire mais en gardant les bornes si elles sont déjà bonnes
      const { leftIndex, rightIndex } = this._findBoundsAfterSeek(clampedTime, actions, cache);
      cache.leftIndex = leftIndex;
      cache.rightIndex = rightIndex;
    } else {
      // Progression normale : glisser les bornes si nécessaire
      this._slideBounds(clampedTime, actions, cache);
    }

    cache.lastTime = clampedTime;

    // Vérification de sécurité
    if (cache.leftIndex < 0 || cache.rightIndex >= actions.length) {
      console.warn(`Invalid cache bounds for channel ${channel}:`, cache);
      return this._fallbackInterpolation(clampedTime, actions);
    }

    const leftAction = actions[cache.leftIndex];
    const rightAction = actions[cache.rightIndex];

    // Cas exacts
    if (leftAction.time === clampedTime) return leftAction.value;
    if (rightAction.time === clampedTime) return rightAction.value;

    // Interpolation linéaire
    if (clampedTime <= leftAction.time) return leftAction.value;
    if (clampedTime >= rightAction.time) return rightAction.value;

    const progress = (clampedTime - leftAction.time) / (rightAction.time - leftAction.time);
    return leftAction.value + (rightAction.value - leftAction.value) * progress;
  }

  // ✅ NOUVEAU: Glissement progressif des bornes
  _slideBounds(timeMs, actions, cache) {
    // Avancer rightIndex si le temps dépasse l'action droite
    while (cache.rightIndex < actions.length - 1 && timeMs > actions[cache.rightIndex].time) {
      cache.leftIndex = cache.rightIndex;
      cache.rightIndex++;
    }

    // Reculer leftIndex si le temps est avant l'action gauche
    while (cache.leftIndex > 0 && timeMs < actions[cache.leftIndex].time) {
      cache.rightIndex = cache.leftIndex;
      cache.leftIndex--;
    }

    // S'assurer que leftIndex < rightIndex
    if (cache.leftIndex >= cache.rightIndex) {
      if (cache.leftIndex > 0) {
        cache.rightIndex = cache.leftIndex;
        cache.leftIndex--;
      } else if (cache.rightIndex < actions.length - 1) {
        cache.leftIndex = cache.rightIndex;
        cache.rightIndex++;
      }
    }
  }

  // ✅ NOUVEAU: Recherche optimisée après seek
  _findBoundsAfterSeek(timeMs, actions, cache) {
    // Vérifier d'abord si les bornes actuelles sont déjà bonnes
    const leftTime = actions[cache.leftIndex]?.time || -1;
    const rightTime = actions[cache.rightIndex]?.time || Infinity;

    if (timeMs >= leftTime && timeMs <= rightTime) {
      // Les bornes sont déjà correctes, pas besoin de chercher
      return { leftIndex: cache.leftIndex, rightIndex: cache.rightIndex };
    }

    // Recherche binaire classique si les bornes ne conviennent pas
    let left = 0, right = actions.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midTime = actions[mid].time;
      
      if (midTime === timeMs) {
        return { leftIndex: mid, rightIndex: Math.min(mid + 1, actions.length - 1) };
      }
      if (midTime < timeMs) left = mid + 1;
      else right = mid - 1;
    }
    
    // Retourner les bornes encadrantes
    const leftIndex = Math.max(0, right);
    const rightIndex = Math.min(left, actions.length - 1);
    
    return { leftIndex, rightIndex };
  }

  // ✅ NOUVEAU: Fallback en cas de problème de cache
  _fallbackInterpolation(timeMs, actions) {
    console.warn('Using fallback interpolation');
    
    // Recherche binaire classique (code original)
    let left = 0, right = actions.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midTime = actions[mid].time;
      
      if (midTime === timeMs) return actions[mid].value;
      if (midTime < timeMs) left = mid + 1;
      else right = mid - 1;
    }
    
    // Handle bounds
    if (right < 0) return actions[0].value;
    if (left >= actions.length) return actions[actions.length - 1].value;
    
    // Linear interpolation
    const before = actions[right];
    const after = actions[left];
    const progress = (timeMs - before.time) / (after.time - before.time);
    
    return before.value + (after.value - before.value) * progress;
  }

  // ============================================================================
  // ✅ NOUVELLES MÉTHODES DE GESTION DU CACHE
  // ============================================================================

  _initInterpolationCache() {
    this.interpolationCache.clear();
    // Le cache sera initialisé lazy lors du premier appel d'interpolation
  }

  _clearInterpolationCache() {
    this.interpolationCache.clear();
  }

  _clearChannelCache(channel) {
    this.interpolationCache.delete(channel);
  }

  // Méthode publique pour forcer la réinitialisation du cache (utile après un seek manuel)
  resetInterpolationCache(channel = null) {
    if (channel === null) {
      this._clearInterpolationCache();
    } else {
      this._clearChannelCache(channel);
    }
  }

  // ============================================================================
  // NOUVELLES MÉTHODES : AUTO-MAPPING DES CANAUX VERS LES ACTUATEURS PERTINENTS
  // ============================================================================

  /**
   * Auto-map avec notification d'événement
   */
  autoMapChannels(capabilities = null) {
    const result = this._performAutoMapping(capabilities);
    
    // ✅ NOUVEAU: Notifier les changements d'options pour tous les canaux mappés
    if (result.mapped > 0) {
      for (const channel of this.getChannels()) {
        const options = this.getOptions(channel);
        if (options.actuatorIndex !== null) {
          this._notifyOptionsChanged(channel, options);
        }
      }
    }
    
    return result;
  }

  /**
   * Méthode privée pour effectuer le mapping (logique existante)
   */
  _performAutoMapping(capabilities = null) {
    const channels = this.getChannels();
    if (channels.length === 0) {
      return { mapped: 0, total: 0, mode: 'no channels' };
    }

    let mapped = 0;
    const isVirtualMode = !capabilities || !capabilities.actuators || capabilities.actuators.length === 0;

    channels.forEach((channel, index) => {
      const channelLower = channel.toLowerCase();
      let actuatorIndex = null;

      if (isVirtualMode) {
        // Mode virtuel : mapping simple par index cyclique
        actuatorIndex = index % 4;
      } else {
        // Mode device réel : mapping intelligent par nom + fallback
        actuatorIndex = this._getSmartActuatorMapping(channelLower, capabilities);
      }

      if (actuatorIndex !== null) {
        this.setOptions(channel, { actuatorIndex }); // Utilisera _notifyOptionsChanged
        mapped++;
      }
    });

    const mode = isVirtualMode ? 'virtual actuators' : 'device actuators';
    return { mapped, total: channels.length, mode };
  }

  /**
   * Mapping intelligent d'un canal vers un actuateur selon son nom et les capabilities
   * @private
   */
  _getSmartActuatorMapping(channelLower, capabilities) {
    // 1. Mapping par nom de canal
    if (channelLower.includes('vibrat') || channelLower.includes('vibe')) {
      return this._getFirstActuatorOfType('vibrate', capabilities);
    }
    
    if (channelLower.includes('linear') || channelLower.includes('stroke') || channelLower.includes('pos')) {
      return this._getFirstActuatorOfType('linear', capabilities);
    }
    
    if (channelLower.includes('rotat') || channelLower.includes('twist')) {
      return this._getFirstActuatorOfType('rotate', capabilities);
    }
    
    if (channelLower.includes('oscillat')) {
      return this._getFirstActuatorOfType('oscillate', capabilities);
    }

    // 2. Fallback : ordre de priorité par défaut
    return this._getFirstActuatorOfType('linear', capabilities) ||
           this._getFirstActuatorOfType('vibrate', capabilities) ||
           this._getFirstActuatorOfType('oscillate', capabilities) ||
           this._getFirstActuatorOfType('rotate', capabilities);
  }

  /**
   * Trouve le premier actuateur du type demandé
   * @private
   */
  _getFirstActuatorOfType(type, capabilities) {
    if (!capabilities?.actuators) return null;

    for (let i = 0; i < capabilities.actuators.length; i++) {
      const actuator = capabilities.actuators[i];
      if (actuator[type]) {
        return i;
      }
    }
    return null;
  }

  // ============================================================================
  // NOUVELLES MÉTHODES D'ACCÈS AUX MÉTADONNÉES
  // ============================================================================

  getChannelMetadata(channel) {
    return this.channelMetadata?.get(channel) || {};
  }

  getAllChannelMetadata() {
    if (!this.channelMetadata) return {};
    const result = {};
    for (const [channel, metadata] of this.channelMetadata.entries()) {
      result[channel] = metadata;
    }
    return result;
  }

  // Méthode utilitaire pour l'auto-mapping intelligent
  getChannelSuggestedActuator(channel) {
    const metadata = this.getChannelMetadata(channel);
    
    // 1. Hint explicite depuis métadonnées
    if (metadata.actuatorHint !== undefined) {
      return metadata.actuatorHint;
    }
    
    // 2. Mapping par type détecté
    const typeMapping = {
      'linear': 0,     // Premier actuateur linéaire
      'vibrate': 1,    // Premier actuateur vibration  
      'rotate': 2,     // Premier actuateur rotation
      'oscillate': 3   // Premier actuateur oscillation
    };
    
    return typeMapping[metadata.type] || null;
  }
  enable(channel, enabled = true) {
    return this.setOptions(channel, { enabled });
  }

  setScale(channel, scale) {
    return this.setOptions(channel, { scale });
  }

  setOffset(channel, timeOffset) {
    return this.setOptions(channel, { timeOffset });
  }

  setInvert(channel, invert) {
    return this.setOptions(channel, { invert });
  }

  setActuator(channel, actuatorIndex) {
    return this.setOptions(channel, { actuatorIndex });
  }

  // Debug info avec métadonnées enrichies
  getDebugInfo() {
    if (!this.data) return { loaded: false };

    const channelInfo = {};
    for (const [channel, actions] of this.channels.entries()) {
      const values = actions.map(a => a.value);
      const cache = this.interpolationCache.get(channel);
      const metadata = this.getChannelMetadata(channel);
      
      channelInfo[channel] = {
        count: actions.length,
        timeRange: actions.length > 0 ? [actions[0].time, actions[actions.length - 1].time] : null,
        valueRange: values.length > 0 ? [Math.min(...values), Math.max(...values)] : null,
        options: this.getOptions(channel),
        // ✅ NOUVEAU: Métadonnées du canal
        metadata: metadata,
        suggestedActuator: this.getChannelSuggestedActuator(channel),
        // Cache info
        cache: cache ? {
          leftIndex: cache.leftIndex,
          rightIndex: cache.rightIndex,
          lastTime: cache.lastTime
        } : null
      };
    }

    return {
      loaded: true,
      duration: this.duration,
      globalScale: this.globalScale,
      globalOffset: this.globalOffset,
      channels: channelInfo,
      // Stats globales du cache
      cacheStats: {
        activeCaches: this.interpolationCache.size,
        seekThreshold: this.seekThreshold
      }
    };
  }

  // Private methods (inchangés sauf _reset)
  _extractChannels() {
    this.channels.clear();

    // ✅ NOUVEAU: Exploitation des métadonnées pour détection intelligente
    
    // 1. Essayer d'extraire les infos depuis les métadonnées globales
    const metadata = this._extractMetadata();
    
    // 2. Format standard single-channel (toujours en premier)
    if (this.data.actions?.length) {
      this._processActions('pos', this.data.actions, metadata);
    }

    // 3. ✅ NOUVEAU: Détection flexible des canaux multi-axes
    this._extractMultiAxisChannels(metadata);

    // 4. Format tracks nested (format alternatif)
    if (this.data.tracks) {
      for (const [trackName, trackData] of Object.entries(this.data.tracks)) {
        if (trackData.actions?.length) {
          const trackMetadata = { ...metadata, ...trackData.metadata };
          this._processActions(trackName, trackData.actions, trackMetadata);
        }
      }
    }

    if (this.channels.size === 0) {
      throw new Error('No valid channels found');
    }
  }

  // ✅ NOUVELLE MÉTHODE: Extraction intelligente des métadonnées
  _extractMetadata() {
    const metadata = {
      // Métadonnées globales du script
      title: this.data.title || this.data.metadata?.title,
      creator: this.data.creator || this.data.metadata?.creator,
      description: this.data.description || this.data.metadata?.description,
      duration: this.data.duration || this.data.metadata?.duration,
      
      // ✅ NOUVEAU: Infos sur les axes/canaux
      axes: this.data.axes || this.data.metadata?.axes || {},
      channels: this.data.channels || this.data.metadata?.channels || {},
      actuators: this.data.actuators || this.data.metadata?.actuators || {},
      
      // Type de device ciblé
      device: this.data.device || this.data.metadata?.device,
      deviceType: this.data.deviceType || this.data.metadata?.deviceType,
      
      // Infos de mapping
      mapping: this.data.mapping || this.data.metadata?.mapping || {}
    };
    
    return metadata;
  }

  // ✅ NOUVELLE MÉTHODE: Détection flexible des canaux multi-axes
  _extractMultiAxisChannels(metadata) {
    // Rechercher tous les champs qui contiennent des arrays d'actions
    for (const [key, value] of Object.entries(this.data)) {
      if (this._isActionArray(value)) {
        // Éviter de retraiter 'actions' (déjà fait)
        if (key === 'actions') continue;
        
        // Déterminer le type/nom du canal à partir des métadonnées ou heuristiques
        const channelInfo = this._analyzeChannelFromMetadata(key, value, metadata);
        
        this._processActions(channelInfo.name, value, { 
          ...metadata, 
          ...channelInfo.metadata 
        });
      }
    }
  }

  // ✅ NOUVELLE MÉTHODE: Test si un objet est un array d'actions valide
  _isActionArray(value) {
    return Array.isArray(value) && 
           value.length > 0 && 
           value.every(action => 
             typeof action === 'object' && 
             action !== null &&
             // ✅ SEUL CRITÈRE SÛR: présence du timestamp
             (action.at !== undefined || action.t !== undefined || action.time !== undefined)
           );
  }

  // ✅ NOUVELLE MÉTHODE: Analyse intelligente du canal depuis métadonnées + heuristiques
  _analyzeChannelFromMetadata(fieldName, actions, metadata) {
    let channelName = fieldName;
    let channelType = 'unknown';
    let actuatorHint = null;
    
    // 1. ✅ PRIORITÉ: Métadonnées explicites
    if (metadata.channels && metadata.channels[fieldName]) {
      const channelMeta = metadata.channels[fieldName];
      channelName = channelMeta.name || channelMeta.displayName || fieldName;
      channelType = channelMeta.type || channelMeta.actuatorType;
      actuatorHint = channelMeta.actuator || channelMeta.actuatorIndex;
    }
    
    // 2. ✅ FALLBACK: Mapping explicite 
    else if (metadata.mapping && metadata.mapping[fieldName]) {
      const mapping = metadata.mapping[fieldName];
      channelName = mapping.name || fieldName;
      channelType = mapping.type;
      actuatorHint = mapping.actuator;
    }
    
    // 3. ✅ FALLBACK: Analyse heuristique du nom de champ
    else {
      const analysis = this._heuristicChannelAnalysis(fieldName, actions);
      channelName = analysis.name;
      channelType = analysis.type;
    }
    
    return {
      name: channelName,
      metadata: {
        type: channelType,
        actuatorHint: actuatorHint,
        originalField: fieldName,
        source: metadata.channels?.[fieldName] ? 'metadata' : 
                metadata.mapping?.[fieldName] ? 'mapping' : 'heuristic'
      }
    };
  }

  // ✅ NOUVELLE MÉTHODE: Analyse heuristique améliorée
  _heuristicChannelAnalysis(fieldName, actions) {
    const nameLower = fieldName.toLowerCase();
    
    // Patterns de détection par nom
    const patterns = {
      // Mouvement linéaire
      linear: /^(pos|position|stroke|linear|up|down|vertical|y)$/i,
      
      // Vibration
      vibrate: /^(vib|vibr|vibrat|buzz|rumble|shake)$/i,
      
      // Rotation  
      rotate: /^(rot|rotat|twist|spin|turn|roll|angle|pitch|yaw)$/i,
      
      // Oscillation
      oscillate: /^(osc|oscill|swing|wave|sway)$/i,
      
      // Autres mouvements
      squeeze: /^(squeeze|constrict|pressure|grip|clamp)$/i,
      suck: /^(suck|suction|vacuum|pump)$/i,
      
      // Axes géométriques
      x_axis: /^(x|horizontal|left|right|lateral)$/i,
      z_axis: /^(z|depth|forward|back|front|rear)$/i
    };
    
    // ✅ NOUVEAU: Analyse des valeurs pour affiner le type
    const valueAnalysis = this._analyzeActionValues(actions);
    
    for (const [type, regex] of Object.entries(patterns)) {
      if (regex.test(nameLower)) {
        return {
          name: fieldName,
          type: type.replace('_axis', ''),
          confidence: 'high',
          valueRange: valueAnalysis.range,
          isBipolar: valueAnalysis.isBipolar
        };
      }
    }
    
    // ✅ FALLBACK: Analyse par valeurs si nom inconnu
    if (valueAnalysis.isBipolar) {
      return { name: fieldName, type: 'rotate', confidence: 'low' };
    } else {
      return { name: fieldName, type: 'linear', confidence: 'low' };
    }
  }

  // ✅ NOUVELLE MÉTHODE: Analyse des valeurs d'actions pour déduire le type
  _analyzeActionValues(actions) {
    if (actions.length === 0) {
      return { range: [0, 0], isBipolar: false };
    }
    
    // Extraire toutes les valeurs possibles (champs flexibles)
    const values = actions.map(action => {
      return action.pos !== undefined ? action.pos :
             action.v !== undefined ? action.v :
             action.value !== undefined ? action.value :
             action.val !== undefined ? action.val :
             action.position !== undefined ? action.position :
             action.intensity !== undefined ? action.intensity :
             0; // fallback
    }).filter(v => typeof v === 'number');
    
    if (values.length === 0) {
      return { range: [0, 0], isBipolar: false };
    }
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const hasNegative = min < 0;
    const hasPositive = max > 0;
    
    return {
      range: [min, max],
      isBipolar: hasNegative && hasPositive, // Valeurs des deux côtés de zéro
      span: max - min
    };
  }

  _processActions(channel, actions, metadata = {}) {
    const processed = [];
    const isRotate = metadata.type === 'rotate' || this._isRotateChannel(channel);

    // ✅ NOUVEAU: Première passe - extraction flexible des valeurs
    const rawValues = [];
    for (const action of actions) {
      const time = action.at || action.t || action.time;
      let value;

      if (isRotate) {
        value = this._extractRotateValue(action);
      } else {
        // ✅ NOUVEAU: Extraction flexible des valeurs selon métadonnées ou heuristique
        value = this._extractActionValue(action, metadata);
      }

      if (typeof time !== 'number' || typeof value !== 'number') continue;

      rawValues.push({ time, value });
    }

    if (rawValues.length === 0) return;

    // Renormalisation universelle par max absolu
    const { normalizedValues, detectedConvention } = this._detectAndNormalize(rawValues, isRotate);

    // ✅ NOUVEAU: Log enrichi avec métadonnées
    const sourceInfo = metadata.source ? ` (${metadata.source})` : '';
    const typeInfo = metadata.type ? ` [${metadata.type}]` : '';
    console.log(`Channel "${channel}"${typeInfo}: ${detectedConvention} (${rawValues.length} actions)${sourceInfo}`);

    // Construction finale avec valeurs normalisées
    for (const { time, value } of normalizedValues) {
      processed.push({ time, value });
    }

    if (processed.length > 0) {
      processed.sort((a, b) => a.time - b.time);
      this.channels.set(channel, processed);
      
      // ✅ NOUVEAU: Stocker les métadonnées du canal pour usage ultérieur
      if (!this.channelMetadata) this.channelMetadata = new Map();
      this.channelMetadata.set(channel, metadata);
    }
  }

  // ✅ NOUVELLE MÉTHODE: Extraction flexible des valeurs d'action
  _extractActionValue(action, metadata = {}) {
    // 1. ✅ PRIORITÉ: Champ spécifié dans les métadonnées
    if (metadata.valueField && action[metadata.valueField] !== undefined) {
      return action[metadata.valueField];
    }
    
    // 2. ✅ FALLBACK: Ordre de priorité standard mais flexible
    const valueFields = [
      'pos', 'position',           // Position classique
      'v', 'val', 'value',         // Valeur générique
      'intensity', 'power',        // Intensité
      'speed', 'velocity',         // Vitesse
      'amplitude', 'magnitude',    // Amplitude
      'level', 'strength'          // Niveau/Force
    ];
    
    for (const field of valueFields) {
      if (action[field] !== undefined) {
        return action[field];
      }
    }
    
    // 3. ✅ DERNIER RECOURS: Chercher le premier champ numérique (hors temps)
    for (const [key, value] of Object.entries(action)) {
      if (typeof value === 'number' && !['at', 't', 'time'].includes(key)) {
        console.warn(`Using fallback field "${key}" for action value`);
        return value;
      }
    }
    
    return 0; // Fallback absolu
  }

  // ✅ NOUVELLE MÉTHODE: Renormalisation universelle par max absolu
  _detectAndNormalize(rawValues, isRotate) {
    if (rawValues.length === 0) {
      return { normalizedValues: [], detectedConvention: 'empty' };
    }

    // ✅ RENORMALISATION UNIVERSELLE: Utilise toujours la plage dynamique complète
    // Après cette étape, toutes les valeurs sont dans [0,1] ou [-1,1]
    // Le paramètre 'scale' devient alors un vrai % d'intensité max du jouet
    const absValues = rawValues.map(item => Math.abs(item.value));
    const maxAbsValue = Math.max(...absValues);
    
    // Éviter la division par zéro (cas où toutes les valeurs sont 0)
    const normalizationFactor = maxAbsValue > 0 ? (1 / maxAbsValue) : 1;
    
    // Log de la normalisation appliquée
    const scalingInfo = maxAbsValue > 0 ? 
      `max=${maxAbsValue.toFixed(2)} -> factor=${normalizationFactor.toFixed(4)}` : 
      'all zeros';

    // Appliquer la renormalisation universelle
    const normalizedValues = rawValues.map(({ time, value }) => {
      let normalizedValue = value * normalizationFactor;
      
      // Clamp selon le type de canal (sécurité)
      if (isRotate) {
        normalizedValue = Math.max(-1, Math.min(1, normalizedValue));
      } else {
        normalizedValue = Math.max(0, Math.min(1, normalizedValue));
      }

      return { time, value: normalizedValue };
    });

    return { 
      normalizedValues, 
      detectedConvention: scalingInfo
    };
  }

  _isRotateChannel(channel) {
    return /rotate|rotation|twist|spin|turn/i.test(channel);
  }

  _extractRotateValue(action) {
    // ✅ MODIFIÉ: Extraction brute sans normalisation prématurée
    // La normalisation se fera dans _detectAndNormalize()
    
    if (action.pos !== undefined) {
      return action.pos;
    }
    if (action.rotate !== undefined) {
      return action.rotate;
    }
    if (action.speed !== undefined && action.clockwise !== undefined) {
      // Préserver le signe selon la direction
      const speed = Math.abs(action.speed);
      return action.clockwise ? speed : -speed;
    }
    if (action.v !== undefined) {
      return action.v;
    }
    return 0;
  }

  _calculateDuration() {
    let maxTime = 0;
    for (const actions of this.channels.values()) {
      if (actions.length > 0) {
        maxTime = Math.max(maxTime, actions[actions.length - 1].time);
      }
    }
    this.duration = maxTime / 1000; // Convert to seconds
  }

  _initOptions() {
    this.options.clear();
    for (const channel of this.getChannels()) {
      this.options.set(channel, { ...this.defaults });
    }
  }

  _validateOptions(opts) {
    return typeof opts.enabled === 'boolean' &&
           typeof opts.scale === 'number' && opts.scale >= 0 && opts.scale <= 5.0 && // ✅ MODIFIÉ: Permet boost jusqu'à 500%
           typeof opts.timeOffset === 'number' && Math.abs(opts.timeOffset) <= 10.0 && // ✅ MODIFIÉ: Limite offset à ±10s
           typeof opts.invert === 'boolean' &&
           (opts.actuatorIndex === null || (typeof opts.actuatorIndex === 'number' && opts.actuatorIndex >= 0));
  }

  _processValue(rawValue, opts) {
    let value = rawValue;
    
    // Apply invert
    if (opts.invert) value = 1 - value;
    
    // Apply individual channel scale
    value *= opts.scale;
    
    // ✅ NOUVEAU: Apply global scale (master intensity control)
    value *= this.globalScale;
    
    // Clamp final pour sécurité jouet
    return Math.max(0, Math.min(1, value));
  }

  _reset() {
    this.data = null;
    this.channels.clear();
    this.options.clear();
    this.duration = 0;
    this.globalOffset = 0.0;
    this.globalScale = 1.0;  // ✅ NOUVEAU: Reset global scale
    this._clearInterpolationCache();
    this.channelMetadata?.clear();
  }
}

export default FunscriptManager;