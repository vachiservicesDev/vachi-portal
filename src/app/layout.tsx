import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'myVachi Self-Service Portal',
  description: 'Employee self-service platform for immigration compliance and HR management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
