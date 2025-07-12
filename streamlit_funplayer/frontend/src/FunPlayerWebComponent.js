import React from 'react';
import ReactDOM from 'react-dom/client';
import FunPlayer from './FunPlayer';
import { createCallbackProps, ALL_SUPPORTED_EVENTS } from './FunPlayerEvents';
import ThemeUtils from './ThemeUtils';  // ✅ AJOUTÉ

/**
 * FunPlayerWebComponent - ✅ Web Component pour intégration universelle
 * 
 * Usage:
 * <fun-player 
 *   playlist='[{"sources": "video.mp4", "funscript": {...}}]'
 *   theme='{"primaryColor": "#ff4b4b"}'
 * ></fun-player>
 * 
 * Événements:
 * player.addEventListener('funplayer-play', (e) => console.log(e.detail));
 * player.addEventListener('funplayer-resize', (e) => adjustIframe(e.detail));
 */

class FunPlayerWebComponent extends HTMLElement {
  constructor() {
    super();
    
    // Shadow DOM pour isolation CSS/JS
    console.log('🔍 Creating shadow DOM...');
    this.attachShadow({ mode: 'open' });
    console.log('🔍 Shadow DOM created:', !!this.shadowRoot);
    
    // État interne
    this.reactRoot = null;
    this.stylesInjected = false;
    this.initializationPromise = null;
    
    // Variables pour la sync des styles
    this.styleObserver = null;
    this.lastProcessedStylesCount = 0;
    
    console.log('✅ FunPlayerWebComponent constructed');
  }

  // ============================================================================
  // LIFECYCLE WEB COMPONENT
  // ============================================================================

  connectedCallback() {
    console.log('🔗 FunPlayerWebComponent connected to DOM');
    
    // Prévenir les multiples initialisations
    if (this.initializationPromise) {
      console.log('⚠️ Already initializing, skipping...');
      return;
    }
    
    this.initializationPromise = this.initializeAsync();
  }

  disconnectedCallback() {
    console.log('🔌 FunPlayerWebComponent disconnected from DOM');
    this.cleanup();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    
    console.log(`🔄 Attribute changed: ${name}`, { oldValue, newValue });
    
    if (name === 'theme' && this.reactRoot) {
      try {
        const theme = JSON.parse(newValue || '{}');
        this.applyThemeToShadowDOM(theme);
      } catch (error) {
        console.warn('⚠️ Invalid theme JSON in attributeChangedCallback:', error.message);
      }
    }
    
    if (this.reactRoot) {
      this.updateReactComponent();
    }
  }

  static get observedAttributes() {
    return ['playlist', 'theme'];
  }

  // ============================================================================
  // INITIALISATION ASYNC
  // ============================================================================

  async initializeAsync() {
    try {
      console.log('🚀 Initializing FunPlayerWebComponent...');
      
      // 1. Injection des styles (prioritaire)
      await this.injectStylesAsync();
      
      // 2. Initialisation React
      this.initializeReact();
      
      console.log('✅ FunPlayerWebComponent fully initialized');
      
    } catch (error) {
      console.error('❌ FunPlayerWebComponent initialization failed:', error);
      this.showErrorFallback(error);
    }
  }

  // ============================================================================
  // THEME HANDLING - ✅ REFACTORISÉ avec ThemeUtils
  // ============================================================================

