// pm2 process config for production web + api tiers.
// podacium-api  -> uvicorn via start-api.sh  (:8000)
// podacium-web  -> scripts/pm2-start.sh     (:3000)
// These run under pm2 on the EC2 VPS — NOT Docker (see docs/runbooks/deployment.md).
module.exports = {
  apps: [
    {
      name: "podacium-api",
      cwd: "/opt/podacium/services/api",
      script: "/opt/podacium/start-api.sh",
      interpreter: "bash",
      env: { NODE_ENV: "production" },
      max_restarts: 10,
      max_memory_restart: "2500M",
      min_uptime: 10000,
      kill_timeout: 30000,
      exp_backoff_restart_delay: 100,
    },
    {
      name: "podacium-web",
      cwd: "/opt/podacium/apps/web",
      script: "scripts/pm2-start.sh",
      interpreter: "bash",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        NEXT_PUBLIC_API_URL: "https://backend-api.podacium.com",
        NEXT_PUBLIC_BASE_URL: "https://podacium.com",
        NEXTAUTH_URL: "https://podacium.com",
      },
      max_restarts: 10,
      min_uptime: 10000,
      kill_timeout: 30000,
      exp_backoff_restart_delay: 100,
    },
    {
      name: "podacium-celery-worker",
      cwd: "/opt/podacium/services/api",
      script: "/opt/podacium/start-celery-worker.sh",
      interpreter: "bash",
      env: { NODE_ENV: "production" },
      max_restarts: 10,
      max_memory_restart: "2500M",
      min_uptime: 10000,
      kill_timeout: 30000,
      exp_backoff_restart_delay: 200,
    },
    {
      name: "podacium-celery-beat",
      cwd: "/opt/podacium/services/api",
      script: "/opt/podacium/start-celery-beat.sh",
      interpreter: "bash",
      env: { NODE_ENV: "production" },
      max_restarts: 10,
      max_memory_restart: "2500M",
      min_uptime: 10000,
      kill_timeout: 30000,
      exp_backoff_restart_delay: 500,
    },
  ],
};
