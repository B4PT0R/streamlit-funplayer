# Streamlit FunPlayer

A comprehensive media player component for synchronized audio/video and haptic playback using funscripts and Buttplug.io compatible devices.

## ✨ Features

### 🎥 Universal Media Support
- **Video playback**: Standard 2D video formats (MP4, WebM, MOV, AVI)
- **VR video support**:  3D SBS/180°/360° video with A-Frame integration
- **Audio playback**: MP3, WAV, OGG, M4A, AAC formats
- **Timeline-only mode**: Haptic-only playback without media (generates silent audio)
- **Playlist support**: Multiple items with automatic progression and manual navigation

### 🎮 Advanced Haptic Integration
- **Buttplug.io ecosystem**: Full compatibility with Intiface Central and 100+ supported devices
- **Multi-channel funscripts**: Support for complex scripts with multiple actuator channels (pos, vibrate, rotate, linear, etc.)
- **Intelligent channel mapping**: Automatic detection and mapping of funscript channels to device actuators
- **Per-channel configuration**: Individual scale, time offset, range, and invert settings for each channel
- **High-frequency updates**: Configurable refresh rates from 10Hz to 120Hz for smooth haptic feedback
- **Real-time interpolation**: Smooth value transitions between funscript keyframes

### ⚙️ Professional Configuration
- **Device management**: Automatic scanning, connection, and capability detection
- **Advanced timing controls**: Global and per-channel time offsets for perfect synchronization
- **Scaling and range control**: Fine-tune intensity and output ranges per actuator
- **Multiple actuator types**: Support for vibration, linear motion, rotation, and oscillation
- **Virtual mode**: Test and develop without physical devices

### 📊 Visual Feedback
- **Real-time haptic visualizer**: Live waveform display with gaussian interpolation
- **Multi-actuator visualization**: Color-coded display for multiple simultaneous channels
- **Performance monitoring**: Update rate and timing statistics
- **Debug information**: Comprehensive state inspection and troubleshooting tools

### 🎨 Streamlit Integration
- **Automatic theming**: Seamless integration with Streamlit's light/dark themes
- **Responsive design**: Adapts to Streamlit's layout system
- **Custom themes**: Override colors, fonts, and styling via Python
- **Component lifecycle**: Proper cleanup and resource management

## 🚀 Quick Start

### Prerequisites

1. **Install Intiface Central**
   ```bash
   # Download from https://intiface.com/central/
   # Start the WebSocket server (default: ws://localhost:12345)
   ```

2. **Install the component**
   ```bash
   pip install streamlit-funplayer
   ```

### Basic Usage

```python
import streamlit as st
from streamlit_funplayer import funplayer

st.title("🎮 FunPlayer Demo")

# Simple video + haptic sync
funplayer(
    playlist=[{
        'media': 'https://example.com/video.mp4',
        'funscript': 'https://example.com/script.funscript',
        'title': 'Demo Scene'
    }]
)
```

### Multiple Content Types

```python
# Audio + haptics
funplayer(
    playlist=[{
        'media': 'audio.mp3',
        'funscript': funscript_data,
        'title': 'Audio Experience'
    }]
)

# Haptic-only (no media)
funplayer(
    playlist=[{
        'funscript': 'script.funscript',
        'title': 'Pure Haptic'
    }]
)

# Mixed playlist
funplayer(
    playlist=[
        {
            'media': 'video1.mp4',
            'funscript': 'script1.funscript',
            'title': 'Scene 1'
        },
        {
            'media': 'audio2.mp3', 
            'funscript': script_data,
            'title': 'Scene 2'
        },
        {
            'funscript': 'haptic_only.funscript',
            'title': 'Haptic Only'
        }
    ]
)
```

### Working with Funscripts

