# Streamlit FunPlayer

A comprehensive media player component for synchronized audio/video and haptic playback using funscripts and Buttplug.io compatible devices.

## 🎯 What is FunPlayer?

FunPlayer creates immersive interactive media experiences by synchronizing traditional audio/video content with haptic feedback devices. Built as a React component with seamless Streamlit integration, it handles everything from basic media playback to complex multi-channel haptic orchestration.

The component serves as a bridge between your content and physical devices, enabling creators to build engaging applications for entertainment, accessibility, research, and interactive experiences.

**Core Capabilities:**
- 🎥 Universal media playback across formats and platforms
- 🎮 Real-time haptic synchronization via Buttplug.io ecosystem  
- 📱 Support for 100+ compatible haptic devices
- 🎛️ Professional-grade timing and scaling controls
- 📊 Live visualization of haptic activity

## ✨ Features

### 🎬 Universal Media Support

FunPlayer handles diverse content types with intelligent format detection and processing. Whether you're working with traditional media files or creating haptic-only experiences, the component adapts to your needs.

- **Video formats:** MP4, WebM, MOV, AVI, MKV
- **Audio formats:** MP3, WAV, OGG, M4A, AAC, FLAC  
- **VR content:** 3D SBS/180°/360° with A-Frame integration
- **Streaming protocols:** HLS (m3u8), DASH (mpd)
- **Haptic-only mode:** Generates silent audio for pure haptic experiences
- **Smart playlists:** Multiple items with auto-progression and manual navigation

### 🎮 Advanced Haptic Integration

The haptic system leverages the mature Buttplug.io ecosystem to provide reliable communication with a vast range of devices. Multi-channel funscripts enable complex experiences with different actuator types working in harmony.

- **Device ecosystem:** Full Buttplug.io compatibility via Intiface Central
- **Multi-channel scripts:** Position, vibration, rotation, linear movement
- **Intelligent mapping:** Automatic funscript channel → device actuator assignment
- **Granular control:** Per-channel scale, time offset, range, and invert settings
- **High-frequency updates:** Configurable 10Hz to 120Hz refresh rates
- **Smooth interpolation:** Real-time value transitions between funscript keyframes

### ⚙️ Professional Configuration

Device management is fully automated while still providing manual control when needed. The configuration system balances ease of use with professional-level precision for timing-critical applications.

- **Auto device management:** Scanning, connection, and capability detection
- **Precision timing:** Global and per-channel time offset controls
- **Intensity scaling:** Fine-tune output ranges for each actuator type
- **Multiple actuators:** Simultaneous vibration, linear, rotation, oscillation
- **Virtual development mode:** Test without physical devices
- **Real-time adjustments:** Live parameter changes during playback

### 📊 Visual Feedback & Monitoring

The built-in visualizer provides immediate feedback on haptic activity, helping with debugging, content creation, and user engagement. Performance monitoring ensures smooth operation across different system configurations.

- **Live waveforms:** Real-time haptic activity with gaussian interpolation
- **Multi-actuator display:** Color-coded visualization for multiple channels
- **Performance metrics:** Update rates and timing statistics displayed
- **Debug information:** Comprehensive state inspection and troubleshooting tools
- **Customizable display:** Adjustable visualization parameters

### 🎨 Seamless Streamlit Integration

The component feels native to Streamlit applications with automatic theme adaptation and responsive design. Custom styling options allow brand consistency while maintaining Streamlit's ease of use.

- **Automatic theming:** Adapts to Streamlit's light/dark themes
- **Responsive layout:** Scales properly within Streamlit's grid system
- **Custom styling:** Override colors, fonts, and visual elements from Python
- **Lifecycle management:** Proper resource cleanup and state management
- **Event integration:** Seamless communication with Streamlit's reactive model

## 🏗️ Architecture

### Design Philosophy

FunPlayer uses a modular architecture where independent managers handle specific domains without tight coupling. This design ensures reliability, maintainability, and extensibility while providing a simple API for common use cases.

