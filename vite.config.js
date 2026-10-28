import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'symbol.png', 'icon-192.png', 'icon-512.png'],
      workbox: {
        globIgnores: ['**/firebase-*.js'], // Firebase грузится только если настроен
        // Шрифт Manrope лежит в /assets (woff2) — без него установленное приложение в
        // офлайне показывало бы системный шрифт. Иконки (png/svg) — тоже в прекэш.
        // Фото блюд сюда НЕ попадают: их сотни, и они кэшируются по мере просмотра ниже.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        cleanupOutdatedCaches: true,
        // Фото блюд и логотипы (public/images) кэшируем по мере просмотра, а не при установке
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/images/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'menu-images',
              expiration: { maxEntries: 600, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          }
        ]
      },
      manifest: {
        // Имя и иконка — то, что пользователь видит на домашнем экране. В приложении
        // бренд называется «Заберу!», поэтому манифест не должен расходиться с ним.
        name: 'Заберу!',
        short_name: 'Заберу!',
        id: '/',
        description: 'Предзаказ еды к точному времени: заказали — пришли — забрали, без очереди.',
        lang: 'ru',
        dir: 'ltr',
        theme_color: '#15201C',
        background_color: '#F4F5F1',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        categories: ['food', 'shopping', 'lifestyle'],
        prefer_related_applications: false,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          // Тот же файл, но помечен maskable: значок часов занимает ~55% полотна,
          // то есть целиком помещается в безопасный круг маски Android.
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        // Долгое нажатие на иконку: сразу к заказам, минуя главную.
        shortcuts: [
          {
            name: 'Мои заказы',
            short_name: 'Заказы',
            url: '/my-orders',
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }]
          }
        ]
      }
    })
  ]
});
