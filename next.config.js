/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com', 'avatars.githubusercontent.com'],
  },
  experimental: {
    serverComponentsExternalPackages: ['docx'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Запрет встраивания в iframe (защита от clickjacking)
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Запрет MIME-sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Политика реферера
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Отключить устаревший XSS-фильтр браузера (современный подход)
          { key: 'X-XSS-Protection', value: '0' },
          // Ограничение доступа к браузерным API
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
