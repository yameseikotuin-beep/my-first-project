import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Skin Note — 肌の記録とカウンセリング',
    short_name: 'Skin Note',
    description: '美容目的の肌の見た目の記録とカウンセリング補助アプリ',
    start_url: '/home',
    display: 'standalone',
    background_color: '#faf7f0',
    theme_color: '#faf7f0',
    lang: 'ja',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
