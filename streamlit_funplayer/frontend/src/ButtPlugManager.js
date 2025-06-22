import { 
  ButtplugClient, 
  ButtplugBrowserWebsocketClientConnector,
  ActuatorType 
} from 'buttplug';

/**
 * ButtPlugManager - Version simplifiée pour usage avec Managers singleton
 * Plus de sur-engineering pour les problèmes de remount React
 */
class ButtPlugManager {
  constructor() {
    // Core buttplug objects
    this.client = null;
    this.connector = null;
    this.initialized = false;
    
    // Default Initiface Websocket URL 
    this.intifaceUrl = 'ws://localhost:12345';  

    // Device management
    this.devices = new Map();
    this.selectedDevice = null;
    this.capabilities = null;
    
    // State tracking
    this.isConnected = false;
    this.isScanning = false;
    
    // Default actuator mappings
    this.defaults = { 
      vibrate: null, 
      linear: null, 
      rotate: null, 
      oscillate: null, 
      global: null 
    };
    
    // Event callbacks
    this.onConfigChanged = null
    this.onConnectionChanged = null;
    this.onDeviceChanged = null;
    this.onError = null;
    
    // Performance optimization
    this.throttleMap = new Map();
    this.minCommandInterval = 16; // ~60fps max
  }

  // ============================================================================
  // ✅ NOUVEAU: CONFIGURATION METHODS
  // ============================================================================

  /**
   * Définir l'URL WebSocket Intiface
   */
  setIntifaceUrl(url) {
    const cleanUrl = this._validateAndCleanUrl(url);
    
    if (this.intifaceUrl !== cleanUrl) {
      const wasConnected = this.isConnected;
      const oldUrl = this.intifaceUrl;
      
      this.intifaceUrl = cleanUrl;
      
      // Mettre à jour le connector si l'URL change
      if (this.connector && this.connector._url !== cleanUrl) {
        this.connector = new ButtplugBrowserWebsocketClientConnector(cleanUrl);
      }
      
      console.log(`ButtPlug URL changed: ${oldUrl} → ${cleanUrl}`);
      
      // Notifier le changement
      this._notifyConfigChanged('intifaceUrl', {
        oldUrl,
        newUrl: cleanUrl,
        wasConnected
      });
    }
  }

  /**
   * Récupérer l'URL WebSocket actuelle
   */
  getIntifaceUrl() {
    return this.intifaceUrl;
  }

  /**
   * Récupérer la configuration complète
   */
  getConfig() {
    return {
      intifaceUrl: this.intifaceUrl,
      // Autres configs futures
    };
  }

  /**
   * Valider et nettoyer une URL WebSocket
   * @private
   */
  _validateAndCleanUrl(url) {
    if (!url || typeof url !== 'string') {
      return 'ws://localhost:12345';
    }
    
    // Nettoyer l'URL
    let cleanUrl = url.trim();
    
    // Ajouter ws:// si manquant
    if (!cleanUrl.startsWith('ws://') && !cleanUrl.startsWith('wss://')) {
      cleanUrl = 'ws://' + cleanUrl;
    }
    
    // Ajouter port par défaut si manquant
    try {
      const urlObj = new URL(cleanUrl);
      if (!urlObj.port) {
        urlObj.port = '12345';
        cleanUrl = urlObj.toString();
      }
    } catch (error) {
      console.warn('Invalid WebSocket URL, using default:', url);
      return 'ws://localhost:12345';
    }
    
    return cleanUrl;
  }

  // ============================================================================
  // INITIALIZATION & CONNECTION - Simplifié
  // ============================================================================

  async init() {
    if (this.initialized) {
      return true;
    }

    try {
      this.client = new ButtplugClient('FunPlayer');
      this.connector = new ButtplugBrowserWebsocketClientConnector('ws://localhost:12345');
      
      // Setup event listeners
      this.client.addListener('deviceadded', this._onDeviceAdded);
      this.client.addListener('deviceremoved', this._onDeviceRemoved);
      this.client.addListener('disconnect', this._onDisconnect);
      
      this.initialized = true;
      console.log('ButtPlug client initialized');
      return true;

    } catch (error) {
      console.error('ButtPlug initialization failed:', error);
      this._notifyError('Initialization failed', error);
      return false;
    }
  }

