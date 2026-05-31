import '@/client/index.css'
import '@/client/styles/auth.css'
import 'react-phone-number-input/style.css'
import '@/client/styles/user-app.css'

export const metadata = {
  title: 'RunTogether',
  description: 'Collaborative training app',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: 'any' },
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
