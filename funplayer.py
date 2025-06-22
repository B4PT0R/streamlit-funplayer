#!/usr/bin/env python3
"""
🎮 FunPlayer - Synchronized Media & Haptic Playback
A modern Streamlit demo showcasing Video.js extended format with haptic funscripts
"""

import streamlit as st
import json
import uuid
from typing import Dict, List, Any

try:
    from streamlit_funplayer import (
        funplayer, 
        create_playlist_item, 
        create_playlist,
        file_to_data_url, 
        load_funscript,
        validate_playlist_item,
        __version__ as version
    )
except ImportError:
    st.error("📦 streamlit-funplayer not found! Run: `pip install -e .`")
    st.stop()

# ============================================================================
# PAGE CONFIG - INCHANGÉ
# ============================================================================

st.set_page_config(
    page_title="🎮 FunPlayer", 
    layout="wide", 
    initial_sidebar_state="expanded",
    menu_items={
        'Get Help': 'https://github.com/B4PT0R/streamlit-funplayer',
        'Report a bug': 'https://github.com/B4PT0R/streamlit-funplayer/issues',
        'About': '**FunPlayer v0.1** - Synchronized Media & Haptic Playback'
    }
)

# ============================================================================
# SESSION STATE INITIALIZATION - INCHANGÉ
# ============================================================================

if 'playlist' not in st.session_state:
    st.session_state.playlist = []

if 'current_item_id' not in st.session_state:
    st.session_state.current_item_id = None

if 'demo_loaded' not in st.session_state:
    st.session_state.demo_loaded = False

# ============================================================================
# DEMO DATA & EXAMPLES - INCHANGÉ
# ============================================================================

from numpy import sin, pi, linspace

actions=[dict(at=t*1000,pos=0.5+0.45*sin(2*pi*t*1000)) for t in linspace(0,120,1200)]

DEMO_FUNSCRIPT = {
    "version": "1.0",
    "actions": actions
}

