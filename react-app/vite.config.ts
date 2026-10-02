import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // サブフォルダ (例: /my-first-project/react-app/) に置いても動くよう相対パスで出力
  base: './',
  plugins: [react()],
})
