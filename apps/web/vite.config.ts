import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');
  const parsed = Number.parseInt(env.WEB_PORT ?? '', 10);
  const port = Number.isFinite(parsed) && parsed > 0 ? parsed : 5173;
  const apiPort: string = env.API_PORT?.trim() || '3000';
  const publicApiBaseUrl: string =
    env.PUBLIC_API_BASE_URL?.trim() || `http://localhost:${apiPort}`;
  const publicGoogleMapsKey: string = env.PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';

  return {
    envDir: repoRoot,
    define: {
      'import.meta.env.PUBLIC_API_BASE_URL': JSON.stringify(publicApiBaseUrl),
      'import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY': JSON.stringify(publicGoogleMapsKey),
    },
    plugins: [tailwindcss(), sveltekit()],
    server: { port },
  };
});
