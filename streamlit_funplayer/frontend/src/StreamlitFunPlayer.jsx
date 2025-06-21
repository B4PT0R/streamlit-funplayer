import React from 'react';
import { Streamlit, StreamlitComponentBase, withStreamlitConnection } from 'streamlit-component-lib';
import FunPlayer from './FunPlayer';
import './theme.css'; // Import CSS universel - seulement dans le wrapper Streamlit

class StreamlitFunPlayer extends StreamlitComponentBase {

  // Convertir le thème Streamlit en variables CSS
  getStreamlitThemeVariables = () => {
    const { theme } = this.props;
    
    // Si pas de thème Streamlit, utiliser les valeurs par défaut du CSS
    if (!theme) return {};

    // Mapping direct Streamlit → Variables CSS universelles
    const themeVars = {};
    
    // Couleurs principales
    if (theme.primaryColor) {
      themeVars['--primary-color'] = theme.primaryColor;
      // Dériver les couleurs d'interaction depuis la couleur primaire
      themeVars['--hover-color'] = this.hexToRgba(theme.primaryColor, 0.1);
      themeVars['--active-color'] = this.hexToRgba(theme.primaryColor, 0.2);
    }
    
    if (theme.backgroundColor) {
      themeVars['--background-color'] = theme.backgroundColor;
    }
    
    if (theme.secondaryBackgroundColor) {
      themeVars['--secondary-background-color'] = theme.secondaryBackgroundColor;
    }
    
    if (theme.textColor) {
      themeVars['--text-color'] = theme.textColor;
      // Dériver la couleur disabled depuis la couleur du texte
      themeVars['--disabled-color'] = this.hexToRgba(theme.textColor, 0.3);
    }
    
    if (theme.linkColor) {
      themeVars['--link-color'] = theme.linkColor;
    }
    
    if (theme.codeBackgroundColor) {
      themeVars['--code-background-color'] = theme.codeBackgroundColor;
    }
    
    if (theme.borderColor) {
      themeVars['--border-color'] = theme.borderColor;
    }
    
    // Polices
    if (theme.font) {
      themeVars['--font-family'] = theme.font;
    }
    
    if (theme.codeFont) {
      themeVars['--code-font-family'] = theme.codeFont;
    }
    
    if (theme.headingFont) {
      themeVars['--heading-font-family'] = theme.headingFont;
    }
    
    // Radius et bordures
    if (theme.baseRadius) {
      themeVars['--base-radius'] = theme.baseRadius;
    }
    
    if (theme.showWidgetBorder !== undefined) {
      themeVars['--widget-border-width'] = theme.showWidgetBorder ? '1px' : '0px';
    }
    
    // Sidebar si défini
    if (theme.sidebar) {
      if (theme.sidebar.backgroundColor) {
        themeVars['--sidebar-background-color'] = theme.sidebar.backgroundColor;
      }
      if (theme.sidebar.textColor) {
        themeVars['--sidebar-text-color'] = theme.sidebar.textColor;
      }
      if (theme.sidebar.borderColor) {
        themeVars['--sidebar-border-color'] = theme.sidebar.borderColor;
      }
    }
    
    return themeVars;
  };

  // Utilitaire pour convertir hex en rgba
  hexToRgba = (hex, alpha) => {
    if (!hex) return null;
    
    // Nettoyer le hex
    hex = hex.replace('#', '');
    
    // Parser les composants RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  componentDidMount() {
    this.handleResize();
  }

  componentDidUpdate() {
    this.handleResize();
  }

  handleResize = () => {
    // Petit délai pour laisser le DOM se mettre à jour
    if (!Streamlit || typeof Streamlit.setFrameHeight !== 'function') {
      setTimeout(() => this.handleResize(), 100);
      return;
    }
    setTimeout(() => {
      const height = document.body.scrollHeight;
      Streamlit.setFrameHeight(height);
    }, 50);
  }

  convertCustomTheme = (theme) => {
    const themeVars = {};
    
    // Mapping direct des propriétés
    const mappings = {
      'primaryColor': '--primary-color',
      'backgroundColor': '--background-color', 
      'secondaryBackgroundColor': '--secondary-background-color',
      'textColor': '--text-color',
      'borderColor': '--border-color',
      'fontFamily': '--font-family',
      'baseRadius': '--base-radius',
      'spacing': '--spacing'
    };
    
    Object.entries(mappings).forEach(([key, cssVar]) => {
      if (theme[key]) {
        themeVars[cssVar] = theme[key];
      }
    });
    
    // Générer les couleurs dérivées si primaryColor fourni
    if (theme.primaryColor) {
      themeVars['--hover-color'] = this.hexToRgba(theme.primaryColor, 0.1);
      themeVars['--focus-color'] = this.hexToRgba(theme.primaryColor, 0.25);
    }
    
    return themeVars;
  }

  render() {
    const { args, theme: streamlitTheme } = this.props;
    
    // Extract props
    const playlist = args?.playlist || null;
    // ✅ NOUVEAU: Thème custom depuis Python
    const customTheme = args?.theme || null;
    
    // ✅ PRIORITÉ: Custom theme > Streamlit theme
    const themeVariables = customTheme ? 
      this.convertCustomTheme(customTheme) : 
      this.getStreamlitThemeVariables();
    
    const dataTheme = (customTheme?.base || streamlitTheme?.base) === 'dark' ? 'dark' : 'light';
    
    return (
      <div
        style={themeVariables} 
        data-theme={dataTheme}
        className="streamlit-funplayer"
      >
        <FunPlayer 
          playlist={playlist}
          onResize={this.handleResize}
        />
      </div>
    );
  }
}

export default withStreamlitConnection(StreamlitFunPlayer);