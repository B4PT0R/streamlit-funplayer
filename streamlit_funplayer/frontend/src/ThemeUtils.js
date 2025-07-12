/**
 * ThemeUtils.js - Utilitaires centralisés pour la gestion des thèmes
 * 
 * Centralise toute la logique de thème commune entre :
 * - FunPlayer.jsx (contexte Streamlit DOM normal)
 * - FunPlayerWebComponent.js (contexte Shadow DOM)
 */

// ============================================================================
// CONSTANTES
// ============================================================================

export const CSS_VAR_MAPPINGS = {
  'primaryColor': '--fp-primary-color',
  'backgroundColor': '--fp-background-color',
  'secondaryBackgroundColor': '--fp-secondary-background-color',
  'textColor': '--fp-text-color',
  'borderColor': '--fp-border-color',
  'fontFamily': '--fp-font-family',
  'baseRadius': '--fp-base-radius',
  'spacing': '--fp-spacing'
};

export const DEFAULT_THEME_VALUES = {
  '--fp-primary-color': '#FF4B4B',
  '--fp-background-color': '#FFFFFF',
  '--fp-secondary-background-color': '#F0F2F6',
  '--fp-text-color': '#262730',
  '--fp-border-color': '#E6EBF5',
  '--fp-font-family': '"Source Sans Pro", sans-serif',
  '--fp-base-radius': '0.5rem',
  '--fp-spacing': '0.5rem',
  '--fp-hover-color': 'rgba(255, 75, 75, 0.1)',
  '--fp-focus-color': 'rgba(255, 75, 75, 0.25)',
  '--fp-disabled-color': 'rgba(38, 39, 48, 0.3)'
};

export const DARK_THEME_OVERRIDES = {
  '--fp-background-color': '#0E1117',
  '--fp-secondary-background-color': '#262730',
  '--fp-text-color': '#FAFAFA',
  '--fp-border-color': '#464954'
};

// ============================================================================
// UTILITAIRES DE CONVERSION
// ============================================================================

/**
 * Convertit une clé de thème en variable CSS préfixée
 * @param {string} key - Clé du thème (ex: 'primaryColor')
 * @returns {string} Variable CSS (ex: '--fp-primary-color')
 */
