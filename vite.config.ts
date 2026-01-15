import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Chrome extension content scripts don't support ES modules well
// We need to bundle content script separately with IIFE format
export default defineConfig(({ mode }) => {
    const buildTarget = process.env.BUILD_TARGET;

    // Build service worker separately since it supports ES modules
    if (buildTarget === 'service-worker') {
        return {
            plugins: [react()],
            build: {
                outDir: 'dist',
                minify: false,
                emptyOutDir: false,
                rollupOptions: {
                    input: {
                        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
                    },
                    output: {
                        format: 'es',
                        entryFileNames: '[name].js',
                    },
                },
                copyPublicDir: false,
            },
            define: {
                'process.env.NODE_ENV': JSON.stringify('production'),
            },
        };
    }

    // Build dashboard sync script
    if (buildTarget === 'dashboard') {
        return {
            plugins: [react()],
            build: {
                outDir: 'dist',
                minify: false,
                emptyOutDir: false,
                rollupOptions: {
                    input: {
                        'dashboard-sync': resolve(__dirname, 'src/content/dashboard-sync.ts'),
                    },
                    output: {
                        format: 'iife',
                        entryFileNames: '[name].js',
                        inlineDynamicImports: true,
                    },
                },
                copyPublicDir: false,
            },
            define: {
                'process.env.NODE_ENV': JSON.stringify('production'),
            },
        };
    }

    // Default: build content script with IIFE format
    return {
        plugins: [react()],
        build: {
            outDir: 'dist',
            minify: false,
            emptyOutDir: true,
            cssCodeSplit: false,
            rollupOptions: {
                input: {
                    content: resolve(__dirname, 'src/content/index.tsx'),
                },
                output: {
                    format: 'iife',
                    entryFileNames: '[name].js',
                    chunkFileNames: '[name].js',
                    assetFileNames: (assetInfo) => {
                        if (assetInfo.name && assetInfo.name.endsWith('.css')) {
                            return 'content.css';
                        }
                        return '[name].[ext]';
                    },
                    inlineDynamicImports: true,
                },
            },
            copyPublicDir: true,
        },
        define: {
            'process.env.NODE_ENV': JSON.stringify('production'),
        },
    };
});
