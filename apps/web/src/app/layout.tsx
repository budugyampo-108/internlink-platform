import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'InternLink — Find attachments near you', template: '%s · InternLink' },
  description: 'Connect students with companies for internships and industrial attachments, wherever you are for the vacation.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b1020' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