  async connect(address = null) {
    if (this.isConnected) {
      console.log('Already connected');
      return true;
    }

    // ✅ MODIFIÉ: Utiliser l'URL configurée si aucune adresse fournie
    const targetUrl = address || this.intifaceUrl;

    // Init if needed
    if (!this.initialized) {
      const initSuccess = await this.init();
      if (!initSuccess) {
        return false;
      }
    }

    // Update connector if address changed
    if (this.connector._url !== targetUrl) {
      this.connector = new ButtplugBrowserWebsocketClientConnector(targetUrl);
    }

    try {
      console.log('Connecting to Intiface Central at:', targetUrl);
      
      await this.client.connect(this.connector);
      this.isConnected = true;
      
      // ✅ NOUVEAU: Mettre à jour l'URL configurée si une adresse explicite a été fournie
      if (address && address !== this.intifaceUrl) {
        this.setIntifaceUrl(address);
      }
      
      // Load existing devices
      const existingDevices = this.client.devices;
      existingDevices.forEach(device => {
        this.devices.set(device.index, device);
      });
      
      console.log(`Connected with ${existingDevices.length} devices`);
      this._notifyConnection(true);
      return true;

    } catch (error) {
      console.error('Connection failed:', error);
      this._notifyError('Connection failed', error);
      return false;
    }
  }

