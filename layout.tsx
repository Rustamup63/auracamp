export const metadata = {
  title: "AURACAMP",
  description: "Earn, Explore & Grow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
