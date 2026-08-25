import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
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
    <html lang="fr" className={`scroll-smooth ${spaceGrotesk.variable}`}>
      <body className={`${plusJakarta.className} antialiased bg-neige text-encre min-h-screen`}>
        <div className="noise-overlay"></div>
        {children}
        <Script 
          src="https://connect.facebook.net/en_US/sdk.js" 
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