  applyThemeToShadowDOM(theme) {
    if (!theme || !this.shadowRoot) return;
    
    console.log('🎨 Applying theme with ThemeUtils (fp- prefixed variables, no host site conflicts)');
    
    // ✅ Validation du thème via ThemeUtils
    const sanitizedTheme = ThemeUtils.sanitizeTheme(theme);
    if (!ThemeUtils.isValidTheme(sanitizedTheme)) {
      console.warn('⚠️ Invalid theme provided:', theme);
      return;
    }
    
    // ✅ Créer ou récupérer l'élément style pour les thèmes
    let themeStyle = this.shadowRoot.getElementById('funplayer-theme-styles');
    
    if (!themeStyle) {
      themeStyle = document.createElement('style');
      themeStyle.id = 'funplayer-theme-styles';
      this.shadowRoot.appendChild(themeStyle);
    }
    
    // ✅ SIMPLIFIÉ: Utilisation de ThemeUtils.buildShadowDOMThemeCSS
    themeStyle.textContent = ThemeUtils.buildShadowDOMThemeCSS(sanitizedTheme, '.funplayer-shadow-container');
    
    console.log('✅ Theme applied successfully with ThemeUtils', {
      primaryColor: sanitizedTheme.primaryColor,
      base: sanitizedTheme.base,
      isValid: ThemeUtils.isValidTheme(sanitizedTheme),
      varsCount: Object.keys(sanitizedTheme).length
    });
  }

  // ============================================================================
  // ✅ SUPPRIMÉ : Toutes les méthodes de thème (maintenant dans ThemeUtils)
  // - buildThemeCSS()
  // - getDarkThemeCSS() 
  // - hexToRgba()
  // - convertToCssVar()
  // ============================================================================

  // ============================================================================
  // REACT INTEGRATION
  // ============================================================================

  initializeReact() {
    try {
      console.log('⚛️ Initializing React in Shadow DOM...');
      
      // Container pour React dans le Shadow DOM
      const reactContainer = document.createElement('div');
      reactContainer.className = 'funplayer-shadow-container';
      this.shadowRoot.appendChild(reactContainer);
      
      // Créer root React
      this.reactRoot = ReactDOM.createRoot(reactContainer);
      
      // Render initial
      this.updateReactComponent();
      
      console.log('✅ React initialized successfully in Shadow DOM');
      
    } catch (error) {
      console.error('❌ React initialization failed:', error);
      throw error;
    }
  }

  updateReactComponent() {
    if (!this.reactRoot) return;
    
    try {
      const props = this.buildReactProps();
      
      console.log('🔄 Updating React component with props:', {
        hasPlaylist: !!props.playlist,
        hasTheme: !!props.theme,
        eventCallbacks: Object.keys(props).filter(key => key.startsWith('on')).length
      });
      
      this.reactRoot.render(React.createElement(FunPlayer, props));
      
    } catch (error) {
      console.error('❌ React component update failed:', error);
      this.showErrorFallback(error);
    }
  }

  buildReactProps() {
    const props = {};
    
    // 1. Parse des attributs principaux
    try {
      const playlistAttr = this.getAttribute('playlist');
      if (playlistAttr) {
        props.playlist = JSON.parse(playlistAttr);
      }
    } catch (error) {
      console.warn('⚠️ Invalid playlist JSON:', error.message);
      props.playlist = [];
    }
    
    try {
      const themeAttr = this.getAttribute('theme');
      if (themeAttr) {
        const theme = JSON.parse(themeAttr);
        props.theme = theme;
        
        // ✅ Appliquer le thème au Shadow DOM via ThemeUtils
        this.applyThemeToShadowDOM(theme);
      }
    } catch (error) {
      console.warn('⚠️ Invalid theme JSON:', error.message);
    }
    
    // 2. Création automatique des callbacks événements
    const eventCallbacks = createCallbackProps(this);
    Object.assign(props, eventCallbacks);
    
    // 3. Callback resize spécial (pour iframe integration)
    props.onResize = (dimensions) => {
      console.log('📏 FunPlayer resize:', dimensions);
      
      if (dimensions && dimensions.height) {
        // ✅ Ajuster le Web Component à la taille naturelle
        this.style.height = `${dimensions.height}px`;
        console.log('🎬 Web Component resized to:', dimensions.height + 'px');
      }
      
      // ✅ Propager l'événement pour intégration externe
      this.dispatchEvent(new CustomEvent('funplayer-resize', {
        detail: dimensions || { width: 0, height: 0 },
        bubbles: true
      }));
    };
    
    return props;
  }

