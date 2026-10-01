import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HumanaMentePsi — Consultórios para sublocação na Barra da Tijuca",
    template: "%s | HumanaMentePsi",
  },
  description:
    "Três consultórios profissionais para sublocação na Avenida das Américas, Barra da Tijuca. Consulte a agenda em tempo real e solicite horários pelo WhatsApp.",
  keywords: [
    "sublocação consultório",
    "sala para psicólogo",
    "Barra da Tijuca",
    "consultório aluguel por hora",
    "HumanaMentePsi",
  ],
  openGraph: {
    title: "HumanaMentePsi — Consultórios para sublocação",
    description:
      "Consulte a disponibilidade dos nossos três consultórios e solicite seu horário pelo WhatsApp.",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
