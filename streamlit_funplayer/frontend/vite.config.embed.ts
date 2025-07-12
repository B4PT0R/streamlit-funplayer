import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"
import autoprefixer from 'autoprefixer'

/**
 * Configuration Vite pour build embed (Web Component)
 * Génère: funplayer-embed.min.js + funplayer-embed.css
 * 
 * Usage: npm run build:embed
 */
export default defineConfig({
  plugins: [react()],
  
  build: {
    // ============================================================================
    // CONFIGURATION EMBED
    // ============================================================================
    
    // Répertoire de sortie spécifique embed
    outDir: 'build-embed',
    
    // Clean avant build
    emptyOutDir: true,
    
    // Configuration library pour embed
    lib: {
      entry: './src/embed.js',  // Point d'entrée embed (à créer)
      name: 'FunPlayer',        // Nom global
      fileName: 'funplayer-embed',
      formats: ['umd']          // Format UMD pour compatibilité universelle
    },
    
    // ============================================================================
    // OPTIMISATIONS POUR EMBED
    // ============================================================================
    
    rollupOptions: {
      // Ne pas bundler React si déjà présent sur la page hôte (optionnel)
      external: [], // Pour l'instant, on bundle tout pour simplicité
      
      output: {
        // Nom des chunks
        assetFileNames: 'funplayer-embed.[ext]',
        chunkFileNames: 'funplayer-embed.[hash].js',
        entryFileNames: 'funplayer-embed.js',
        
        // ✅ AJOUTER: Fix le warning export named/default
        exports: 'named',
        
        // Variables globales
        globals: {}
      }
    },
    
    // ============================================================================
    // OPTIMISATIONS PERFORMANCE
    // ============================================================================
    
    // Minification agressive
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,    // Supprimer console.log en prod
        drop_debugger: true,   // Supprimer debugger
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      mangle: {
        keep_classnames: false,  // Garder les noms de classes pour debug
        keep_fnames: false
      }
    },
    
    // Chunking optimisé
    chunkSizeWarningLimit: 1000, // 1MB limite avant warning
    
    // ============================================================================
    // SOURCE MAPS POUR DEBUG
    // ============================================================================
    
    sourcemap: process.env.NODE_ENV !== 'production',
  },
  
  // ============================================================================
  // CSS CONFIGURATION
  // ============================================================================
  
  css: {
    postcss: {
      plugins: [
        autoprefixer({
          // Config optimisée pour embed
          overrideBrowserslist: [
            '> 0.5%',        // Plus large que "> 1%"
            'last 3 versions', // Une version de plus 
            'not dead'
          ]
        })
      ]
    }
  },
  
  // ============================================================================
  // DÉFINITIONS GLOBALES
  // ============================================================================
  
  define: {
    // Mode embed
    'process.env.FUNPLAYER_MODE': JSON.stringify('embed'),
    
    // Version (peut être injectée depuis package.json)
    'process.env.FUNPLAYER_VERSION': JSON.stringify('1.0.0'),
    
    // Environnement
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  
  // ============================================================================
  // CONFIGURATION SERVEUR (pour test embed local)
  // ============================================================================
  
  server: {
    port: 3002,  // Port différent du dev principal
    cors: true,  // CORS activé pour test cross-origin
    
    // Headers de sécurité pour test
    headers: {
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff'
    }
  },
  
  // ============================================================================
  // OPTIMISATIONS COMPATIBILITÉ
  // ============================================================================
  
  esbuild: {
    // Cible ES2018 pour large compatibilité
    target: 'es2018',
    
    // Supprimer les commentaires
    legalComments: 'none'
  },
  
  // ============================================================================
  // POLYFILLS & LEGACY SUPPORT
  // ============================================================================
  
  // Legacy plugin si support IE/anciens navigateurs nécessaire
  // plugins: [
  //   react(),
  //   legacy({
  //     targets: ['defaults', 'not IE 11']
  //   })
  // ]
})