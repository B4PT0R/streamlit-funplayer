import os
import json
import streamlit.components.v1 as components

# Create a _RELEASE constant. We'll set this to False while we're developing
# the component, and True when we're ready to package and distribute it.
_RELEASE = False

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


def create_funscript(actions, metadata=None):
    """
    Utility function to create a basic funscript from action data.
    
    Parameters
    ----------
    actions : list of dict
        List of actions with 'at' (time in ms) and 'pos' (position 0-100) keys
    metadata : dict, optional
        Additional metadata for the funscript
        
    Returns
    -------
    dict
        Valid funscript data structure
        
    Examples
    --------
    >>> actions = [
    ...     {"at": 0, "pos": 0},
    ...     {"at": 1000, "pos": 100},
    ...     {"at": 2000, "pos": 0}
    ... ]
    >>> funscript = create_funscript(actions)
    >>> funplayer(funscript_src=funscript)
    """
    funscript = {
        "version": "1.0",
        "inverted": False,
        "range": 90,
        "actions": actions
    }
    
    if metadata:
        funscript.update(metadata)
        
    return funscript


# Package metadata
__version__ = "0.1.0"
__author__ = "Your Name"
__email__ = "your.email@example.com"
__description__ = "Streamlit component for synchronized media and haptic playback"

# Export main functions
__all__ = ["funplayer", "load_funscript", "create_funscript"]