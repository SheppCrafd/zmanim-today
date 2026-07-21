import base44 from "@base44/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  logLevel: "error", // Suppress warnings, only show errors
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === "true",
    }),
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core changes far less often than app code and is loaded on
          // every route (Home is eager, everything else is lazy but still
          // depends on it). Splitting it into its own chunk means a deploy
          // that only touches app code doesn't invalidate the browser's
          // cached copy of react/react-dom — same bytes shipped, better
          // repeat-visit caching. Doesn't change what loads eagerly vs.
          // lazily for any route.
          "react-vendor": ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
