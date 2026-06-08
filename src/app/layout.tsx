import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChessCash — Play Chess for Real Money",
  description: "Compete in head-to-head chess matches for real cash prizes. 100% skill-based. Legal in 40+ states. $1 and $2 games. Instant matchmaking.",
  keywords: "chess, real money, cash games, skill gaming, chess betting, play chess online",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0A0A08" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>♔</text></svg>" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