The **FunPlayerCore** singleton serves as the central orchestrator, coordinating between managers through an event-driven system that maintains loose coupling while ensuring consistent state across the application.

```
┌─────────────────────────────────────────────────────────────────┐
│                        FunPlayer (React)                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │  MediaPlayer    │ │ HapticSettings  │ │   Visualizer    │    │
│  │   (Video.js)    │ │                 │ │   (Canvas)      │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ ButtPlugManager │ │FunscriptManager │ │ PlaylistManager │    │
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

### 🔧 Core Manager Responsibilities

Each manager focuses on a specific domain with clear boundaries and responsibilities:

**🔌 ButtPlugManager** - Device Communication
- Handles Intiface Central WebSocket connection and device discovery
- Manages actuator capabilities, configurations, and command routing  
- Provides abstraction layer over Buttplug.js with error handling
- Implements throttling and optimization for device communication

**📜 FunscriptManager** - Haptic Data Processing
- Parses multi-channel funscripts with flexible format support
- Provides optimized interpolation algorithms with intelligent caching
- Handles channel detection, classification, and metadata extraction
- Manages timing calculations and value transformations

**📋 PlaylistManager** - Content Organization  
- Processes and validates playlist items with format normalization
- Handles navigation, state tracking, and content transitions
- Generates fallback content (silent audio, SVG posters) when needed
- Provides unified interface for different media types

### ⚡ Real-time Processing Pipeline

During active playback, the system operates through a precisely orchestrated pipeline running at configurable frequencies up to 120Hz. This ensures smooth haptic feedback synchronized with media timing.

**Pipeline Steps:**
1. **⏱️ Timing Calculation** → FunPlayerCore calculates adjusted timestamps accounting for global and per-actuator offsets
2. **📊 Value Interpolation** → FunscriptManager interpolates raw haptic values from loaded scripts using cached algorithms  
3. **🎛️ Signal Processing** → Values are scaled, transformed, and routed to appropriate actuator channels
4. **📡 Device Commands** → ButtPlugManager sends optimized commands to connected physical devices
5. **👁️ Visual Feedback** → Haptic visualizer renders real-time waveforms and activity indicators

## 🚀 Quick Start

### Prerequisites Setup

FunPlayer requires Intiface Central as a bridge between the browser and haptic devices. This desktop application handles device management and provides a WebSocket interface for web applications.

**Installation Steps:**
- Download Intiface Central from [intiface.com/central](https://intiface.com/central/)
- Install and start the application  
- Ensure WebSocket server is running (default: `ws://localhost:12345`)
- Install the component: `pip install streamlit-funplayer`

### Basic Usage

The simplest implementation combines video content with a basic haptic script:

```python
import streamlit as st
from streamlit_funplayer import funplayer

st.title("🎮 FunPlayer Demo")

# Simple video + haptic synchronization
funplayer(
    playlist=[{
        'sources': [{'src': 'https://example.com/video.mp4', 'type': 'video/mp4'}],
        'funscript': {'actions': [{"at": 0, "pos": 0}, {"at": 1000, "pos": 100}]},
        'name': 'Demo Scene'
    }]
)
```

### Working with Different Content Types

FunPlayer adapts to various content scenarios, from traditional media to innovative haptic-only experiences:

**🎵 Audio + Haptic Enhancement**
```python
funplayer(
    playlist=[{
        'sources': [{'src': 'audio.mp3', 'type': 'audio/mp3'}],
        'funscript': funscript_data,
        'name': 'Audio Experience'
    }]
)
```

**🎮 Pure Haptic Experience (no media)**
```python
funplayer(
    playlist=[{
        'funscript': {'actions': [{"at": 0, "pos": 0}, {"at": 1000, "pos": 100}]},
        'name': 'Pure Haptic'
    }]
)
```