```python
import json
from streamlit_funplayer import funplayer, load_funscript, create_funscript

# Load from file
funscript_data = load_funscript("my_script.funscript")

# Create programmatically
actions = [
    {"at": 0, "pos": 0},
    {"at": 1000, "pos": 100},
    {"at": 2000, "pos": 50},
    {"at": 3000, "pos": 0}
]

funscript = {
    "actions":actions, # required

    #optional metadata
    "range":100,
    "version":1,
    "title": "Generated Script",
    "duration":3000
}

funplayer(playlist=[{
    'media': 'audio.mp3',
    'funscript': funscript,
    'poster':'thumbnail.jpg'
    'title': 'Simple funscript'
}])

# Multi-channel funscript
multi_channel = {
    "version": "1.0",
    "linear": [
        {"at": 0, "pos": 0},
        {"at": 1000, "pos": 100}
    ],
    "vibrate": [
        {"at": 0, "v": 0.0},
        {"at": 1000, "v": 1.0}
    ],
    "rotate": [
        {"at": 0, "speed": 0.2, "clockwise": True},
        {"at": 1000, "speed": 0.5, "clockwise": False}
    ]
}

funplayer(playlist=[{
    'media': 'video.mp4',
    'funscript': multi_channel,
    'title': 'Multi-Channel Experience'
}])
```

### File Upload Interface

```python
import streamlit as st
import json
import base64
from streamlit_funplayer import funplayer, file_to_data_url


# UI
st.title("🎮 Upload & Play")

media_file = st.file_uploader(
    "Media File", 
    type=['mp4', 'webm', 'mp3', 'wav']
)

funscript_file = st.file_uploader(
    "Funscript File", 
    type=['funscript', 'json']
)

if media_file or funscript_file:
    playlist_item = {}
    
    if media_file:
        playlist_item['media'] = file_to_data_url(media_file) # converts file or BytesIO to base64 data url
        playlist_item['title'] = media_file.name
        
    if funscript_file:
        playlist_item['funscript'] = json.loads(
            funscript_file.getvalue().decode('utf-8')
        )
    
    funplayer(playlist=[playlist_item])
```

### Custom Themes

```python
# Dark theme
dark_theme = {
    'primaryColor': '#FF6B6B',
    'backgroundColor': '#1E1E1E',
    'secondaryBackgroundColor': '#2D2D2D',
    'textColor': '#FFFFFF',
    'borderColor': '#404040'
}

funplayer(
    playlist=[{
        'media': 'video.mp4',
        'funscript': 'script.funscript'
    }],
    theme=dark_theme
)
```

## 🔧 React Component Architecture

**streamlit-funplayer** is fundamentally a **standalone React component** that can work in any React application. The Streamlit wrapper is simply a convenience layer for Python integration.

### Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FunPlayer (React)                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │  MediaPlayer    │ │ HapticSettings  │ │   Visualizer    │    │
│  │   (Video.js)    │ │                 │ │   (Canvas)      │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ ButtPlugManager │ │FunscriptManager │ │  MediaManager   │    │
│  │  (buttplug.js)  │ │  (interpolation)│ │  (utilities)    │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                StreamlitFunPlayer (Wrapper)                     │
│              • Theme integration                                │
│              • Props conversion                                 │
│              • Streamlit lifecycle                              │
└─────────────────────────────────────────────────────────────────┘
```

### Key Technical Components

#### ButtPlugManager
```javascript
// Abstraction layer over buttplug.js
const manager = new ButtPlugManager();
await manager.connect('ws://localhost:12345');
await manager.scan(5000);
manager.selectDevice(0);
await manager.vibrate(0.8, actuatorIndex);
```

#### FunscriptManager  
```javascript
// Funscript parsing and interpolation
const fsManager = new FunscriptManager();
fsManager.load(funscriptData);
fsManager.autoMapChannels(deviceCapabilities);
const value = fsManager.interpolateAt(currentTime, 'pos');
```

#### MediaPlayer (Video.js)
```javascript
// Unified media interface with playlist support
<MediaPlayer
  playlist={processedPlaylist}
  onPlay={handlePlay}
  onTimeUpdate={handleTimeUpdate}
  onPlaylistItemChange={handleItemChange}
/>
```

#### HapticVisualizer
```javascript
// Real-time gaussian waveform visualization
<HapticVisualizerComponent
  getCurrentActuatorData={() => actuatorDataMap}
  isPlaying={isPlaying}
