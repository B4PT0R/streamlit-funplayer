import React from 'react';
import { Streamlit, StreamlitComponentBase, withStreamlitConnection } from 'streamlit-component-lib';
import FunPlayer from './FunPlayer';
import './theme.css';

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
    
    if (theme.primaryColor) {
      themeVars['--primary-color'] = theme.primaryColor;
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
      themeVars['--disabled-color'] = this.hexToRgba(theme.textColor, 0.3);
    }
    
    if (theme.borderColor) {
      themeVars['--border-color'] = theme.borderColor;
    }
    
    if (theme.font) {
      themeVars['--font-family'] = theme.font;
    }
    
    if (theme.baseRadius) {
      themeVars['--base-radius'] = theme.baseRadius;
    }
    
    return themeVars;
  };

  hexToRgba = (hex, alpha) => {
    if (!hex) return null;
    
    hex = hex.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  convertCustomTheme = (theme) => {
    const themeVars = {};
    
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
    
    if (theme.primaryColor) {
      themeVars['--hover-color'] = this.hexToRgba(theme.primaryColor, 0.1);
      themeVars['--focus-color'] = this.hexToRgba(theme.primaryColor, 0.25);
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