export function convertToCssVar(key) {
  return CSS_VAR_MAPPINGS[key] || `--fp-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}

/**
 * Convertit une couleur hex en rgba avec alpha
 * @param {string} hex - Couleur hex (ex: '#FF4B4B')
 * @param {number} alpha - Valeur alpha (0-1)
 * @returns {string|null} Couleur rgba ou null si invalide
 */
export function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return null;
  
  // Supprimer le # si présent
  hex = hex.replace('#', '');
  
  // Gérer les formats courts (#RGB)
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  if (hex.length !== 6) return null;
  
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// GÉNÉRATION DES STYLES CSS
// ============================================================================

/**
 * Construit les variables CSS à partir d'un objet thème
 * @param {Object} theme - Objet thème avec propriétés comme primaryColor, etc.
 * @returns {Object} { cssVars: string, derivedVars: string }
 */
export function buildThemeCSS(theme) {
  const cssVars = [];
  const derivedVars = [];
  
  // Variables principales du thème
  Object.entries(theme).forEach(([key, value]) => {
    const cssVar = convertToCssVar(key);
    if (cssVar && key !== 'base') {
      cssVars.push(`${cssVar}: ${value};`);
      
      // Générer les couleurs dérivées pour primaryColor
      if (key === 'primaryColor') {
        const hoverColor = hexToRgba(value, 0.1);
        const focusColor = hexToRgba(value, 0.25);
        if (hoverColor) derivedVars.push(`--fp-hover-color: ${hoverColor};`);
        if (focusColor) derivedVars.push(`--fp-focus-color: ${focusColor};`);
      }
    }
  });
  
  return {
    cssVars: cssVars.join('\n      '),
    derivedVars: derivedVars.join('\n      ')
  };
}

/**
 * Génère le CSS pour le mode sombre
 * @returns {string} CSS pour surcharges dark mode
 */
export function getDarkThemeCSS() {
  const overrides = Object.entries(DARK_THEME_OVERRIDES)
    .map(([key, value]) => `${key}: ${value};`)
    .join('\n      ');
  
  return `
    /* Surcharges automatiques pour le mode sombre */
    ${overrides}
  `;
}

// ============================================================================
// APPLICATION DU THÈME
// ============================================================================

/**
 * Applique un thème sur un élément DOM
 * @param {Object} theme - Objet thème
 * @param {HTMLElement} element - Élément DOM cible
 * @param {Object} options - Options { setDataTheme: boolean }
 */
export function applyThemeToElement(theme, element, options = {}) {
  if (!theme || !element) return false;
  
  const { setDataTheme = true } = options;
  
  try {
    // Appliquer les variables CSS
    Object.entries(theme).forEach(([key, value]) => {
      if (key !== 'base') {
        const cssVar = convertToCssVar(key);
        element.style.setProperty(cssVar, value);
        
        // Couleurs dérivées pour primaryColor
        if (key === 'primaryColor') {
          const hoverColor = hexToRgba(value, 0.1);
          const focusColor = hexToRgba(value, 0.25);
          if (hoverColor) element.style.setProperty('--fp-hover-color', hoverColor);
          if (focusColor) element.style.setProperty('--fp-focus-color', focusColor);
        }
      }
    });
    
    // Appliquer l'attribut data-theme
    if (setDataTheme && theme.base) {
      element.setAttribute('data-theme', theme.base);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to apply theme to element:', error);
    return false;
  }
}

/**
 * Génère un style CSS complet pour Shadow DOM
 * @param {Object} theme - Objet thème
 * @param {string} containerSelector - Sélecteur du container (ex: '.funplayer-shadow-container')
 * @returns {string} CSS complet pour injection
 */
export function buildShadowDOMThemeCSS(theme, containerSelector = '.funplayer-shadow-container') {
  const themeCSS = buildThemeCSS(theme);
  const darkCSS = theme.base === 'dark' ? getDarkThemeCSS() : '';
  
  return `
    /* ============================================================================
      THEME STYLES - Variables préfixées "fp-" (pas de conflit avec site hôte)
      ============================================================================ */
    
    ${containerSelector} {
      /* Variables CSS avec préfixe fp- */
      ${themeCSS.cssVars}
      ${themeCSS.derivedVars}
      
      /* Application directe des variables préfixées */
      background: var(--fp-background-color, #FFFFFF);
      color: var(--fp-text-color, #262730);
      border-radius: var(--fp-base-radius, 0.5rem);
      
      /* Variables par défaut */
      ${Object.entries(DEFAULT_THEME_VALUES)
        .map(([key, value]) => `${key}: ${value};`)
        .join('\n      ')}
      
      /* Mode sombre */
      ${darkCSS}
    }
    
    /* Application sur les composants FunPlayer */
    .fp-btn {
      border-color: var(--fp-border-color, #E6EBF5);
      color: var(--fp-text-color, #262730);
    }
    
    .fp-btn:hover {
      background: var(--fp-hover-color, rgba(255, 75, 75, 0.1));
      border-color: var(--fp-primary-color, #FF4B4B);
    }
    
    .fp-section {
      background: var(--fp-secondary-background-color, #F0F2F6);
      color: var(--fp-text-color, #262730);
    }
  `;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Valide qu'un objet thème est valide
 * @param {Object} theme - Objet thème à valider
 * @returns {boolean} true si valide
 */
export function isValidTheme(theme) {
  if (!theme || typeof theme !== 'object') return false;
  
  // Au moins une propriété valide
  const validKeys = Object.keys(CSS_VAR_MAPPINGS).concat(['base']);
  return Object.keys(theme).some(key => validKeys.includes(key));
}

/**
 * Nettoie un objet thème en supprimant les propriétés invalides
 * @param {Object} theme - Objet thème à nettoyer
 * @returns {Object} Thème nettoyé
 */
export function sanitizeTheme(theme) {
  if (!isValidTheme(theme)) return {};
  
  const sanitized = {};
  const validKeys = Object.keys(CSS_VAR_MAPPINGS).concat(['base']);
  
  Object.entries(theme).forEach(([key, value]) => {
    if (validKeys.includes(key) && value != null) {
      sanitized[key] = value;
    }
  });
  
  return sanitized;
}

// ============================================================================
// EXPORT DEFAULT POUR USAGE SIMPLE
// ============================================================================

export default {
  // Constantes
  CSS_VAR_MAPPINGS,
  DEFAULT_THEME_VALUES,
  DARK_THEME_OVERRIDES,
  
  // Utilitaires de base
  convertToCssVar,
  hexToRgba,
  buildThemeCSS,
  getDarkThemeCSS,
  
  // Application du thème
  applyThemeToElement,
  buildShadowDOMThemeCSS,
  
  // Validation
  isValidTheme,
  sanitizeTheme
};