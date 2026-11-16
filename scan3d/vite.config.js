import { defineConfig } from 'vite';

// Un solo file JS pronto per <script>, senza hash nel nome: finisce in assets/scan3d.js
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: '../assets',
    emptyOutDir: false,
    target: 'es2020',
    lib: { entry: 'src/main.jsx', formats: ['iife'], name: 'Scan3D', fileName: () => 'scan3d.js' },
  },
});