  // ============================================================================
  // STYLES INJECTION - Inchangé (spécifique au Shadow DOM)
  // ============================================================================

  async injectStylesAsync() {
    if (this.stylesInjected) return;
    
    try {
      console.log('🎨 Injecting ALL styles into Shadow DOM...');
      
      // ✅ 1. Copier TOUS les styles existants
      const allStyles = this.extractAllExistingStyles();
      
      // ✅ 2. Créer le style element avec TOUT
      const style = document.createElement('style');
      style.id = 'funplayer-injected-styles';
      style.textContent = `
        /* ============================================================================
           TOUS LES STYLES DU DOM PRINCIPAL (approche exhaustive)
           ============================================================================ */
        
        ${allStyles}
        
        /* ============================================================================
           WEB COMPONENT HOST STYLES ADDITIONNELS - ✅ Variables préfixées fp-
           ============================================================================ */
        
        :host {
          display: block;
          width: 100%;
          height: auto;
          min-height: 200px;
          transition: height 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .funplayer-shadow-container {
          width: 100%;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          
          /* ✅ MODIFIÉ: Variables par défaut avec préfixe fp- (évite conflits site hôte) */
          ${Object.entries(ThemeUtils.DEFAULT_THEME_VALUES)
            .map(([key, value]) => `${key}: ${value};`)
            .join('\n          ')}
          
          /* Application des variables préfixées */
          background: var(--fp-background-color);
          color: var(--fp-text-color);
          border-radius: var(--fp-base-radius);
        }
      `;
      
      this.shadowRoot.appendChild(style);
      this.stylesInjected = true;
      
      // ✅ 3. Observer les changements pour capturer lazy loading
      this.observeStyleChanges();
      
      console.log('✅ All styles successfully injected into Shadow DOM');
      console.log(`📊 Total CSS length: ${allStyles.length} characters`);
      
    } catch (error) {
      console.error('❌ Failed to inject styles:', error);
      this.injectFallbackStylesOnly();
    }
  }

  extractAllExistingStyles() {
    let allCSS = '';
    
    try {
      console.log('🔍 Extracting ALL styles from main DOM...');
      
      // 1. Styles inline <style>
      const styleTags = document.querySelectorAll('style');
      styleTags.forEach((style, index) => {
        if (style.textContent) {
          allCSS += `\n/* <style> tag ${index + 1} */\n${style.textContent}\n`;
        }
      });
      
      // 2. Stylesheets <link>
      Array.from(document.styleSheets).forEach((sheet, index) => {
        try {
          const rules = Array.from(sheet.cssRules || sheet.rules || []);
          const sheetCSS = rules.map(rule => rule.cssText).join('\n');
          if (sheetCSS) {
            allCSS += `\n/* Stylesheet ${index + 1} */\n${sheetCSS}\n`;
          }
        } catch (e) {
          console.warn(`Cannot access stylesheet ${index + 1} (CORS):`, e.message);
        }
      });
      
      console.log(`✅ Extracted ${allCSS.length} characters of CSS`);
      return allCSS;
      
    } catch (error) {
      console.error('❌ CSS extraction failed:', error);
      return '';
    }
  }

