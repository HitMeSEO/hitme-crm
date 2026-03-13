import './globals.css';
import { ThemeProvider } from '@/lib/theme';

export const metadata = {
  title: 'Hit Me SEO CRM',
  description: 'Client management for Hit Me SEO',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
