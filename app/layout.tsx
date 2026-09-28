import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GemAI',
  description: 'Ask questions about gemstones — properties, identification, and occurrences. Powered by RAG with USGS and Smithsonian sources.',
  openGraph: {
    title: 'GemAI — Gemstone Knowledge Assistant',
    description: 'A RAG-powered chatbot that answers gemstone questions using USGS publications and the Smithsonian gem collection.',
    type: 'website',
  },
};

const themeScript = `
(function() {
  try {
    var saved = localStorage.getItem('theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
