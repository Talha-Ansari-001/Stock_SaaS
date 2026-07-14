module.exports = {
  apps: [
    {
      name: 'saas-inventory-backend',
      script: 'server.js',
      
      // Cluster Mode Configuration
      instances: 'max',       // Run instances matching total available logical CPU cores
      exec_mode: 'cluster',   // Load balance requests across instances in a cluster

      // Lifecycle & Recovery
      autorestart: true,      // Automatically restart app if it crashes
      watch: false,           // Do not watch files in production (prevents unnecessary restarts)
      max_memory_restart: '500M', // Recycle instances exceeding 500MB RAM to prevent memory leaks

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,

      // Environment Management
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
