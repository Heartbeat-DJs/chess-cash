import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Online Play — ChessCash',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
