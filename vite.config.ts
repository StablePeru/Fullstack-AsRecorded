import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
  }
}

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    tsconfigPaths(),
  ],

  server: {
    host: "0.0.0.0",   // Escucha en todas las IPs dentro del contenedor
    port: 5173,        // Puerto estándar de Vite HMR
    hmr: {
      host: "localhost", // Cómo se conecta el navegador para HMR
      port: 5173,
    },
  },

});
