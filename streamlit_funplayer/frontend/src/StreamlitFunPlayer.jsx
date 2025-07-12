import React from 'react';
import { Streamlit, StreamlitComponentBase, withStreamlitConnection } from 'streamlit-component-lib';
import FunPlayer from './FunPlayer';
import ThemeUtils from './ThemeUtils';
import './funplayer.scss';

class StreamlitFunPlayer extends StreamlitComponentBase {
  constructor(props) {
    super(props);
    
    this.state = {
      isStreamlitReady: false,
      lastHeight: 0
    };
    
    // Debouncer pour setFrameHeight
    this.resizeTimeout = null;
  }

  componentDidMount() {
    this.waitForStreamlitReady().then(() => {
      this.setState({ isStreamlitReady: true });
      this.handleResize();
    });
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.isStreamlitReady && !prevState.isStreamlitReady) {
      this.handleResize();
    }
  }

  componentWillUnmount() {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
  }

  // ============================================================================
  // STREAMLIT INTEGRATION - Inchangé
  // ============================================================================

  waitForStreamlitReady = async () => {
    return new Promise((resolve) => {
      const checkStreamlit = () => {
        if (Streamlit && 
            typeof Streamlit.setFrameHeight === 'function' && 
            typeof Streamlit.setComponentValue === 'function') {
          resolve();
        } else {
          setTimeout(checkStreamlit, 10);
        }
      };
      checkStreamlit();
    });
  }

  handleResize = () => {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    
    this.resizeTimeout = setTimeout(() => {
      if (!this.state.isStreamlitReady || !Streamlit || typeof Streamlit.setFrameHeight !== 'function') {
        return;
      }

      try {
        const height = document.body.scrollHeight;
        
        if (Math.abs(height - this.state.lastHeight) > 5) {
          Streamlit.setFrameHeight(height);
          this.setState({ lastHeight: height });
        }
      } catch (error) {
        console.error('StreamlitFunPlayer: setFrameHeight failed:', error);
      }
    }, 50);
  }

  // ============================================================================
  // THEME MANAGEMENT - Inchangé
  // ============================================================================

  getStreamlitThemeVariables = () => {
    const { theme } = this.props;
    
    if (!theme) return {};

    const themeVars = {};
    
    // ✅ MODIFIÉ: Utilisation de ThemeUtils pour les variables préfixées
    if (theme.primaryColor) {
      themeVars['--fp-primary-color'] = theme.primaryColor;  // ✅ Préfixé
      themeVars['--fp-hover-color'] = ThemeUtils.hexToRgba(theme.primaryColor, 0.1);  // ✅ ThemeUtils
      themeVars['--fp-active-color'] = ThemeUtils.hexToRgba(theme.primaryColor, 0.2);  // ✅ ThemeUtils + préfixé
    }
    
    if (theme.backgroundColor) {
      themeVars['--fp-background-color'] = theme.backgroundColor;  // ✅ Préfixé
    }
    
    if (theme.secondaryBackgroundColor) {
      themeVars['--fp-secondary-background-color'] = theme.secondaryBackgroundColor;  // ✅ Préfixé
    }
    
    if (theme.textColor) {
      themeVars['--fp-text-color'] = theme.textColor;  // ✅ Préfixé
      themeVars['--fp-disabled-color'] = ThemeUtils.hexToRgba(theme.textColor, 0.3);  // ✅ ThemeUtils + préfixé
    }
    
    if (theme.borderColor) {
      themeVars['--fp-border-color'] = theme.borderColor;  // ✅ Préfixé
    }
    
    if (theme.font) {
      themeVars['--fp-font-family'] = theme.font;  // ✅ Préfixé
    }
    
    if (theme.baseRadius) {
      themeVars['--fp-base-radius'] = theme.baseRadius;  // ✅ Préfixé
    }
    
    return themeVars;
  };

  convertCustomTheme = (theme) => {
    // ✅ SIMPLIFIÉ: Utilisation de ThemeUtils pour validation et conversion
    const sanitizedTheme = ThemeUtils.sanitizeTheme(theme);
    if (!ThemeUtils.isValidTheme(sanitizedTheme)) return {};
    
    const themeVars = {};
    
    // ✅ SIMPLIFIÉ: Utilisation directe de ThemeUtils.convertToCssVar
    Object.entries(sanitizedTheme).forEach(([key, cssVar]) => {
      if (key !== 'base') {
        const cssVarName = ThemeUtils.convertToCssVar(key);
        themeVars[cssVarName] = sanitizedTheme[key];
      }
    });
    
    // ✅ SIMPLIFIÉ: Couleurs dérivées via ThemeUtils
    if (sanitizedTheme.primaryColor) {
      const hoverColor = ThemeUtils.hexToRgba(sanitizedTheme.primaryColor, 0.1);
      const focusColor = ThemeUtils.hexToRgba(sanitizedTheme.primaryColor, 0.25);
      if (hoverColor) themeVars['--fp-hover-color'] = hoverColor;
      if (focusColor) themeVars['--fp-focus-color'] = focusColor;
    }
    
    return themeVars;
  }

  render() {
    const { args, theme: streamlitTheme } = this.props;
    const { isStreamlitReady } = this.state;
    
    // Extract props - Plus simple car plus de refs à passer
    const playlist = args?.playlist || null;
    const customTheme = args?.theme || null;
    
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
        {isStreamlitReady ? (
          <FunPlayer 
            playlist={playlist}
            theme={customTheme}
            onResize={this.handleResize}
          />
        ) : (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center',
            color: 'var(--text-color, #666)'
          }}>
            Loading...
          </div>
        )}
      </div>
    );
  }
}

export default withStreamlitConnection(StreamlitFunPlayer);