EXAMPLE_PLAYLISTS = {
    "🎥 Video Examples": [
        {
            'sources': [{'src': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'type': 'video/mp4'}],
            'name': 'Big Buck Bunny',
            'description': 'Classic demo video with synchronized haptics',
            'funscript': DEMO_FUNSCRIPT
        }
    ],
    "🎵 Audio Examples": [
        {
            'sources': [{'src': 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav', 'type': 'audio/wav'}],
            'name': 'Audio + Haptics',
            'description': 'Audio experience with haptic feedback',
            'funscript': DEMO_FUNSCRIPT
        }
    ],
    "🎮 Haptic Only": [
        {
            'funscript': DEMO_FUNSCRIPT,
            'name': 'Pure Haptic Experience',
            'description': 'Haptic-only playback (no media)',
            'duration': 11.0
        }
    ]
}

# ============================================================================
# UTILITY FUNCTIONS - INCHANGÉ
# ============================================================================

def generate_item_id():
    """Generate unique ID for playlist items"""
    return str(uuid.uuid4())[:8]

def validate_and_add_item(item_data: Dict[str, Any]) -> bool:
    """Validate and add item to playlist"""
    try:
        if validate_playlist_item(item_data):
            item_data['_id'] = generate_item_id()
            st.session_state.playlist.append(item_data)
            return True
        else:
            st.error("❌ Invalid item: must have 'sources' or 'funscript'")
            return False
    except Exception as e:
        st.error(f"❌ Error adding item: {e}")
        return False

def remove_item(item_id: str):
    """Remove item from playlist"""
    st.session_state.playlist = [
        item for item in st.session_state.playlist 
        if item.get('_id') != item_id
    ]

def move_item(item_id: str, direction: str):
    """Move item up or down in playlist"""
    items = st.session_state.playlist
    index = next((i for i, item in enumerate(items) if item.get('_id') == item_id), -1)
    
    if index == -1:
        return
    
    if direction == 'up' and index > 0:
        items[index], items[index-1] = items[index-1], items[index]
    elif direction == 'down' and index < len(items) - 1:
        items[index], items[index+1] = items[index+1], items[index]

def get_clean_playlist():
    """Get playlist without internal IDs for FunPlayer"""
    return [{k: v for k, v in item.items() if k != '_id'} 
            for item in st.session_state.playlist]

# ============================================================================
# ✅ NOUVEAU : HEADER AVEC COMPOSANTS STREAMLIT NATIFS
# ============================================================================

# Header principal avec colonnes
header_col1, header_col2 = st.columns([3, 1])

with header_col1:
    st.title("🎮 FunPlayer Demo")
    st.markdown("**Interactive Media Player with Synchronized Haptic Feedback**")

with header_col2:
    st.info(f"**v{version}**")

st.markdown("*Powered by Video.js & Buttplug.io*")
st.divider()

# ============================================================================
# SIDEBAR - PLAYLIST EDITOR REFACTORISÉ
# ============================================================================

with st.sidebar:
    st.header("📝 Playlist Editor")
    
    # ========================================================================
    # DEMO EXAMPLES avec st.columns natif
    # ========================================================================
    
    st.subheader("🚀 Quick Start")
    
    demo_col1, demo_col2 = st.columns(2)
    
    with demo_col1:
        if st.button("📺 Load Examples", use_container_width=True, type="primary"):
            st.session_state.playlist = []
            for category, items in EXAMPLE_PLAYLISTS.items():
                for item in items:
                    item_copy = item.copy()
                    item_copy['_id'] = generate_item_id()
                    st.session_state.playlist.append(item_copy)
            st.session_state.demo_loaded = True
            st.rerun()
    
    with demo_col2:
        if st.button("🗑️ Clear All", use_container_width=True):
            st.session_state.playlist = []
            st.session_state.demo_loaded = False
            st.rerun()
    
    if st.session_state.demo_loaded:
        st.success("✅ Demo examples loaded!")
    
    st.divider()
    
    # ========================================================================
    # ✅ NOUVEAU : ADD NEW ITEM avec st.expander
    # ========================================================================
    
    with st.expander("➕ Add New Item", expanded=True):
        
        # Item metadata
        item_name = st.text_input("📝 Name", placeholder="Enter item title...")
        item_description = st.text_area("📄 Description", placeholder="Optional description...", height=70)
        
        # Media sources
        st.markdown("**🎬 Media Sources**")
        source_type = st.selectbox("Source Type", ["📎 Upload File", "🌐 URL", "⏱️ Haptic Only"])
        
        sources = []
        
        if source_type == "📎 Upload File":
            uploaded_file = st.file_uploader(
                "Choose media file", 
                type=['mp4', 'webm', 'mov', 'avi', 'mp3', 'wav', 'ogg', 'm4a'],
                help="Upload video or audio file (max 200MB)"
            )
            if uploaded_file:
                try:
                    data_url = file_to_data_url(uploaded_file)
                    sources = [{'src': data_url}]
                    st.success(f"✅ {uploaded_file.name} ready ({uploaded_file.size // 1024} KB)")
                except Exception as e:
                    st.error(f"❌ Upload failed: {e}")
        
        elif source_type == "🌐 URL":
            media_url = st.text_input("Media URL", placeholder="https://example.com/video.mp4")
            if media_url:
                sources = [{'src': media_url}]
        
        # Funscript
        st.markdown("**🎮 Haptic Script**")
        funscript_type = st.selectbox("Funscript Type", ["📎 Upload .funscript", "🌐 Funscript URL", "🎲 Demo Data", "❌ None"])
        
        funscript_data = None
        
        if funscript_type == "📎 Upload .funscript":
            funscript_file = st.file_uploader(
                "Choose funscript file", 
                type=['funscript', 'json'],
                help="Upload .funscript or .json file"
            )
            if funscript_file:
                try:
                    funscript_data = json.loads(funscript_file.getvalue().decode('utf-8'))
                    action_count = len(funscript_data.get('actions', []))
                    st.success(f"✅ {funscript_file.name} loaded ({action_count} actions)")
                except Exception as e:
                    st.error(f"❌ Funscript load failed: {e}")
        
        elif funscript_type == "🌐 Funscript URL":
            funscript_url = st.text_input("Funscript URL", placeholder="https://example.com/script.funscript")
            if funscript_url:
                funscript_data = funscript_url
        
        elif funscript_type == "🎲 Demo Data":
            funscript_data = DEMO_FUNSCRIPT
            st.info("ℹ️ Using demo funscript (11 actions)")
        
        # Duration for haptic-only
        duration = None
        if source_type == "⏱️ Haptic Only" and funscript_data:
            duration = st.number_input("Duration (seconds)", min_value=1.0, max_value=3600.0, value=11.0, step=0.1)
        
        # Submit button
        if st.button("➕ Add to Playlist", use_container_width=True, type="primary"):
            # Build item data
            item_data = {}
            
            if sources:
                item_data['sources'] = sources
            
            if funscript_data:
                item_data['funscript'] = funscript_data
            
            if item_name:
                item_data['name'] = item_name
            
            if item_description:
                item_data['description'] = item_description
            
            if duration:
                item_data['duration'] = duration
            
            # Validate and add
            if validate_and_add_item(item_data):
                st.success(f"✅ Added '{item_name or 'Untitled'}' to playlist!")
                st.rerun()
    
    st.divider()
    
    # ========================================================================
    # ✅ NOUVEAU : CURRENT PLAYLIST avec st.container natifs
    # ========================================================================
    
    st.subheader(f"📋 Current Playlist ({len(st.session_state.playlist)})")
    
    if st.session_state.playlist:
        for i, item in enumerate(st.session_state.playlist):
            
            # ✅ Utiliser st.container pour chaque item
            with st.container():
                # Info de l'item
                
                with st.container(border=True):
                    st.markdown(f"**#{i+1} {item.get('name', 'Untitled')}**")
                    if item.get('description'):
                        st.caption(item.get('description'))
                
                # Menu d'actions en colonnes
                action_col1, action_col2, action_col3, action_col4 = st.columns(4)
                
                with action_col1:
                    if st.button("⬆️", key=f"up_{item['_id']}", use_container_width=True, help="Move up"):
                        move_item(item['_id'], 'up')
                        st.rerun()
                
                with action_col2:
                    if st.button("⬇️", key=f"down_{item['_id']}",use_container_width=True, help="Move down"):
                        move_item(item['_id'], 'down')
                        st.rerun()
                
                with action_col3:
                    if st.button("✏️", key=f"edit_{item['_id']}",use_container_width=True, help="Edit"):
                        st.info("🚧 Edit feature coming soon!")
                
                with action_col4:
                    if st.button("🗑️", key=f"del_{item['_id']}",use_container_width=True, help="Delete"):
                        remove_item(item['_id'])
                        st.rerun()
                
                # Séparateur visuel entre items
                if i < len(st.session_state.playlist) - 1:
                    st.markdown("---")
    else:
        st.info("📝 No items in playlist. Add some content above!")
    
    # ========================================================================
    # ✅ NOUVEAU : IMPORT/EXPORT avec st.expander
    # ========================================================================
    
    if st.session_state.playlist:
        with st.expander("💾 Import/Export"):
            # Export
            playlist_json = json.dumps(get_clean_playlist(), indent=2)
            st.download_button(
                "📤 Export Playlist",
                playlist_json,
                file_name="funplayer_playlist.json",
                mime="application/json",
                use_container_width=True
            )
            
            # Import
            imported_file = st.file_uploader("📥 Import Playlist", type=['json'])
            if imported_file:
                try:
                    imported_data = json.loads(imported_file.getvalue().decode('utf-8'))
                    if isinstance(imported_data, list):
                        st.session_state.playlist = []
                        for item in imported_data:
                            item['_id'] = generate_item_id()
                            st.session_state.playlist.append(item)
                        st.success(f"✅ Imported {len(imported_data)} items!")
                        st.rerun()
                    else:
                        st.error("❌ Invalid playlist format")
                except Exception as e:
                    st.error(f"❌ Import failed: {e}")

# ============================================================================
# ✅ NOUVEAU : MAIN CONTENT avec st.container natifs
# ============================================================================

# Player section
if st.session_state.playlist:    
    # Render the player
    try:
        clean_playlist = get_clean_playlist()
        
        result = funplayer(
            playlist=clean_playlist,
            key="main_player"
        )
        
        # Player info avec st.info natif
        if len(clean_playlist) > 1:
            st.info(f"🎵 Playlist mode: {len(clean_playlist)} items loaded")
        else:
            st.info("🎵 Single item mode")
            
    except Exception as e:
        st.error(f"❌ Player error: {e}")
        with st.expander("🔧 Debug Info"):
            st.json(get_clean_playlist())

else:
    # ✅ Empty state avec st.container natif
    with st.container():
        st.subheader("🎯 Welcome to FunPlayer!")
        
        st.markdown("""
        **Get started by:**
        
        - 📺 **Loading example content** from the sidebar
        - 📎 **Uploading your own** video/audio + funscript files  
        - 🌐 **Adding URLs** to online media content
        - 🎮 **Creating haptic-only** experiences
        
        *Start building your synchronized media playlist! 🚀*
        """)

# ============================================================================
# ✅ NOUVEAU : HELP & DOCUMENTATION avec st.expander natif
# ============================================================================

st.divider()

with st.expander("📖 How to Use FunPlayer"):
    help_col1, help_col2 = st.columns(2)
    
    with help_col1:
        st.markdown("""
        ### 🎯 **Getting Started**
        
        1. **📺 Try Examples**: Click "Load Examples" for demo content
        2. **📎 Upload Files**: Add your video/audio + .funscript files  
        3. **🎮 Connect Device**: Use Intiface Central + compatible device
        4. **▶️ Play & Enjoy**: Synchronized media + haptic feedback!
        
        ### 🎬 **Supported Media**
        
        - **Video**: MP4, WebM, MOV, AVI
        - **Audio**: MP3, WAV, OGG, M4A, AAC
        - **Streaming**: HLS (m3u8), DASH (mpd)
        - **Funscripts**: JSON format with haptic actions
        """)
    
    with help_col2:
        st.markdown("""
        ### ⚙️ **Advanced Features**
        
        - **🎵 Playlist Mode**: Multiple items with auto-advance
        - **🔀 Multi-Resolution**: Automatic quality switching  
        - **🎮 Haptic-Only**: Timeline playback without media
        - **📊 Real-time Visualizer**: See haptic waveforms
        - **🎛️ Channel Mapping**: Multi-actuator device support
        
        ### 🔗 **Requirements**
        
        - **[Intiface Central](https://intiface.com/central/)** for device connectivity
        - **Bluetooth-enabled** compatible device
        - **HTTPS connection** (for device access in production)
        """)

with st.expander("🔧 Technical Details"):
    st.code("""
# Playlist Format (Video.js Extended)
playlist = [{
    'sources': [{'src': 'video.mp4', 'type': 'video/mp4'}],  # Required
    'name': 'Scene Title',                                   # Recommended  
    'description': 'Scene description',                      # Optional
    'poster': 'poster.jpg',                                  # Optional
    'funscript': {'actions': [...]},                         # FunPlayer extension
    'duration': 120.5                                        # For haptic-only
}]
    """, language="python")

# ============================================================================
# ✅ NOUVEAU : FOOTER avec composants natifs
# ============================================================================

st.divider()

footer_col1, footer_col2, footer_col3 = st.columns(3)

with footer_col1:
    st.markdown(f"🎮 **FunPlayer v{version}**")

with footer_col2:
    st.markdown("[View on GitHub](https://github.com/B4PT0R/streamlit-funplayer)")

with footer_col3:
    st.markdown("© 2025 Baptiste Ferrand")