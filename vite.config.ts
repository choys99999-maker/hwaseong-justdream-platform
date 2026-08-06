import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
const servicePrefix = process.env.JUPYTERHUB_SERVICE_PREFIX
const developmentBase = servicePrefix ? `${servicePrefix}proxy/absolute/5173/` : '/'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? developmentBase : '/wecandoit/',
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: ['ahnbi3.suwon.ac.kr'],
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
}))
