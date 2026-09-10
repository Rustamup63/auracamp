import "./globals.css";

export const metadata = {
  title: "AURACAMP",
  description: "Earn, explore and grow with AURACAMP."
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}