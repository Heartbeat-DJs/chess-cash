import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Club Ledger — ChessCash',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
