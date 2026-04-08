import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Prumo',
    short_name: 'Prumo',
    description:
      'Registre vendas e despesas do seu negócio por voz, com revisão simples e foco total no celular.',
    start_url: '/painel',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f7fb',
    theme_color: '#0284c7',
    icons: [
      {
        'src': '/icons/icon-192.png',
        'sizes': '192x192',
        'type': 'image/png',
        'purpose': 'any'
      },
      {
        'src': '/icons/icon-512.png',
        'sizes': '512x512',
        'type': 'image/png',
        'purpose': 'any'
      },
      {
        'src': '/icons/icon-192-maskable.png',
        'sizes': '192x192',
        'type': 'image/png',
        'purpose': 'maskable'
      },
      {
        'src': '/icons/icon-512-maskable.png',
        'sizes': '512x512',
        'type': 'image/png',
        'purpose': 'maskable'
      }
    ]
  }
}
