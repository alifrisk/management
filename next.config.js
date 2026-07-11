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
          { key: 'X-Frame-Options',            value: 'DENY' },
          { key: 'X-Content-Type-Options',      value: 'nosniff' },
          { key: 'Referrer-Policy',             value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection',            value: '1; mode=block' },
          { key: 'Permissions-Policy',          value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security',   value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy',      value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://hdxylbhdconhttsdvbwv.supabase.co https://lh3.googleusercontent.com https://avatars.githubusercontent.com; connect-src 'self' https://hdxylbhdconhttsdvbwv.supabase.co wss://hdxylbhdconhttsdvbwv.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
        ],
      },
    ]
  },
}

module.exports = nextConfig