  async disconnect() {
    if (!this.isConnected) return;
    
    try {
      if (this.client) {
        await this.client.disconnect();
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
    
    this._resetState();
  }

  async cleanup() {
    // Stop all devices
    if (this.isConnected && this.client) {
      try {
        await this.client.stopAllDevices();
      } catch (error) {
        console.error('Stop all devices failed:', error);
      }
    }
    
    // Disconnect
    if (this.isConnected && this.client) {
      try {
        await this.client.disconnect();
      } catch (error) {
        console.error('Disconnect failed:', error);
      }
    }
    
    // Cleanup references
    if (this.client) {
      try {
        this.client.removeAllListeners();
      } catch (error) {
        console.error('Remove listeners failed:', error);
      }
      this.client = null;
    }
    
    this.connector = null;
    this.throttleMap.clear();
    
    // Reset state
    this.initialized = false;
    this.isConnected = false;
    this.isScanning = false;
    this.devices.clear();
    this._resetDevice();

    console.log('ButtPlug cleanup completed');
  }

  // ============================================================================
  // DEVICE SCANNING & MANAGEMENT - Inchangé
  // ============================================================================

  async scan(timeout = 5000) {
    if (!this.isConnected || this.isScanning) return [];

    try {
      this.isScanning = true;
      const initialCount = this.devices.size;
      
      console.log('Starting device scan...');
      await this.client.startScanning();
      
      await new Promise(resolve => setTimeout(resolve, timeout));
      
      await this.client.stopScanning();
      
      const newCount = this.devices.size - initialCount;
      console.log(`Scan complete: ${newCount} new devices found`);
      
      const allDevices = Array.from(this.devices.values());
      return allDevices.slice(-newCount);
    } catch (error) {
      console.error('Scan failed:', error);
      return [];
    } finally {
      this.isScanning = false;
    }
  }

  getDevices() {
    return Array.from(this.devices.values());
  }

  selectDevice(deviceIndex) {
    if (deviceIndex === null || deviceIndex === undefined) {
      this._resetDevice();
      return true;
    }

    const device = this.devices.get(deviceIndex);
    if (!device) {
      console.error(`Device ${deviceIndex} not found`);
      return false;
    }

    this.selectedDevice = device;
    this.capabilities = this._buildCapabilities(device);
    this._setDefaults();
    
    console.log(`Selected device: ${device.name} (${deviceIndex})`);
    this._notifyDeviceChanged(device);
    return true;
  }

  getSelected() {
    return this.selectedDevice;
  }

  getCapabilities() {
    return this.capabilities;
  }

  getDeviceInfo(deviceIndex = null) {
    const device = deviceIndex !== null ? this.devices.get(deviceIndex) : this.selectedDevice;
    if (!device) return null;
    
    return {
      index: device.index,
      name: device.name,
      displayName: device.displayName,
      messageTimingGap: device.messageTimingGap,
      connected: true,
      capabilities: deviceIndex === null && this.selectedDevice === device ? 
        this.capabilities : this._buildCapabilities(device)
    };
  }

  // ============================================================================
  // HAPTIC COMMANDS - Simplifiés
  // ============================================================================

  async vibrate(value, actuatorIndex = null) {
    return this._sendScalarCommand(ActuatorType.Vibrate, value, actuatorIndex);
  }

  async oscillate(value, actuatorIndex = null) {
    return this._sendScalarCommand(ActuatorType.Oscillate, value, actuatorIndex);
  }

  async linear(value, duration = 100, actuatorIndex = null) {
    if (!this.selectedDevice) {
      throw new Error('No device selected');
    }
    
    const resolvedIndex = this._resolveActuatorIndex('linear', actuatorIndex);
    if (resolvedIndex === null) {
      throw new Error('No linear actuator available');
    }

    try {
      const clampedValue = Math.max(0, Math.min(1, value));
      const clampedDuration = Math.max(1, Math.min(20000, duration));
      
      await this.selectedDevice.linear([[clampedValue, clampedDuration]]);
      return true;
    } catch (error) {
      console.error('Linear command failed:', error);
      return false;
    }
  }

  async rotate(value, actuatorIndex = null) {
    if (!this.selectedDevice) {
      throw new Error('No device selected');
    }
    
    const resolvedIndex = this._resolveActuatorIndex('rotate', actuatorIndex);
    if (resolvedIndex === null) {
      throw new Error('No rotate actuator available');
    }

    try {
      const speed = Math.abs(value);
      const clockwise = value >= 0;
      
      await this.selectedDevice.rotate([[speed, clockwise]]);
      return true;
    } catch (error) {
      console.error('Rotate command failed:', error);
      return false;
    }
  }

  async sendDefault(value, duration = 100) {
    if (this.defaults.global === null) {
      throw new Error('No default actuator set');
    }
    
    const type = this.getActuatorType(this.defaults.global);
    switch (type) {
      case 'vibrate':
        return this.vibrate(value, this.defaults.global);
      case 'oscillate':
        return this.oscillate(value, this.defaults.global);
      case 'linear':
        return this.linear(value, duration, this.defaults.global);
      case 'rotate':
        return this.rotate(value, this.defaults.global);
      default:
        throw new Error(`Unknown actuator type: ${type}`);
    }
  }

  async stopAll() {
    if (!this.isConnected || !this.client) return;
    
    try {
      await this.client.stopAllDevices();
      console.log('All devices stopped');
    } catch (error) {
      console.error('Stop all failed:', error);
    }
  }

  // ============================================================================
  // PERFORMANCE & UTILITY - Inchangé
  // ============================================================================

  async sendThrottled(type, value, actuatorIndex, options = {}) {
    const now = Date.now();
    const key = `${type}-${actuatorIndex}`;
    const lastSent = this.throttleMap.get(key) || 0;
    
    if (now - lastSent < this.minCommandInterval && !options.force) {
      return true;
    }
    
    this.throttleMap.set(key, now);
    
    try {
      switch (type) {
        case 'vibrate':
          return await this.vibrate(value, actuatorIndex);
        case 'oscillate':
          return await this.oscillate(value, actuatorIndex);
        case 'linear':
          return await this.linear(value, options.duration || 100, actuatorIndex);
        case 'rotate':
          return await this.rotate(value, actuatorIndex);
        default:
          console.error(`Unknown command type: ${type}`);
          return false;
      }
    } catch (error) {
      console.error(`Throttled ${type} command failed:`, error);
      return false;
    }
  }

  // ============================================================================
  // DEVICE INFO & SENSORS - Inchangé
  // ============================================================================

  async getBattery(deviceIndex = null) {
    const device = deviceIndex !== null ? this.devices.get(deviceIndex) : this.selectedDevice;
    if (!device || !device.hasBattery) return null;
    
    try {
      return await device.battery();
    } catch (error) {
      console.error('Battery read failed:', error);
      return null;
    }
  }

  async getRSSI(deviceIndex = null) {
    const device = deviceIndex !== null ? this.devices.get(deviceIndex) : this.selectedDevice;
    if (!device || !device.hasRssi) return null;
    
    try {
      return await device.rssi();
    } catch (error) {
      console.error('RSSI read failed:', error);
      return null;
    }
  }

  // ============================================================================
  // CONFIGURATION & STATUS - Inchangé
  // ============================================================================

  setDefaults(vibrate = null, linear = null, rotate = null, oscillate = null, global = null) {
    if (!this.capabilities) return false;
    
    this.defaults.vibrate = this._resolveDefault('vibrate', vibrate);
    this.defaults.linear = this._resolveDefault('linear', linear);
    this.defaults.rotate = this._resolveDefault('rotate', rotate);
    this.defaults.oscillate = this._resolveDefault('oscillate', oscillate);
    this.defaults.global = global !== null ? global : this._pickGlobalDefault();
    
    return true;
  }

  getDefaults() {
    return { ...this.defaults };
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      isScanning: this.isScanning,
      deviceCount: this.devices.size,
      selectedDevice: this.selectedDevice ? {
        index: this.selectedDevice.index,
        name: this.selectedDevice.name
      } : null,
      capabilities: this.capabilities,
      defaults: this.getDefaults(),
      config: this.getConfig()  // ✅ AJOUTÉ: Include config in status
    };
  }

  getActuatorType(index) {
    if (!this.capabilities || !this.capabilities.actuators[index]) {
      return null;
    }
    
    const caps = this.capabilities.actuators[index];
    if (caps.vibrate) return 'vibrate';
    if (caps.oscillate) return 'oscillate';
    if (caps.linear) return 'linear';
    if (caps.rotate) return 'rotate';
    return null;
  }

  getActuatorsByType(type) {
    if (!this.capabilities) return [];
    
    return this.capabilities.actuators
      .map((caps, index) => caps[type] ? index : null)
      .filter(index => index !== null);
  }

  // ============================================================================
  // PRIVATE METHODS - Simplifiés
  // ============================================================================

  _sendScalarCommand = async (actuatorType, value, actuatorIndex = null) => {
    if (!this.selectedDevice) {
      throw new Error('No device selected');
    }

    const typeKey = actuatorType === ActuatorType.Vibrate ? 'vibrate' : 'oscillate';
    const resolvedIndex = this._resolveActuatorIndex(typeKey, actuatorIndex);
    
    if (resolvedIndex === null) {
      throw new Error(`No ${actuatorType} actuator available`);
    }

    try {
      const clampedValue = Math.max(0, Math.min(1, value));
      
      if (actuatorType === ActuatorType.Vibrate) {
        await this.selectedDevice.vibrate(clampedValue);
      } else if (actuatorType === ActuatorType.Oscillate) {
        await this.selectedDevice.oscillate(clampedValue);
      }
      
      return true;
    } catch (error) {
      console.error(`${actuatorType} command failed:`, error);
      return false;
    }
  }

  _buildCapabilities = (device) => {
    const messageAttrs = device.messageAttributes;
    const actuators = [];
    const counts = { vibrate: 0, linear: 0, rotate: 0, oscillate: 0 };
    let maxIndex = -1;

    // Process scalar commands
    if (messageAttrs.ScalarCmd) {
      messageAttrs.ScalarCmd.forEach((attr) => {
        maxIndex = Math.max(maxIndex, attr.Index);
        
        if (!actuators[attr.Index]) {
          actuators[attr.Index] = { 
            index: attr.Index, 
            vibrate: false, 
            oscillate: false, 
            linear: false, 
            rotate: false,
            stepCount: attr.StepCount || 20,
            featureDescriptor: attr.FeatureDescriptor || ''
          };
        }
        
        if (attr.ActuatorType === ActuatorType.Vibrate) {
          actuators[attr.Index].vibrate = true;
          counts.vibrate++;
        } else if (attr.ActuatorType === ActuatorType.Oscillate) {
          actuators[attr.Index].oscillate = true;
          counts.oscillate++;
        }
      });
    }

    // Process linear commands
    if (messageAttrs.LinearCmd) {
      messageAttrs.LinearCmd.forEach((attr) => {
        maxIndex = Math.max(maxIndex, attr.Index);
        
        if (!actuators[attr.Index]) {
          actuators[attr.Index] = { 
            index: attr.Index, 
            vibrate: false, 
            oscillate: false, 
            linear: false, 
            rotate: false,
            stepCount: attr.StepCount || 20,
            featureDescriptor: attr.FeatureDescriptor || ''
          };
        }
        
        actuators[attr.Index].linear = true;
        counts.linear++;
      });
    }

    // Process rotate commands
    if (messageAttrs.RotateCmd) {
      messageAttrs.RotateCmd.forEach((attr) => {
        maxIndex = Math.max(maxIndex, attr.Index);
        
        if (!actuators[attr.Index]) {
          actuators[attr.Index] = { 
            index: attr.Index, 
            vibrate: false, 
            oscillate: false, 
            linear: false, 
            rotate: false,
            stepCount: attr.StepCount || 20,
            featureDescriptor: attr.FeatureDescriptor || ''
          };
        }
        
        actuators[attr.Index].rotate = true;
        counts.rotate++;
      });
    }

    // Create final actuator array
    const validActuators = [];
    for (let i = 0; i <= maxIndex; i++) {
      if (actuators[i]) {
        validActuators.push(actuators[i]);
      }
    }

    return {
      actuators: validActuators,
      counts,
      total: validActuators.length,
      deviceName: device.name,
      deviceIndex: device.index,
      messageTimingGap: device.messageTimingGap || 0
    };
  }

  _resolveActuatorIndex = (type, requestedIndex) => {
    if (requestedIndex !== null && requestedIndex !== undefined) {
      if (this.capabilities?.actuators[requestedIndex]?.[type]) {
        return requestedIndex;
      }
      return null;
    }
    
    if (this.defaults[type] !== null) {
      return this.defaults[type];
    }
    
    const available = this.getActuatorsByType(type);
    return available.length > 0 ? available[0] : null;
  }

  _resolveDefault = (type, requested) => {
    if (requested !== null && this.capabilities?.actuators[requested]?.[type]) {
      return requested;
    }
    
    const available = this.getActuatorsByType(type);
    return available.length > 0 ? available[0] : null;
  }

  _pickGlobalDefault = () => {
    return this.defaults.linear ?? this.defaults.vibrate ?? this.defaults.rotate ?? this.defaults.oscillate ?? null;
  }

  _setDefaults = () => {
    if (!this.capabilities) return;
    
    this.defaults.vibrate = this._resolveDefault('vibrate', null);
    this.defaults.oscillate = this._resolveDefault('oscillate', null);
    this.defaults.linear = this._resolveDefault('linear', null);
    this.defaults.rotate = this._resolveDefault('rotate', null);
    this.defaults.global = this._pickGlobalDefault();
  }

  _resetDevice = () => {
    this.selectedDevice = null;
    this.capabilities = null;
    this.defaults = { vibrate: null, linear: null, rotate: null, oscillate: null, global: null };
    this._notifyDeviceChanged(null);
  }

  _resetState = () => {
    this.isConnected = false;
    this.isScanning = false;
    this.devices.clear();
    this.throttleMap.clear();
    this._resetDevice();
    this._notifyConnection(false);
  }

  // ============================================================================
  // EVENT HANDLERS - Simplifiés
  // ============================================================================

  _onDeviceAdded = (device) => {
    this.devices.set(device.index, device);
    console.log(`Device added: ${device.name} (${device.index})`);
    this._notifyDeviceChanged();
  }

  _onDeviceRemoved = (device) => {
    this.devices.delete(device.index);
    
    if (this.selectedDevice?.index === device.index) {
      this._resetDevice();
    }
    
    console.log(`Device removed: ${device.name} (${device.index})`);
    this._notifyDeviceChanged();
  }

  _onDisconnect = () => {
    console.log('Disconnected from server');
    this._resetState();
  }

  // ============================================================================
  // NOTIFICATIONS - Simplifiées
  // ============================================================================

  _notifyConfigChanged = (key, data) => {
    if (this.onConfigChanged) {
      this.onConfigChanged(key, data);
    }
  }

  _notifyConnection = (connected) => {
    if (this.onConnectionChanged) {
      this.onConnectionChanged(connected);
    }
  }

  _notifyDeviceChanged = (device = undefined) => {
    if (this.onDeviceChanged) {
      this.onDeviceChanged(device);
    }
  }

  _notifyError = (message, error = null) => {
    console.error(`[ButtPlug] ${message}`, error);
    
    if (this.onError) {
      let errorMessage = 'Unknown error';
      
      if (error) {
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error.message) {
          errorMessage = error.message;
        } else {
          errorMessage = String(error);
        }
      }
      
      this.onError(message, errorMessage);
    }
  }
}

export default ButtPlugManager;