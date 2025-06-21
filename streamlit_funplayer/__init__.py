import os
import json
import base64
from pathlib import Path
from io import BytesIO
from typing import Union, Optional
import streamlit.components.v1 as components

# Create a _RELEASE constant. We'll set this to False while we're developing
# the component, and True when we're ready to package and distribute it.
_RELEASE = True

if not _RELEASE:
    _component_func = components.declare_component(
        "streamlit_funplayer",
        url="http://localhost:3001",  # Local development server
    )
else:
    # When we're distributing a production version of the component, we'll
    # replace the `url` param with `path`, and point it to the component's
    # build directory:
    parent_dir = os.path.dirname(os.path.abspath(__file__))
    build_dir = os.path.join(parent_dir, "frontend/build")
    _component_func = components.declare_component("streamlit_funplayer", path=build_dir)

def file_to_data_url(
    file: Union[str, os.PathLike, BytesIO], 
    max_size_mb: int = 200
) -> Optional[str]:
    """
    Convert a file to a data URL for browser compatibility.
    
    Args:
        file: File path (str/PathLike) or BytesIO stream
        max_size_mb: Maximum file size in MB (default: 200MB)
        
    Returns:
        Data URL string or None if file is invalid
        
    Raises:
        FileNotFoundError: If file path doesn't exist
        ValueError: If file is too large
        TypeError: If file type is not supported
        
    Examples:
        # From file path
        data_url = file_to_data_url("video.mp4")
        
        # From Streamlit uploaded file
        uploaded = st.file_uploader("Media", type=['mp4'])
        if uploaded:
            data_url = file_to_data_url(uploaded)
    """
    if not file:
        return None
    
    # Handle file path
    if isinstance(file, (str, os.PathLike)):
        file_path = Path(file)
        if not file_path.is_file():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Check file size before reading
        file_size = file_path.stat().st_size
        if file_size > max_size_mb * 1024 * 1024:
            raise ValueError(f"File too large: {file_size / 1024 / 1024:.1f}MB > {max_size_mb}MB")
        
        with open(file_path, 'rb') as f:
            bytes_content = f.read()
        filename = file_path.name
        
    # Handle BytesIO (Streamlit uploaded files)
    elif isinstance(file, BytesIO):
        # Save current position and seek to start
        current_pos = file.tell()
        file.seek(0)
        bytes_content = file.read()
        file.seek(current_pos)  # Restore original position
        
        # Check size
        if len(bytes_content) > max_size_mb * 1024 * 1024:
            raise ValueError(f"File too large: {len(bytes_content) / 1024 / 1024:.1f}MB > {max_size_mb}MB")
        
        # Get filename from BytesIO object (Streamlit sets this)
        filename = getattr(file, 'name', 'unnamed_file.bin')
        
    else:
        raise TypeError(f"Invalid file type: {type(file)}. Expected str, PathLike, or BytesIO")
    
    # Determine MIME type from extension
    file_extension = Path(filename).suffix.lower()
    mime_types = {
        # Video formats
        '.mp4': 'video/mp4',
        '.webm': 'video/webm', 
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.ogv': 'video/ogg',
        '.m4v': 'video/mp4',
        
        # Audio formats  
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.flac': 'audio/flac',
        
        # Funscript/JSON
        '.funscript': 'application/json',
        '.json': 'application/json',
    }
    
    mime_type = mime_types.get(file_extension, 'application/octet-stream')
    
    # Encode to base64
    try:
        base64_content = base64.b64encode(bytes_content).decode('utf-8')
    except Exception as e:
        raise ValueError(f"Failed to encode file to base64: {e}")
    
    return f"data:{mime_type};base64,{base64_content}"


def get_file_size_mb(file: Union[str, os.PathLike, BytesIO]) -> float:
    """Get file size in MB for any supported file type."""
    if isinstance(file, (str, os.PathLike)):
        return Path(file).stat().st_size / 1024 / 1024
    elif isinstance(file, BytesIO):
        current_pos = file.tell()
        file.seek(0, 2)  # Seek to end
        size = file.tell()
        file.seek(current_pos)  # Restore position
        return size / 1024 / 1024
    else:
        raise TypeError(f"Invalid file type: {type(file)}")


def is_supported_media_file(filename: str) -> bool:
    """Check if a file extension is supported for media playback."""
    extension = Path(filename).suffix.lower()
    supported = {
        '.mp4', '.webm', '.mov', '.avi', '.mkv', '.ogv', '.m4v',  # Video
        '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'          # Audio
    }
    return extension in supported

def is_funscript_file(filename: str) -> bool:
    """Check if a file is a funscript."""
    extension = Path(filename).suffix.lower()
    return extension in {'.funscript', '.json'}

def load_funscript(file_path):
    """
    Utility function to load a funscript file from disk.
    
    Parameters
    ----------
    file_path : str
        Path to the .funscript file
        
    Returns
    -------
    dict
        Parsed funscript data
        
    Examples
    --------
    >>> funscript_data = load_funscript("my_script.funscript")
    >>> funplayer(
    ...     media_src="video.mp4",
    ...     funscript_src=funscript_data
    ... )
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"Funscript file not found: {file_path}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in funscript file {file_path}: {e}")

def funplayer(playlist=None, media=None, funscript=None, poster=None, theme=None, key=None, **kwargs):
    """
    Create a FunPlayer component for synchronized media and haptic playback.
    
    Parameters
    ----------
    playlist : dict or list of dict, optional
        Playlist of items. Each dict can contain:
        - 'media': URL/path to media file or None
        - 'funscript': URL/path/data for funscript or None  
        - 'poster': URL/path to poster image
        - **metadata: duration, media_type, media_info, title, etc.
        
        Examples:
        playlist={'media': 'video.mp4', 'funscript': 'script.funscript'}
        playlist=[
            {'media': 'video1.mp4', 'funscript': script_data, 'title': 'Scene 1'},
            {'media': None, 'funscript': 'haptic.funscript', 'duration': 60}
        ]
        
    media, funscript, poster : DEPRECATED
        Legacy support, converted to playlist format
        
    theme : dict, optional
        Theme customization
        
    key : str, optional
        Component key
        
    **kwargs : additional metadata
        Applied to single-item playlist when using legacy API
    """
    
    component_args = {}
    
    # ✅ NOUVEAU: API playlist simplifiée
    if playlist is not None:
        if isinstance(playlist, dict):
            playlist = [playlist]
        elif not isinstance(playlist, list):
            raise ValueError("playlist must be a dict or list of dicts")
        
        component_args["playlist"] = playlist
    
    # ✅ LEGACY: Conversion avec métadonnées kwargs
    elif media is not None or funscript is not None or poster is not None:
        legacy_item = {}
        if media:
            legacy_item['media'] = media
        if funscript:
            legacy_item['funscript'] = funscript
        if poster:
            legacy_item['poster'] = poster
        
        # ✅ NOUVEAU: Ajouter métadonnées kwargs
        legacy_item.update(kwargs)
            
        component_args["playlist"] = [legacy_item]
    
    if theme is not None:
        component_args["theme"] = theme
    
    return _component_func(**component_args, key=key, default=None)

# Package metadata
__version__ = "0.1.0"
__author__ = "Baptiste Ferrand"
__email__ = "bferrand.maths@gmail.com"
__description__ = "Streamlit component for synchronized media and haptic playback"

# Export main functions
__all__ = ["funplayer", "load_funscript", "file_to_data_url", "is_funscript_file","is_supported_media_file","get_file_size_mb"]