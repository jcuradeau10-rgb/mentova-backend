#!/usr/bin/env python3
"""Fix batch 2 of remaining hardcoded French strings."""

REPLACEMENTS = {
    'app/vip/hub.tsx': [
        ('>Peur Extrême</Text>', '>{t("vipHub.fearExtreme")}</Text>'),
        ('>Avidité Extrême</Text>', '>{t("vipHub.greedExtreme")}</Text>'),
        ('>Démarrez une analyse</Text>', '>{t("vipHub.startAnalysis")}</Text>'),
        ('>Sélectionnez une crypto</Text>', '>{t("vipHub.selectCrypto")}</Text>'),
        ('>Soyez le premier à commenter !</Text>', '>{t("vipHub.beFirstComment")}</Text>'),
        ('>Alertes actives</Text>', '>{t("vip.hub.alert.activeAlerts")}</Text>'),
    ],
    'app/vip/success.tsx': [
        ('>🎉 Félicitations!</Text>', '>{t("vip.success.congrats")}</Text>'),
    ],
    'app/pro/catalog.tsx': [
        ('>Modèle de prix</Text>', '>{t("catalog.pricingModel")}</Text>'),
        ('>Sélectionner des contenus</Text>', '>{t("catalog.selectContents")}</Text>'),
    ],
    'app/pro/apply.tsx': [
        ('>Sélectionnez au moins un service</Text>', '>{t("apply.selectService")}</Text>'),
        ('>Disponibilité</Text>', '>{t("apply.availability")}</Text>'),
        ('>Sélectionnez votre pays</Text>', '>{t("apply.selectCountryTitle")}</Text>'),
    ],
    'app/pro/index.tsx': [
        ('>À partir de</Text>', '>{t("mentorIndex.startingAt")}</Text>'),
        ('>Niveau de vérification</Text>', '>{t("mentorIndex.verificationLevel")}</Text>'),
    ],
    'app/pro/analytics.tsx': [
        ('>Réservations</Text>', '>{t("analytics.bookings")}</Text>'),
        ('>Évolution des revenus</Text>', '>{t("analytics.revenueEvolution")}</Text>'),
        ('>Répartition des revenus</Text>', '>{t("analytics.revenueBreakdown")}</Text>'),
        ('>Complétion</Text>', '>{t("analytics.completion")}</Text>'),
        ('>Données Brutes</Text>', '>{t("analytics.rawData")}</Text>'),
    ],
    'app/pro/[id].tsx': [
        ('>À propos</Text>', '>{t("mentorProfile.about")}</Text>'),
        ('>Réserver</Text>', '>{t("mentorProfile.book")}</Text>'),
        ('>Avis récents</Text>', '>{t("mentorProfile.recentReviews")}</Text>'),
        ('>Sélectionnez une date *</Text>', '>{t("mentorProfile.selectDate")}</Text>'),
        ('>Récapitulatif</Text>', '>{t("mentorProfile.summary")}</Text>'),
    ],
    'app/(tabs)/profile.tsx': [
        ('>Sécurité, profil, préférences</Text>', '>{t("profile.securityProfile")}</Text>'),
        ('>Continuer à apprendre</Text>', '>{t("profile.continueLearning")}</Text>'),
    ],
    'app/(tabs)/learn.tsx': [
        ('>📌 Points Clés</Text>', '>{t("learn.keyPoints")}</Text>'),
    ],
    'app/(tabs)/index.tsx': [
        ('>Explorer le marché</Text>', '>{t("home.exploreMarket")}</Text>'),
    ],
    'app/(tabs)/ai.tsx': [
        ('>Réflexion en cours...</Text>', '>{t("ai.thinking")}</Text>'),
        ('>Prochaine réinitialisation dans</Text>', '>{t("ai.nextReset")}</Text>'),
        ('>IA illimitée</Text>', '>{t("ai.unlimitedAI")}</Text>'),
        ('>Accès aux pros</Text>', '>{t("ai.accessPros")}</Text>'),
    ],
    'app/(tabs)/market.tsx': [
        ('>Évolution du prix (7j)</Text>', '>{t("market.priceEvolution7d")}</Text>'),
    ],
    'app/admin.tsx': [
        ('>Vérification des permissions...</Text>', '>{t("admin.checkingPermissions")}</Text>'),
        ('>Activité récente</Text>', '>{t("admin.recentActivity")}</Text>'),
        ('>Gérer utilisateurs</Text>', '>{t("admin.manageUsers")}</Text>'),
        ('>Modérer posts</Text>', '>{t("admin.moderatePosts")}</Text>'),
        ('>Transactions récentes</Text>', '>{t("admin.recentTransactions")}</Text>'),
        ('>Activité communautaire</Text>', '>{t("admin.communityActivity")}</Text>'),
        ('>Répartition des rôles</Text>', '>{t("admin.roleDistribution")}</Text>'),
        ('>Catégories de posts</Text>', '>{t("admin.postCategories")}</Text>'),
        (">Journal d'activité admin</Text>", '>{t("admin.adminActivityLog")}</Text>'),
        ('>Les actions admin seront enregistrées ici</Text>', '>{t("admin.actionsRecorded")}</Text>'),
        ('>Les candidatures de mentors apparaîtront ici</Text>', '>{t("admin.applicationsWillAppear")}</Text>'),
        ('>Score communauté</Text>', '>{t("admin.communityScore")}</Text>'),
        ('>Détail publication</Text>', '>{t("admin.postDetail")}</Text>'),
        ('>Expérience</Text>', '>{t("admin.experienceLabel")}</Text>'),
        ('>Détail du signalement</Text>', '>{t("admin.reportDetail")}</Text>'),
        ('>Utilisateur signalé</Text>', '>{t("admin.reportedUser")}</Text>'),
        ('>Détails</Text>', '>{t("admin.details")}</Text>'),
        ('>Marquer comme résolu</Text>', '>{t("admin.markResolved")}</Text>'),
    ],
    'app/settings/index.tsx': [
        # Already fixed in batch 1
    ],
    'components/WalletConnect.tsx': [
        ("Entrer l'adresse manuellement", '{t("wallet.enterManually")}'),
        ('Entrez votre adresse Ethereum (0x...)', '{t("wallet.enterEthAddress")}'),
    ],
}

BASE = '/app/frontend/'

for filepath, replacements in REPLACEMENTS.items():
    if not replacements:
        continue
    full_path = BASE + filepath
    try:
        with open(full_path, 'r') as f:
            content = f.read()
        
        changes = 0
        for old, new in replacements:
            if old in content:
                content = content.replace(old, new, 1)
                changes += 1
        
        if changes > 0:
            with open(full_path, 'w') as f:
                f.write(content)
            print(f"✓ {filepath}: {changes} replacements")
        else:
            print(f"⚠ {filepath}: no matches found")
    except FileNotFoundError:
        print(f"✗ {filepath}: file not found")
    except Exception as e:
        print(f"✗ {filepath}: {e}")

print("\nDone!")
