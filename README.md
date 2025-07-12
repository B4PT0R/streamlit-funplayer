# Streamlit FunPlayer

A modern React component for synchronized media and haptic playback with professional-grade performance and VR support.

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![Streamlit](https://img.shields.io/badge/streamlit-1.45+-red.svg)](https://streamlit.io)
[![React](https://img.shields.io/badge/react-18.3+-blue.svg)](https://reactjs.org)

## Overview

FunPlayer is a versatile media player based on Video.js that synchronizes audio/video content with haptic feedback devices through the Buttplug.io ecosystem. Built with modern React architecture and optimized for real-time performance, it supports everything from simple media playback to complex multi-channel haptic orchestration.

**Key Differentiators:**
- 🎯 **React-first architecture** with Streamlit wrapper for Python integration
- ⚡ **120Hz haptic refresh rate** with optimized interpolation caching
- 🥽 **Native VR support** (Quest, Pico) via browser with Intiface sideload
- 🔧 **Modular design** - autonomous managers with event-driven communication
- 🎮 **100+ device compatibility** through Buttplug.io ecosystem
- 🎨 **Professional UI** with real-time visualization and adaptive theming

## Quick Start

### Installation

```bash
pip install streamlit-funplayer
```

### Basic Usage

```python
import streamlit as st
from streamlit_funplayer import funplayer

# Simple video + haptic synchronization
funplayer(
    playlist=[{
        'sources': [{'src': 'video.mp4', 'type': 'video/mp4'}],
        'funscript': {'actions': [{"at": 0, "pos": 0}, {"at": 1000, "pos": 100}]},
        'name': 'Demo Scene'
    }]
)
```

### Advanced Example

```python
from streamlit_funplayer import funplayer, create_playlist_item

# Multi-format playlist with custom theming
playlist = [
    create_playlist_item(
        sources="https://example.com/video.mp4",
        funscript="https://example.com/script.funscript", 
        name="Scene 1",
        poster="poster.jpg"
    ),
    create_playlist_item(
        funscript={"actions": [{"at": 0, "pos": 50}]},  # Haptic-only
        name="Pure Haptic Experience"
    )
]

funplayer(
    playlist=playlist,
    theme={
        'primaryColor': '#FF6B6B',
        'backgroundColor': '#1E1E1E'
    }
)
```

## Features

### 🎬 Universal Media Support

**Formats & Protocols:**
- **Video:** MP4, WebM, MOV, AVI, MKV, M4V
- **Audio:** MP3, WAV, OGG, M4A, AAC, FLAC  
- **Streaming:** HLS (m3u8), DASH (mpd), direct URLs
- **VR:** 360°/180° content with WebXR integration
- **Haptic-only:** Timeline playback without media

**Smart Playlists:**
- Auto-progression with seamless transitions
- Mixed content types (video + audio + haptic-only)
- Poster generation and metadata handling

### 🎮 Advanced Haptic System

**Device Integration:**
- **Buttplug.io ecosystem** - 100+ supported devices
- **Auto-discovery** and intelligent capability mapping
- **Multi-actuator support** (vibration, linear, rotation, oscillation)
- **Virtual device mode** for development without hardware

**Real-time Performance:**
- **120Hz update rate** with adaptive throttling
- **Interpolation caching** for smooth seeking
- **Sub-millisecond timing** accuracy for VR applications
- **Memory-optimized** processing for long sessions

**Professional Controls:**
- **Per-channel configuration** (scale, offset, range, invert)
- **Global modulation** with real-time adjustment
- **Multi-channel funscripts** with automatic routing
- **Live visualization** with customizable waveforms

### 🥽 VR & Cross-Platform

**VR Optimization:**
- **Meta Quest native** (via Intiface Central sideload)
- **Browser-based** - zero app store friction
- **90Hz display + 120Hz haptic** synchronized rendering
- **Memory management** optimized for sustained VR sessions

**Platform Support:**
- **Desktop:** Windows, macOS, Linux
- **Mobile:** iOS, Android browsers  
- **VR Headsets:** Quest 2/3/Pro, Pico, any WebXR device
- **HTTPS required** for device access in production

## Architecture

### Design Philosophy

FunPlayer uses a **modular, event-driven architecture** where independent managers handle specific domains without tight coupling. **FunPlayerCore** serves as the central hub, coordinating between business logic managers and UI components through a unified event bus.

```
┌─────────────────────────────────────────────────────────────────┐
│                            UI (React)                           │
│                    FunPlayer (Main UI Component)                │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │  MediaPlayer    │ │ HapticSettings  │ │ HapticVisualizer│    │
│  │   (Video.js)    │ │   (Controls)    │ │    (Canvas)     │    │
│  └─────────┬───────┘ └─────────┬───────┘ └─────────┬───────┘    │
│            │                   │                   │            │
└────────────┼───────────────────┼───────────────────┼────────────┘
             │                   │                   │
             │                   │                   │         
             │                   │                   │          
             ▼                   ▼                   ▼          
┌─────────────────────────────────────────────────────────────────┐
│                     FunPlayerCore (Singleton)                   │
│                                                                 │
│                 Event Bus + State Coordination                  │
│                                                                 │
│        • notify() system        • Lazy manager getters          │
│        • Event routing          • Lifecycle management          │
│        • State synchronization  • Error handling                │
└─────────────────────────────────────────────────────────────────┘
             ▲                    ▲                   ▲         
             │                    │                   │           
             │                    │                   │          
             │                    │                   │
┌────────────┼────────────────────┼───────────────────┼───────────┐
│            │                    │                   │           │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ ButtPlugManager │ │FunscriptManager │ │ PlaylistManager │    │
│  │                 │ │                 │ │                 │    │
│  │ • Device comms  │ │ • Multi-channel │ │ • Content mgmt  │    │
│  │ • Auto-mapping  │ │ • Interpolation │ │ • Format valid  │    │
│  │ • Capabilities  │ │ • Channel types │ │ • Navigation    │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
│                                                                 │
│                    Business Logic Managers                      │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

**FunPlayerCore**: Central singleton orchestrating manager communication through event bus

**ButtPlugManager**: Device communication, capability detection, command optimization

**FunscriptManager**: Multi-channel parsing, intelligent interpolation, auto-mapping

**PlaylistManager**: Content validation, format normalization, navigation

**MediaPlayer**: Video.js integration with playlist extensions and VR support

## API Reference

### Core Function

```python
funplayer(
    playlist: List[Dict[str, Any]] = None,
    theme: Dict[str, str] = None,
    key: str = None
) -> Any
```

### Playlist Item Format

Extended Video.js format with haptic integration:

```python
{
    'sources': [                    # Media sources (Video.js format)
        {
            'src': 'video.mp4',     # URL or data URL
            'type': 'video/mp4',    # MIME type (auto-detected)
            'label': 'HD'           # Quality label (optional)
        }
    ],
    'funscript': dict | str,        # Haptic data or URL
    'name': str,                    # Display title
    'description': str,             # Description (optional)
    'poster': str,                  # Poster image URL (optional)
    'duration': float,              # Duration in seconds (haptic-only)
    'textTracks': list              # Subtitles/captions (optional)
}
```

### Utility Functions

```python
# Create playlist items with intelligent defaults
create_playlist_item(
    sources: Union[str, List[Dict]] = None,
    funscript: Union[str, Dict] = None,
    name: str = None,
    **kwargs
) -> Dict[str, Any]

# Build complete playlists
create_playlist(*items, **options) -> List[Dict[str, Any]]

# File conversion utilities
file_to_data_url(file: Union[str, Path, BytesIO]) -> str
load_funscript(file_path: Union[str, Path]) -> Dict[str, Any]

# Validation helpers
validate_playlist_item(item: Dict[str, Any]) -> bool
is_supported_media_file(filename: str) -> bool
```

## System Requirements

### Software Dependencies

**Required:**
- Python 3.9+ with pip
- Streamlit 1.45+ for component API compatibility
- Modern browser with WebSocket and WebXR support
- [Intiface Central](https://intiface.com/central/) for device connectivity

**Development:**
- Node.js 18+ for frontend development
- npm or yarn for dependency management

### Hardware Compatibility

**Haptic Devices:**
- 100+ devices via Buttplug.io ecosystem
- USB and Bluetooth connectivity
- Multi-actuator devices supported
- Virtual device simulation available

**VR Headsets:**
- Meta Quest 2/3/Pro (tested, optimized)
- Pico 4/4E, ByteDance devices
- Any WebXR-compatible headset
- Desktop VR via browser

## Development

### Frontend Development

The React component can be developed independently:

```bash
cd streamlit_funplayer/frontend
npm install
npm start  # Development server on localhost:3001
```

### Production Build

```bash
cd streamlit_funplayer/frontend
npm run build  # Creates optimized build/

# Switch to production mode
# Edit streamlit_funplayer/__init__.py: _RELEASE = True
```

### Testing

```bash
# Component testing
streamlit run funplayer.py

# End-to-end testing
python -m pytest e2e/
```

## Performance Optimizations

- **Interpolation caching** with smart invalidation
- **Throttled device commands** to prevent flooding  
- **Memory management** for long VR sessions
- **Bundle optimization** via Vite with tree-shaking
- **Adaptive quality** based on system capabilities

## Use Cases

### Entertainment & Content Creation
- Adult content platforms with synchronized haptic feedback
- VR experiences with enhanced tactile immersion
- Music and rhythm games with haptic enhancement
- Interactive storytelling with physical feedback

### Research & Development  
- Haptic perception and HCI research
- Multi-modal interface prototyping
- Therapeutic applications with controlled feedback
- Educational tools with enhanced sensory learning

### Accessibility
- Haptic substitution for audio content (hearing impaired)
- Customizable intensity for different user needs
- Multi-modal feedback for enhanced accessibility

## Contributing

We welcome contributions from the community! Please follow existing architectural patterns and test thoroughly with both virtual and real devices.

**Focus Areas:**
- Device compatibility and testing
- Performance optimizations for high-frequency updates
- Additional funscript format support
- Enhanced visualization and debugging tools

## License

**Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International**

For commercial licensing, contact: **bferrand.math@gmail.com**

## Acknowledgments

Built on the excellent work of:
- **[Buttplug.io](https://buttplug.io)** - Universal haptic device protocol
- **[Intiface](https://intiface.com)** - Desktop bridge application  
- **[Video.js](https://videojs.com)** - Robust media player framework
- **[Streamlit](https://streamlit.io)** - Python web app framework
- **Funscript community** - Haptic scripting standards and content