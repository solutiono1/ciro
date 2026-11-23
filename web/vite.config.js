import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: {
    host: "127.0.0.1",
    fs: { allow: [path.resolve(root, "..")] },
  },
  preview: { host: "127.0.0.1" },
});
