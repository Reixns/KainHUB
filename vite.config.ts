import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { handleNodeRequest } from "./server/nodeAdapter.js";
import { handleSupabaseProxy } from "./server/supabaseProxy.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseBffPlugin: Plugin = {
  name: "kainhub-supabase-bff",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/api/supabase/")) {
        next();
        return;
      }
      try {
        const response = await handleSupabaseProxy(await handleNodeRequest(req));
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        console.error("[bff] local proxy request failed:", error);
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "The local authentication proxy failed." }));
      }
    });
  },
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  if (!process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";
  if (!process.env.SESSION_ENCRYPTION_KEY && env.SESSION_ENCRYPTION_KEY) {
    process.env.SESSION_ENCRYPTION_KEY = env.SESSION_ENCRYPTION_KEY;
  }

  return {
    plugins: [supabaseBffPlugin, react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, "/");
            if (normalizedId.includes("/node_modules/react/") || normalizedId.includes("/node_modules/react-dom/") || normalizedId.includes("/node_modules/scheduler/")) {
              return "react-vendor";
            }
            if (normalizedId.includes("/node_modules/@supabase/")) return "supabase-vendor";
            if (normalizedId.includes("/node_modules/react-router")) return "router-vendor";
          }
        },
      },
    },
  };
});
