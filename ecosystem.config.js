module.exports = {
  apps: [
    {
      name: 'panitia-kurban-app',
      script: 'dist/main.js',
      instances: 'max', // Use maximum available CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Konfigurasi Database (Ganti dengan DB eksternal jika PM2)
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_USERNAME: 'admin',
        DB_PASSWORD: 'adminpassword',
        DB_NAME: 'panitia_kurban',
        JWT_SECRET: 'ganti_dengan_secret_yg_sangat_panjang',
      },
    },
  ],
};
