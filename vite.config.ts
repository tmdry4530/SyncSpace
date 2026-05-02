import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@tiptap')) return 'editor-vendor'
          if (id.includes('yjs') || id.includes('y-websocket')) return 'yjs-vendor'
          if (id.includes('@supabase') || id.includes('@tanstack')) return 'data-vendor'
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'react-vendor'
          if (id.includes('lucide-react')) return 'icon-vendor'
          return 'vendor'
        }
      }
    }
  }
})
