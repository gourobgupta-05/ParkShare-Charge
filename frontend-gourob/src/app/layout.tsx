import "./globals.css";

export const metadata = {
  title: "ParkShare & Charge — Gourob Module",
  description: "CSE471 Group 9 — Gourob Gupta's Module 1 frontend (Feedback Matrix)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
