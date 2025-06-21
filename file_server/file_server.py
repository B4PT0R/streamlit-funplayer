#!/usr/bin/env python3
"""
Serveur de fichiers local avec Flask
Usage: python file_server.py
Accès: http://localhost:5000/
"""

import os
import mimetypes
from pathlib import Path
from flask import Flask, send_from_directory, render_template_string, abort, request
from flask_cors import CORS
from urllib.parse import quote, unquote

# Configuration
FILES_DIR = "files"  # Dossier des fichiers à servir
PORT = 5000
HOST = "localhost"

app = Flask(__name__)
CORS(app)  # Permettre les requêtes cross-origin (pour Streamlit)

# Créer le dossier files s'il n'existe pas
Path(FILES_DIR).mkdir(exist_ok=True)

# Template HTML pour le navigateur de fichiers
BROWSE_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>📁 Serveur de Fichiers Local</title>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, system-ui, sans-serif; margin: 2rem; }
        .header { border-bottom: 2px solid #eee; padding-bottom: 1rem; margin-bottom: 2rem; }
        .file-list { display: grid; gap: 0.5rem; }
        .file-item { 
            display: flex; align-items: center; padding: 0.75rem; 
            border: 1px solid #ddd; border-radius: 8px; 
            transition: background 0.2s;
        }
        .file-item:hover { background: #f5f5f5; }
        .file-icon { margin-right: 1rem; font-size: 1.5rem; }
        .file-info { flex: 1; }
        .file-name { font-weight: 500; margin-bottom: 0.25rem; }
        .file-meta { font-size: 0.875rem; color: #666; }
        .file-url { font-family: monospace; font-size: 0.75rem; color: #888; }
        .copy-btn { 
            padding: 0.25rem 0.5rem; font-size: 0.75rem; 
            border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;
        }
        .copy-btn:hover { background: #f0f0f0; }
        .empty { text-align: center; color: #888; margin: 3rem 0; }
        .stats { background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📁 Serveur de Fichiers Local</h1>
        <p>Placez vos fichiers dans le dossier <code>{{ files_dir }}</code></p>
    </div>
    
    <div class="stats">
        <strong>{{ file_count }}</strong> fichier(s) • 
        <strong>{{ total_size }}</strong> • 
        Serveur: <code>{{ base_url }}</code>
    </div>

    {% if files %}
    <div class="file-list">
        {% for file in files %}
        <div class="file-item">
            <div class="file-icon">{{ file.icon }}</div>
            <div class="file-info">
                <div class="file-name">{{ file.name }}</div>
                <div class="file-meta">{{ file.size }} • {{ file.type }}</div>
                <div class="file-url">{{ file.url }}</div>
            </div>
            <button class="copy-btn" onclick="copyToClipboard('{{ file.url }}')">📋 Copier URL</button>
        </div>
        {% endfor %}
    </div>
    {% else %}
    <div class="empty">
        <h3>Aucun fichier trouvé</h3>
        <p>Ajoutez des fichiers dans le dossier <code>{{ files_dir }}</code> et rechargez la page</p>
    </div>
    {% endif %}

    <script>
        async function copyToClipboard(text) {
            try {
                await navigator.clipboard.writeText(text);
                event.target.textContent = '✅ Copié!';
                setTimeout(() => {
                    event.target.textContent = '📋 Copier URL';
                }, 2000);
            } catch (err) {
                console.error('Erreur copie:', err);
            }
        }
    </script>
</body>
</html>
"""

def get_file_icon(filename):
    """Retourne une icône selon l'extension du fichier"""
    ext = Path(filename).suffix.lower()
    
    video_exts = {'.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'}
    audio_exts = {'.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'}
    script_exts = {'.funscript', '.json'}
    
    if ext in video_exts:
        return '🎥'
    elif ext in audio_exts:
        return '🎵'
    elif ext in script_exts:
        return '📜'
    else:
        return '📄'

def format_size(size_bytes):
    """Formate la taille du fichier"""
    if size_bytes == 0:
        return "0 B"
    
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"

def get_file_info(filepath):
    """Récupère les infos d'un fichier"""
    stat = filepath.stat()
    mime_type, _ = mimetypes.guess_type(str(filepath))
    
    # ✅ AJOUT: Encoder correctement le nom de fichier pour l'URL
    encoded_filename = quote(filepath.name)
    
    return {
        'name': filepath.name,
        'size': format_size(stat.st_size),
        'type': mime_type or 'unknown',
        'icon': get_file_icon(filepath.name),
        'url': f"http://{HOST}:{PORT}/files/{encoded_filename}"
    }

@app.route('/')
def browse_files():
    """Page principale - navigateur de fichiers"""
    files_path = Path(FILES_DIR)
    
    # Lister tous les fichiers
    file_list = []
    total_size = 0
    
    for filepath in files_path.iterdir():
        if filepath.is_file():
            file_info = get_file_info(filepath)
            file_list.append(file_info)
            total_size += filepath.stat().st_size
    
    # Trier par nom
    file_list.sort(key=lambda x: x['name'].lower())
    
    return render_template_string(
        BROWSE_TEMPLATE,
        files=file_list,
        file_count=len(file_list),
        total_size=format_size(total_size),
        files_dir=FILES_DIR,
        base_url=f"http://{HOST}:{PORT}"
    )

@app.route('/files/<path:filename>')
def serve_file(filename):
    """Servir un fichier spécifique avec headers CORS complets"""
    try:
        # ✅ AJOUT: Décoder l'URL pour récupérer le vrai nom de fichier
        decoded_filename = unquote(filename)
        
        # Sécurité : empêcher l'accès aux fichiers en dehors du dossier
        safe_path = os.path.join(FILES_DIR, decoded_filename)
        if not os.path.abspath(safe_path).startswith(os.path.abspath(FILES_DIR)):
            abort(403)
        
        response = send_from_directory(FILES_DIR, decoded_filename)
        
        # ✅ AJOUT: Headers CORS complets pour les médias
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Range, Content-Range, Content-Type'
        response.headers['Access-Control-Expose-Headers'] = 'Content-Range, Content-Length, Accept-Ranges'
        
        # ✅ AJOUT: Support des requêtes Range (important pour les vidéos)
        response.headers['Accept-Ranges'] = 'bytes'
        
        return response
    except FileNotFoundError:
        abort(404)

@app.route('/files/<path:filename>', methods=['OPTIONS'])
def serve_file_options(filename):
    """Gérer les requêtes OPTIONS pour CORS preflight"""
    response = app.make_default_options_response()
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Range, Content-Range, Content-Type'
    return response

@app.route('/api/files')
def api_files():
    """API JSON pour lister les fichiers"""
    files_path = Path(FILES_DIR)
    file_list = []
    
    for filepath in files_path.iterdir():
        if filepath.is_file():
            file_info = get_file_info(filepath)
            file_list.append(file_info)
    
    return {
        'files': sorted(file_list, key=lambda x: x['name'].lower()),
        'count': len(file_list),
        'base_url': f"http://{HOST}:{PORT}"
    }

@app.errorhandler(404)
def not_found(error):
    return f"<h1>404 - Fichier non trouvé</h1><a href='/'>← Retour</a>", 404

if __name__ == '__main__':
    print(f"🚀 Serveur de fichiers démarré!")
    print(f"📁 Dossier: {os.path.abspath(FILES_DIR)}")
    print(f"🌐 Interface: http://{HOST}:{PORT}")
    print(f"📋 API: http://{HOST}:{PORT}/api/files")
    print(f"💡 Placez vos fichiers dans le dossier '{FILES_DIR}' et ils seront accessibles via URL")
    print()
    
    app.run(host=HOST, port=PORT, debug=True)