import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Mon Closeur - Gestion Client IA WhatsApp par Wilfried Tiedrebeogo",
  description: "Solution de vente et de relances automatiques par intelligence artificielle pour entrepreneurs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="scroll-smooth">
      <body className={`${plusJakarta.className} antialiased bg-neige text-encre min-h-screen`}>
        <div className="noise-overlay"></div>
        {children}
      </body>
    </html>
  );
}
