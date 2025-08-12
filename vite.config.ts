// vite.config.js
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, "src/bookmarklet.ts"),
      name: "AmazonSynchronyYnabBookmarklet",
      // the proper extensions will be added
      fileName: "bookmarklet",
      formats: ["iife"],
    },
    rollupOptions: {
      output: {
        format: "iife",
        entryFileNames: "bookmarklet.min.js",
      },
    },
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
    },
  },
});