  observeStyleChanges() {
    if (this.styleObserver) return;
    
    try {
      this.styleObserver = new MutationObserver((mutations) => {
        let stylesChanged = false;
        
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.tagName === 'STYLE' || (node.tagName === 'LINK' && node.rel === 'stylesheet')) {
                stylesChanged = true;
              }
            });
          }
        });
        
        if (stylesChanged) {
          console.log('🔍 New styles detected, updating Shadow DOM...');
          this.updateStylesFromChanges();
        }
      });
      
      this.styleObserver.observe(document.head, {
        childList: true,
        subtree: true
      });
      
      console.log('👁️ Style observer started');
      
    } catch (error) {
      console.warn('⚠️ Cannot observe style changes:', error);
    }
  }

  updateStylesFromChanges() {
    const existingStyleElement = this.shadowRoot.getElementById('funplayer-injected-styles');
    if (!existingStyleElement) return;
    
    const updatedStyles = this.extractAllExistingStyles();
    
    existingStyleElement.textContent = `
      /* ============================================================================
         TOUS LES STYLES DU DOM PRINCIPAL (mis à jour)
         ============================================================================ */
      
      ${updatedStyles}
      
      /* ============================================================================
         WEB COMPONENT HOST STYLES ADDITIONNELS - Variables préfixées fp-
         ============================================================================ */
      
      :host {
        display: block;
        width: 100%;
        height: auto;
        min-height: 200px;
        transition: height 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      
      .funplayer-shadow-container {
        width: 100%;
        min-height: 100%;
        display: flex;
        flex-direction: column;
        
        /* Variables par défaut avec préfixe fp- */
        ${Object.entries(ThemeUtils.DEFAULT_THEME_VALUES)
          .map(([key, value]) => `${key}: ${value};`)
          .join('\n        ')}
        
        /* Application des variables préfixées */
        background: var(--fp-background-color);
        color: var(--fp-text-color);
        border-radius: var(--fp-base-radius);
      }
    `;
    
    console.log('✅ Styles updated for lazy loading');
  }

  injectFallbackStylesOnly() {
    if (this.stylesInjected) return;
    
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        width: 100%;
        height: auto;
        min-height: 200px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      
      .funplayer-shadow-container {
        width: 100%;
        min-height: 200px;
        display: flex;
        flex-direction: column;
        padding: 1rem;
        
        /* ✅ Variables fallback avec préfixe fp- */
        ${Object.entries(ThemeUtils.DEFAULT_THEME_VALUES)
          .map(([key, value]) => `${key}: ${value};`)
          .join('\n        ')}
        
        background: var(--fp-background-color);
        color: var(--fp-text-color);
      }
    `;
    
    this.shadowRoot.appendChild(style);
    this.stylesInjected = true;
    
    console.log('🚨 Using minimal fallback styles with fp- prefixed variables');
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  showErrorFallback(error) {
    if (!this.shadowRoot) return;
    
    this.shadowRoot.innerHTML = `
      <style>
        .error-fallback {
          padding: 20px;
          background: #fed7d7;
          color: #742a2a;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .error-fallback h3 { margin-top: 0; }
        .error-fallback details { margin: 10px 0; }
        .error-fallback pre { 
          background: #2d3748; 
          color: #e2e8f0; 
          padding: 10px; 
          border-radius: 4px; 
          overflow: auto;
          font-size: 12px;
        }
      </style>
      <div class="error-fallback">
        <h3>⚠️ FunPlayer Error</h3>
        <p>Failed to load the media player component.</p>
        <details>
          <summary>Error details</summary>
          <pre>${error.message}\n\n${error.stack || ''}</pre>
        </details>
        <p style="margin-top: 15px; font-size: 12px; color: #666;">
          Check browser console for more details.
        </p>
      </div>
    `;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  cleanup() {
    try {
      // Observer cleanup
      if (this.styleObserver) {
        this.styleObserver.disconnect();
        this.styleObserver = null;
      }
      
      // React cleanup
      if (this.reactRoot) {
        this.reactRoot.unmount();
        this.reactRoot = null;
      }
      
      // Reset flags
      this.stylesInjected = false;
      this.initializationPromise = null;
      
      console.log('🧹 FunPlayerWebComponent cleaned up');
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
}

// ============================================================================
// REGISTRATION & EXPORT
// ============================================================================

export function registerFunPlayerWebComponent() {
  if (!window.customElements.get('fun-player')) {
    window.customElements.define('fun-player', FunPlayerWebComponent);
    console.log('✅ <fun-player> Web Component registered');
    return true;
  } else {
    console.log('ℹ️ <fun-player> already registered');
    return false;
  }
}

export default FunPlayerWebComponent;