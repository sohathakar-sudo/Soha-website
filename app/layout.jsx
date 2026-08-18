import "./globals.css";

export const metadata = {
  title: "Soha Thakar",
  description: "A personal corner of the internet.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14100e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="backdrop" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
