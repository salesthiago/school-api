module.exports = {
  apps: [
    {
      name: 'gpschool-backend',
      script: 'dist/main.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
