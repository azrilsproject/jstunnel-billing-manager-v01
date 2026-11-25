module.exports = {
  apps: [
    {
      name: process.env.PM2_NAME || 'james-billing',
      script: 'node_modules/next/dist/bin/next',
      args: `start -p ${process.env.PORT || 3000}`,
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};
