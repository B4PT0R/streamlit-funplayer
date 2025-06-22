# ============================================================================
# MÉTADONNÉES DU PACKAGE
# ============================================================================

from pathlib import Path
import toml

ROOT=Path(__file__).parent.parent
with open(ROOT/"pyproject.toml",encoding="utf-8") as f:
    config=toml.load(f)

# Package metadata
__version__ = config['project']['version']
__author__ = config['project']['authors'][0]['name']
__email__ = config['project']['authors'][0]['email']
__description__ = config['project']['description']

# ✅ NOUVEAU: Export des utilitaires
__all__ = [
    "funplayer", 
    "create_playlist_item", 
    "create_playlist",
    "load_funscript", 
    "file_to_data_url", 
    "validate_playlist_item",
    "is_funscript_file",
    "is_supported_media_file",
    "get_file_size_mb"
]

# ============================================================================
# IMPORTS AND COMPONENT DECLARATION
# ============================================================================

import os
import json
import base64
from pathlib import Path
from io import BytesIO
from typing import Union, Optional, List, Dict, Any
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

# ============================================================================
# UTILITAIRES DE CONVERSION - ✅ NOUVEAU: Helpers pour format Video.js étendu
# ============================================================================

def create_playlist_item(
    sources: Union[str, List[Dict[str, str]]] = None,
    funscript: Union[str, Dict, os.PathLike] = None,
    name: str = None,
    description: str = None,
    poster: Union[str, os.PathLike, BytesIO] = None,
    duration: float = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Crée un item de playlist au format Video.js étendu.
    
    Args:
        sources: URL/chemin media OU liste de sources multiples
        funscript: Données funscript (dict, URL, ou chemin fichier)  
        name: Titre de l'item (affiché dans la playlist)
        description: Description détaillée (tooltip)
        poster: Image poster (URL, chemin, ou BytesIO)
        duration: Durée explicite (pour funscript seul)
        **kwargs: Autres métadonnées Video.js (textTracks, etc.)
        
    Returns:
        Dict au format Video.js étendu
        
    Examples:
        # Item simple
        create_playlist_item(
            sources="video.mp4",
            funscript={"actions": [...]},
            name="Scene 1"
        )
        
        # Multi-résolutions  
        create_playlist_item(
            sources=[
                {"src": "video_1080p.mp4", "type": "video/mp4", "label": "HD"},
                {"src": "video_720p.mp4", "type": "video/mp4", "label": "SD"}
            ],
            funscript="script.funscript",
            name="Scene Multi-Res"
        )
        
        # Funscript seul
        create_playlist_item(
            funscript=load_funscript("haptic.funscript"),
            name="Haptic Only",
            duration=120.5
        )
    """
    item = {}
    
    # ✅ SOURCES: Normaliser vers format Video.js
    if sources:
        if isinstance(sources, str):
            # Source unique → convertir en array
            item['sources'] = [{'src': sources}]
        elif isinstance(sources, list):
            # Sources multiples → valider le format
            item['sources'] = []
            for src in sources:
                if isinstance(src, str):
                    item['sources'].append({'src': src})
                elif isinstance(src, dict):
                    item['sources'].append(src)
                else:
                    raise ValueError(f"Invalid source format: {src}")
        else:
            raise ValueError(f"sources must be str or list, got {type(sources)}")
    
    # ✅ FUNSCRIPT: Supporter plusieurs formats
    if funscript is not None:
        if isinstance(funscript, (str, os.PathLike)):
            # Chemin fichier → charger
            funscript_path = Path(funscript)
            if funscript_path.is_file():
                item['funscript'] = load_funscript(funscript_path)
            else:
                # URL → passer tel quel
                item['funscript'] = str(funscript)
        elif isinstance(funscript, dict):
            # Données directes → passer tel quel
            item['funscript'] = funscript
        else:
            raise ValueError(f"funscript must be str, Path, or dict, got {type(funscript)}")
    
    # ✅ MÉTADONNÉES: Format Video.js standard
    if name:
        item['name'] = name
    if description:
        item['description'] = description
    if duration is not None:
        item['duration'] = float(duration)
    
    # ✅ POSTER: Convertir si nécessaire
    if poster is not None:
        if isinstance(poster, (str, os.PathLike)):
            poster_path = Path(poster)
            if poster_path.is_file():
                # Fichier local → convertir en data URL
                item['poster'] = file_to_data_url(poster_path)
            else:
                # URL → passer tel quel
                item['poster'] = str(poster)
        elif isinstance(poster, BytesIO):
            # BytesIO → convertir en data URL
            item['poster'] = file_to_data_url(poster)
        else:
            raise ValueError(f"poster must be str, Path, or BytesIO, got {type(poster)}")
    
    # ✅ AUTRES: Métadonnées Video.js additionnelles
    item.update(kwargs)
    
    return item


def create_playlist(*items, **playlist_options) -> List[Dict[str, Any]]:
    """
    Crée une playlist complète à partir de plusieurs items.
    
    Args:
        *items: Items de playlist (dicts ou tuples de paramètres)
        **playlist_options: Options globales (unused pour l'instant)
        
    Returns:
        Liste d'items au format Video.js étendu
        
    Examples:
        # Plusieurs items
        playlist = create_playlist(
            create_playlist_item("video1.mp4", funscript1, "Scene 1"),
            create_playlist_item("video2.mp4", funscript2, "Scene 2")
        )
        
        # Mixed formats
        playlist = create_playlist(
            {"sources": [{"src": "video.mp4"}], "name": "Manual item"},
            create_playlist_item("audio.mp3", funscript=data, name="Generated item")
        )
    """
    result = []
    
    for item in items:
        if isinstance(item, dict):
            # Déjà un dict → valider et ajouter
            result.append(item)
        elif isinstance(item, (tuple, list)):
            # Tuple de paramètres → convertir
            result.append(create_playlist_item(*item))
        else:
            raise ValueError(f"Invalid item type: {type(item)}")
    
    return result


# ============================================================================
# CONVERSION FICHIERS - ✅ AMÉLIORÉ: Détection MIME + validation
# ============================================================================

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
    
    # ✅ AMÉLIORÉ: Détection MIME plus complète
    file_extension = Path(filename).suffix.lower()
    mime_types = {
        # Video formats
        '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska', '.ogv': 'video/ogg',
        '.m4v': 'video/mp4',
        
        # Audio formats  
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac',
        '.oga': 'audio/ogg',
        
        # Funscript/JSON
        '.funscript': 'application/json', '.json': 'application/json',
        
        # Images (posters)
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.webp': 'image/webp'
    }
    
    mime_type = mime_types.get(file_extension, 'application/octet-stream')
    
    # Encode to base64
    try:
        base64_content = base64.b64encode(bytes_content).decode('utf-8')
    except Exception as e:
        raise ValueError(f"Failed to encode file to base64: {e}")
    
    return f"data:{mime_type};base64,{base64_content}"


def load_funscript(file_path: Union[str, os.PathLike]) -> Dict[str, Any]:
    """
    Utility function to load a funscript file from disk.
    
    Parameters
    ----------
    file_path : str or Path
        Path to the .funscript file
        
    Returns
    -------
    dict
        Parsed funscript data
        
    Examples
    --------
    >>> funscript_data = load_funscript("my_script.funscript")
    >>> item = create_playlist_item(
    ...     sources="video.mp4",
    ...     funscript=funscript_data,
    ...     name="My Scene"
    ... )
    """
    file_path = Path(file_path)
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"Funscript file not found: {file_path}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in funscript file {file_path}: {e}")


# ============================================================================
# UTILITAIRES DE VALIDATION - ✅ NOUVEAU
# ============================================================================

def validate_playlist_item(item: Dict[str, Any]) -> bool:
    """
    Valide qu'un item de playlist est au bon format.
    
    Args:
        item: Item à valider
        
    Returns:
        True si valide, False sinon
    """
    if not isinstance(item, dict):
        return False
    
    # Au moins sources OU funscript requis
    has_sources = 'sources' in item and isinstance(item['sources'], list) and len(item['sources']) > 0
    has_funscript = 'funscript' in item and item['funscript'] is not None
    
    return has_sources or has_funscript


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


# ============================================================================
# COMPOSANT PRINCIPAL - ✅ NOUVEAU: Format Video.js étendu uniquement
# ============================================================================

def funplayer(
    playlist: List[Dict[str, Any]] = None,
    theme: Dict[str, str] = None,
    key: str = None
) -> Any:
    """
    Create a FunPlayer component for synchronized media and haptic playback.
    
    Parameters
    ----------
    playlist : list of dict
        Playlist d'items au format Video.js étendu. Chaque dict peut contenir:
        
        **Format Video.js standard:**
        - 'sources': list of dict - Sources media (URLs ou data URLs)
          Exemple: [{"src": "video.mp4", "type": "video/mp4", "label": "HD"}]
        - 'poster': str - URL de l'image poster (optionnel)
        - 'name': str - Titre de l'item (affiché dans playlist)
        - 'description': str - Description détaillée (tooltip)
        - 'duration': float - Durée en secondes (optionnel)
        - 'textTracks': list - Sous-titres/captions (optionnel)
        
        **Extensions FunPlayer:**
        - 'funscript': dict/str - Données funscript ou URL (optionnel)
        
        **Exemples:**
        
        # Item classique (video + funscript)
        {
            'sources': [{'src': 'video.mp4', 'type': 'video/mp4'}],
            'funscript': {'actions': [...]},
            'name': 'Scene 1',
            'poster': 'poster.jpg'
        }
        
        # Multi-résolutions
        {
            'sources': [
                {'src': 'video_1080p.mp4', 'type': 'video/mp4', 'label': 'HD'},
                {'src': 'video_720p.mp4', 'type': 'video/mp4', 'label': 'SD'}
            ],
            'funscript': funscript_data,
            'name': 'Multi-Res Scene'
        }
        
        # Funscript seul (haptic pur)
        {
            'funscript': load_funscript('script.funscript'),
            'name': 'Haptic Only',
            'duration': 180.5
        }
        
        # Audio + haptic
        {
            'sources': [{'src': 'audio.mp3', 'type': 'audio/mpeg'}],
            'funscript': funscript_data,
            'name': 'Audio Experience'
        }
        
    theme : dict, optional
        Customisation du thème:
        - 'primaryColor': Couleur principale
        - 'backgroundColor': Arrière-plan
        - 'textColor': Couleur du texte
        - etc.
        
    key : str, optional
        Clé unique du composant Streamlit
        
    Returns
    -------
    Any
        Valeur de retour du composant (actuellement None)
        
    Examples
    --------
    
    # Exemple simple
    import streamlit as st
    from streamlit_funplayer import funplayer, create_playlist_item
    
    playlist = [
        create_playlist_item(
            sources="https://example.com/video.mp4",
            funscript={"actions": [{"at": 0, "pos": 0}, {"at": 1000, "pos": 100}]},
            name="Demo Scene"
        )
    ]
    
    funplayer(playlist=playlist)
    
    # Exemple avec upload fichier
    video_file = st.file_uploader("Video", type=['mp4', 'webm'])
    funscript_file = st.file_uploader("Funscript", type=['funscript'])
    
    if video_file and funscript_file:
        playlist = [
            create_playlist_item(
                sources=file_to_data_url(video_file),
                funscript=json.loads(funscript_file.getvalue().decode('utf-8')),
                name=video_file.name
            )
        ]
        funplayer(playlist=playlist)
    
    # Playlist complète
    from streamlit_funplayer import create_playlist
    
    playlist = create_playlist(
        create_playlist_item("video1.mp4", funscript1, "Scene 1"),
        create_playlist_item("audio2.mp3", funscript2, "Scene 2"),
        create_playlist_item(funscript=funscript3, name="Haptic Only", duration=120)
    )
    
    funplayer(playlist=playlist)
    """
    
    # Validation des paramètres
    if playlist is not None:
        if not isinstance(playlist, list):
            raise ValueError("playlist must be a list of dict")
        
        # Valider chaque item
        for i, item in enumerate(playlist):
            if not validate_playlist_item(item):
                raise ValueError(f"Invalid playlist item at index {i}: must have 'sources' or 'funscript'")
    
    # Préparer les arguments pour le composant
    component_args = {}
    
    if playlist is not None:
        component_args["playlist"] = playlist
    
    if theme is not None:
        component_args["theme"] = theme
    
    return _component_func(**component_args, key=key, default=None)


