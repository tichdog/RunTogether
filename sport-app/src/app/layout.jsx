import '@/client/index.css'
import '@/client/styles/auth.css'
import '@/client/styles/user-app.css'

export const metadata = {
  title: 'RunTogether',
  description: 'Collaborative training app',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png' },
    ],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