**📋 Mixed Content Playlists**
```python
funplayer(
    playlist=[
        {
            'sources': [{'src': 'video1.mp4', 'type': 'video/mp4'}],
            'funscript': {'actions': [...]},
            'name': 'Video Scene'
        },
        {
            'sources': [{'src': 'audio2.mp3', 'type': 'audio/mp3'}], 
            'funscript': script_data,
            'name': 'Audio Scene'
        },
        {
            'funscript': {'actions': [...]},
            'name': 'Haptic Only',
        }
    ]
)
```

### Advanced Funscript Usage

FunPlayer supports both simple position-based scripts and complex multi-channel experiences with different actuator types:

**📁 Loading from Files**
```python
import json
from streamlit_funplayer import funplayer, load_funscript, create_playlist_item

# Load existing funscript file
funscript_data = load_funscript("my_script.funscript")

# Create playlist item with helper function
funplayer(playlist=[
    create_playlist_item(
        sources="audio.mp3",
        funscript=funscript_data,
        name="Loaded Script"
    )
])
```

**🎛️ Multi-Channel Haptic Scripts**
```python
# Advanced multi-actuator funscript with different channel types
multi_channel_script = {
    "version": "1.0",
    "linear": [  #  channel (linear actuator)
        {"at": 0, "pos": 0},
        {"at": 1000, "pos": 100}
    ],
    "vibrate": [  # Vibration channel
        {"at": 0, "v": 0.0},
        {"at": 1000, "v": 1.0}
    ],
    "rotate": [  # Rotation channel with direction
        {"at": 0, "speed": 0.2, "clockwise": True},
        {"at": 1000, "speed": 0.5, "clockwise": False}
    ]
}

funplayer(playlist=[
    create_playlist_item(
        sources=[{'src': 'video.mp4', 'type': 'video/mp4'}],
        funscript=multi_channel_script,
        name="Multi-Channel Experience"
    )
])
```

### Interactive File Upload Interface

Create user-friendly upload interfaces for dynamic content:

```python
import streamlit as st
import json
from streamlit_funplayer import funplayer, create_playlist_item, file_to_data_url

st.title("🎮 Upload & Play")

# File upload interface
media_file = st.file_uploader("Media File", type=['mp4', 'webm', 'mp3', 'wav'])
funscript_file = st.file_uploader("Funscript File", type=['funscript', 'json'])

if media_file or funscript_file:
    playlist_item = {}
    
    if media_file:
        # Convert uploaded file to data URL for browser compatibility
        data_url = file_to_data_url(media_file)
        playlist_item = create_playlist_item(
            sources=data_url,
            name=media_file.name
        )
        
    if funscript_file:
        # Parse uploaded funscript
        funscript_data = json.loads(funscript_file.getvalue().decode('utf-8'))
        if 'funscript' in playlist_item:
            playlist_item['funscript'] = funscript_data
        else:
            # Haptic-only content with default duration
            playlist_item = create_playlist_item(
                funscript=funscript_data,
                name=funscript_file.name,
            )
    
    funplayer(playlist=[playlist_item])
```

### Custom Theme Integration

The streamlit component will sponteaously adapt to the active streamlit theme, but you can customize the visual appearance by passing a custom theme:

```python
# Dark theme configuration example
dark_theme = {
    'primaryColor': '#FF6B6B',
    'backgroundColor': '#1E1E1E',
    'secondaryBackgroundColor': '#2D2D2D',
    'textColor': '#FFFFFF',
    'borderColor': '#404040'
}

funplayer(
    playlist=[{
        'sources': [{'src': 'video.mp4', 'type': 'video/mp4'}],
        'funscript': {'actions': [...]}
    }],
    theme=dark_theme
)
```

## 🔧 Technical Implementation

### Video.js Integration & Extensions

FunPlayer builds upon Video.js to provide robust media handling with custom extensions for haptic synchronization. The MediaPlayer component maintains full compatibility with Video.js plugins while adding playlist functionality and haptic timing integration.