/>
```

### React Integration

To use FunPlayer directly in a React app:

```javascript
import FunPlayer from './FunPlayer';

function App() {
  const playlist = [
    {
      media: 'video.mp4',
      funscript: funscriptData,
      title: 'Scene 1'
    }
  ];

  return (
    <div className="app">
      <FunPlayer 
        playlist={playlist}
        onResize={() => console.log('Player resized')}
      />
    </div>
  );
}
```

### Data Flow

1. **Playlist Processing**: MediaManager converts playlist items to Video.js format
2. **Media Events**: Video.js fires play/pause/timeupdate events  
3. **Haptic Loop**: 60Hz interpolation loop syncs with media time
4. **Device Commands**: ButtPlugManager sends commands to physical devices
5. **Visualization**: Real-time canvas rendering of actuator states

### Advanced Features

#### Custom Funscript Formats
```javascript
// Supports flexible funscript schemas
{
  "actions": [...],           // Standard position channel
  "vibrate": [...],          // Vibration channel  
  "rotate": [...],           // Rotation channel
  "customChannel": [...],    // Any named channel
  "metadata": {
    "channels": {
      "customChannel": {
        "type": "linear",
        "actuator": 0
      }
    }
  }
}
```

#### Performance Optimization
- **Interpolation caching**: Efficient seeking and time progression
- **Throttled commands**: Prevents device command flooding
- **Memory management**: Automatic cleanup of media resources
- **Playlist transitions**: Seamless switching between items

#### Device Abstraction
```javascript
// Works with or without physical devices
const capabilities = buttplugManager.getCapabilities();
// → { actuators: [{vibrate: true, linear: false, ...}], counts: {...} }

// Virtual mode for development
funscriptManager.autoMapChannels(null); // Maps to virtual actuators
```

## 📋 API Reference

### funplayer()

```python
funplayer(
    playlist=None,          # List of playlist items
    theme=None,            # Custom theme dictionary  
    key=None               # Streamlit component key
)
```

### Playlist Item Format

```python
{
    'media': str,          # URL/path to media file (optional)
    'funscript': dict|str, # Funscript data or URL (optional)  
    'poster': str,         # Poster image URL (optional)
    'title': str,          # Display title (optional)
    'duration': float,     # Duration in seconds (for haptic-only)
    'media_type': str,     # Force media type detection
    'media_info': str      # Additional metadata
}
```

### Utility Functions

```python
# Load funscript from file
load_funscript(file_path: str) -> dict

# Create funscript programmatically
create_funscript(
    actions: list,         # [{"at": time_ms, "pos": 0-100}, ...]
    metadata: dict = None  # Optional metadata
) -> dict
```

## 🎯 Use Cases

- **Adult content platforms**: Synchronized interactive experiences
- **VR applications**: Immersive haptic feedback in virtual environments  
- **Audio experiences**: Music/podcast enhancement with haptic rhythm
- **Accessibility tools**: Haptic feedback for hearing-impaired users
- **Research platforms**: Haptic interaction studies and experiments
- **Gaming**: Rhythm games and interactive experiences

## 🔧 Development

### Frontend Development
```bash
cd streamlit_funplayer/frontend
npm install
npm start  # Runs on localhost:3001
```

### Testing with Streamlit
```bash
# In project root
streamlit run funplayer.py
```

### Building for Production
```bash
cd frontend  
npm run build
pip install -e .  # Install with built frontend
```

## ⚠️ Requirements

- **Python 3.9+**
- **Streamlit 1.45+** 
- **Intiface Central** (for device connectivity)
- **Modern browser** with WebSocket support
- **HTTPS connection** (required for device access in production)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Test with real devices when possible
4. Ensure Streamlit theme compatibility
5. Submit a pull request

## 📄 License

Creative Commons - see LICENSE file for details.

## 🙏 Acknowledgments

- [Buttplug.io](https://buttplug.io) - Device communication protocol
- [Intiface](https://intiface.com) - Desktop bridge application  
- [Video.js](https://videojs.com) - Media player framework
- [Streamlit](https://streamlit.io) - Python web app framework
- The funscript community for haptic scripting standards