import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>Mentova Academy - Votre mentor crypto IA</title>
        <meta name="description" content="Apprenez les cryptomonnaies avec Caufid, votre mentor IA personnalise. Modules structures, suivi de progression et donnees de marche en temps reel." />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Mentova Academy - Caufid - AI Mentor" />
        <meta property="og:description" content="Apprenez les cryptomonnaies avec Caufid, votre mentor IA personnalise. Acces libre." />
        <meta property="og:image" content="https://app.mentova-academy.com/assets/images/og-image.jpg" />
        <meta property="og:url" content="https://app.mentova-academy.com" />
        <meta property="og:site_name" content="Mentova Academy" />
        <meta property="og:locale" content="fr_FR" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Mentova Academy - Caufid - AI Mentor" />
        <meta name="twitter:description" content="Apprenez les cryptomonnaies avec Caufid, votre mentor IA personnalise." />
        <meta name="twitter:image" content="https://app.mentova-academy.com/assets/images/og-image.jpg" />

        {/* Theme */}
        <meta name="theme-color" content="#0A0A1A" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Google Ads Tag */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18465662025"></script>
        <script dangerouslySetInnerHTML={{ __html: "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-18465662025');" }} />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
