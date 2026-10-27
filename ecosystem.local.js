const path = require("path");

module.exports = {
  apps: [
    {
      name: "podacium-api",
      cwd: path.resolve(__dirname, "services/api"),
      script: path.resolve(__dirname, "services/api/podacium/bin/uvicorn"),
      args: "app.main:app --host 127.0.0.1 --port 8000 --reload",
      interpreter: "none",
      env: {
        NODE_ENV: "development",
        DB_HOST: "127.0.0.1",
        REDIS_HOST: "127.0.0.1",
        PRISMA_PY_DEBUG_GENERATOR: "1",
      },
    },
    {
      name: "podacium-web",
      cwd: path.resolve(__dirname, "apps/web"),
      script: path.resolve(__dirname, "apps/web/node_modules/.bin/next"),
      args: "dev -p 3000 --turbopack",
      interpreter: "none",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
        NEXT_PUBLIC_API_URL: "http://localhost:8000",
        NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
      },
    },
  ],
};