**Key Technical Features:**
- Custom playlist plugin with seamless item transitions
- Synchronized time tracking between media and haptic systems
- Support for Video.js ecosystem (plugins, themes, extensions)
- Adaptive quality switching and streaming protocol support

### Haptic Processing Optimization

The haptic processing pipeline uses several optimization strategies to maintain smooth real-time performance even with complex multi-channel scripts and high update frequencies.

**Performance Optimizations:**
- **Interpolation caching:** Results cached for efficient seeking and progressive playback
- **Throttled commands:** Device communication rate limiting to prevent flooding
- **Memory management:** Automatic cleanup of processed data and unused resources
- **Configurable precision:** Balance between smoothness and system resource usage

### Device Abstraction & Compatibility

ButtPlugManager provides a clean abstraction layer that handles the complexity of device communication while maintaining compatibility across the diverse Buttplug.io ecosystem.

**Device Handling:**
- **Universal compatibility:** Support for 100+ device types through Buttplug.io
- **Capability detection:** Automatic discovery of actuator types and limitations
- **Connection management:** Robust handling of device connections and disconnections
- **Virtual device mode:** Full-featured development environment without hardware

## 📋 API Reference

### Core Functions

The main entry point provides a clean interface for most use cases:

```python
funplayer(
    playlist: List[Dict[str, Any]] = None,  # List of playlist items
    theme: Dict[str, str] = None,           # Custom theme dictionary  
    key: str = None                         # Streamlit component key
) -> Any
```

### Playlist Item Format (Video.js Extended)

Each playlist item follows an extended Video.js format with haptic additions:

```python
{
    'sources': [                    # Required: Media sources array
        {
            'src': 'video.mp4',     # URL or data URL
            'type': 'video/mp4',    # MIME type (auto-detected if missing)
            'label': 'HD'           # Optional quality label
        }
    ],
    'funscript': dict | str,        # Optional: Funscript data or URL
    'name': str,                    # Optional: Display title
    'description': str,             # Optional: Description text
    'poster': str,                  # Optional: Poster image URL
    'duration': float,              # Optional: Duration in seconds (for haptic-only)
    'textTracks': list              # Optional: Subtitles/captions
}
```

### Utility Functions

Helper functions simplify common operations and content creation:

```python
# Create playlist items with intelligent defaults
create_playlist_item(
    sources: Union[str, List[Dict]] = None,
    funscript: Union[str, Dict] = None,
    name: str = None,
    description: str = None,
    poster: Union[str, BytesIO] = None,
    duration: float = None,
    **kwargs
) -> Dict[str, Any]

# Build complete playlists from multiple items
create_playlist(*items, **playlist_options) -> List[Dict[str, Any]]

# Convert files to browser-compatible data URLs
file_to_data_url(
    file: Union[str, os.PathLike, BytesIO], 
    max_size_mb: int = 200
) -> str

# Load and parse funscript files
load_funscript(file_path: Union[str, os.PathLike]) -> Dict[str, Any]

# Validation and utility helpers
validate_playlist_item(item: Dict[str, Any]) -> bool
is_supported_media_file(filename: str) -> bool
is_funscript_file(filename: str) -> bool
get_file_size_mb(file: Union[str, os.PathLike, BytesIO]) -> float
```

## 🎯 Use Cases & Applications

### Entertainment & Content Creation

FunPlayer enables creators to build immersive interactive experiences that go beyond traditional media consumption. Adult content platforms can provide synchronized interactive experiences with seamless haptic integration, while VR applications benefit from enhanced immersion through coordinated haptic feedback.

**Applications:**
- Interactive adult content with synchronized haptic feedback
- VR experiences with enhanced tactile immersion
- Music and audio content with rhythm-based haptic enhancement
- Interactive storytelling with physical feedback elements

### Accessibility & Inclusion

The component may serve important accessibility needs by providing alternative sensory channels for media consumption, particularly benefiting hearing-impaired users through haptic translation of audio content.

**Accessibility Features:**
- Haptic substitution for audio content (hearing impaired users)
- Customizable intensity and timing for different user needs
- Multi-modal feedback for enhanced media accessibility
- Simple interface design for ease of use across user groups

### Research & Development

FunPlayer provides researchers with a flexible platform for haptic interaction studies, human-computer interface research, and experimental media applications.

**Research Applications:**
- Haptic perception and interaction studies
- Multi-modal interface research and prototyping
- Therapeutic applications with controlled haptic feedback
- Educational tools with enhanced sensory learning

### Gaming & Interactive Media

The precise timing control and multi-channel support make FunPlayer suitable for gaming applications, rhythm games, and interactive experiences requiring accurate haptic synchronization.

**Gaming Applications:**
- Rhythm games with haptic beat matching
- Interactive experiences with story-driven haptic feedback
- Training simulators with realistic tactile feedback
- Experimental game mechanics utilizing haptic channels

## 🔧 Development

### Frontend Development Setup

The React frontend can be developed independently with hot reloading:

```bash
cd streamlit_funplayer/frontend
npm install
npm start  # Development server on localhost:3001
```

### Testing with Streamlit

Run the demo application to test changes and new features:

```bash
# In project root directory
streamlit run funplayer.py
```

### Production Build Process

Build and install the updated component for production use:

```bash
cd frontend  
npm run build           # Build optimized frontend bundle
cd ..
pip install -e .        # Install with built frontend
```

## ⚠️ System Requirements

### Software Dependencies

**Required:**
- Python 3.9 or higher with pip package manager
- Streamlit 1.45 or higher for proper component API support
- Modern web browser with WebSocket and modern JavaScript support
- Intiface Central application for haptic device communication

**Recommended:**
- HTTPS connection for production deployment (required for device access)
- Dedicated haptic device for full functionality (virtual mode available for development)

### Hardware Compatibility

**Supported Devices:**
- 100+ haptic devices through Buttplug.io ecosystem
- USB and Bluetooth connected devices
- Multi-actuator devices with position, vibration, rotation capabilities
- Virtual device simulation for development and testing

## 🤝 Contributing

We welcome contributions from the community! The project benefits from diverse perspectives and use cases.

### Contribution Guidelines

**Getting Started:**
1. Fork the repository and create a descriptive feature branch
2. Follow existing code style and architectural patterns
3. Test thoroughly with both virtual and real devices when possible
4. Ensure compatibility with Streamlit theming system
5. Submit pull request with detailed description of changes

**Development Focus Areas:**
- New device compatibility and testing
- Performance optimizations for high-frequency haptic updates
- Additional funscript format support and parsing improvements
- Enhanced visualization and debugging tools
- Documentation and example improvements

### Code Quality Standards

Maintain the existing architecture with independent managers and event-driven communication. Test across different browsers and Streamlit versions. Document new features and API changes clearly.

## 📄 License

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License**. See the LICENSE file for complete terms and conditions.

### Commercial Licensing

For commercial use, custom licensing options are available. Contact **bferrand.math@gmail.com** to discuss:
- White-label integration rights and custom branding
- Enterprise deployment assistance and priority support  
- Custom development and feature implementation
- Commercial redistribution licensing

## 🙏 Acknowledgments

FunPlayer builds upon the excellent work of several open-source communities:

### Core Technologies

**[Buttplug.io](https://buttplug.io)** provides the robust device communication protocol enabling universal haptic device support across platforms and manufacturers.

**[Intiface](https://intiface.com)** offers the essential desktop bridge application handling device management, driver compatibility, and secure WebSocket communication.

**[Video.js](https://videojs.com)** serves as the proven media player framework supporting diverse video and audio formats with extensive plugin ecosystem.

**[Streamlit](https://streamlit.io)** provides the intuitive Python web app framework making interactive application development accessible to all skill levels.

### Community Support

Special recognition goes to the **funscript community** for developing and maintaining haptic scripting standards that enable rich interactive experiences. Their ongoing work establishes the foundation for synchronized haptic content creation and sharing.