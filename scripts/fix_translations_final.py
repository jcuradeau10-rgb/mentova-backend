#!/usr/bin/env python3
"""Fix all remaining hardcoded French strings across frontend files."""
import re

# Define replacements per file: (old_string, new_string)
REPLACEMENTS = {
    # === admin.tsx ===
    'app/admin.tsx': [
        ('>Publications</Text>', '>{t("admin.publications")}</Text>'),
        ('>Aucune publication récente</Text>', '>{t("admin.noRecentPosts")}</Text>'),
        ('>Voir logs</Text>', '>{t("admin.viewLogs")}</Text>'),
        ('placeholder="Rechercher par nom ou email..."', 'placeholder={t("admin.searchByNameEmail")}'),
        ('>Aucun utilisateur trouvé</Text>', '>{t("admin.noUsers")}</Text>'),
        ('placeholder="Rechercher une publication..."', 'placeholder={t("admin.searchPublication")}'),
        ('>Aucune publication trouvée</Text>', '>{t("admin.noPosts")}</Text>'),
        ('>Aucun signalement</Text>', '>{t("admin.noReports")}</Text>'),
        ('>Revenus de la plateforme</Text>', '>{t("admin.platformRevenue")}</Text>'),
        ('>Revenus totaux</Text>', '>{t("admin.totalRevenue")}</Text>'),
        ('>Retraits en attente</Text>', '>{t("admin.pendingWithdrawals")}</Text>'),
        ('>Top Mentors</Text>', '>{t("admin.topMentors")}</Text>'),
        ('>Demandes de retrait en attente</Text>', '>{t("admin.pendingWithdrawalRequests")}</Text>'),
        ('>Aucune transaction</Text>', '>{t("admin.noTransactions")}</Text>'),
        ('>Inscriptions (7 derniers jours)</Text>', '>{t("admin.registrations7Days")}</Text>'),
        ('>Aucun log disponible</Text>', '>{t("admin.noLogs")}</Text>'),
        ('>Candidatures Mentors</Text>', '>{t("admin.mentorApplications")}</Text>'),
        ('>Aucune candidature</Text>', '>{t("admin.noApplications")}</Text>'),
        ('>Inscrit le</Text>', '>{t("admin.registeredOn")}</Text>'),
        ('>Statut VIP</Text>', '>{t("admin.vipStatus")}</Text>'),
        ('>Statut Mentor</Text>', '>{t("admin.mentorStatus")}</Text>'),
        ('>Supprimer cette publication</Text>', '>{t("admin.deletePost")}</Text>'),
        ('>Annuler</Text>\n', '>{t("common.cancel")}</Text>\n'),
        ('>Confirmer</Text>', '>{t("common.confirm")}</Text>'),
        ('>Candidature Mentor</Text>', '>{t("admin.mentorApplication")}</Text>'),
        ('>Expertise</Text>', '>{t("admin.expertise")}</Text>'),
        ('>Signalé par</Text>', '>{t("admin.reportedBy")}</Text>'),
        ('>Statut actuel</Text>', '>{t("admin.currentStatus")}</Text>'),
        ('>Notes admin</Text>', '>{t("admin.adminNotes")}</Text>'),
        ('placeholder="Ajouter des notes..."', 'placeholder={t("admin.addNotes")}'),
    ],
    # === vip/hub.tsx ===
    'app/vip/hub.tsx': [
        ('>Total</Text>', '>{t("vipHub.total")}</Text>'),
        ('>Prix au-dessus</Text>', '>{t("vipHub.priceAbove")}</Text>'),
        ('>Prix en-dessous</Text>', '>{t("vipHub.priceBelow")}</Text>'),
        ('>Valeur totale du portefeuille</Text>', '>{t("vipHub.portfolioValue")}</Text>'),
        ('>Connecter Wallet</Text>', '>{t("vipHub.connectWallet")}</Text>'),
        ('>Vos actifs</Text>', '>{t("vipHub.yourAssets")}</Text>'),
        ('>Offres</Text>', '>{t("vipHub.offers")}</Text>'),
        ('>Packs, bundles, mentoring</Text>', '>{t("vipHub.packsBundlesMentoring")}</Text>'),
        ('>Contenu exclusif</Text>', '>{t("vipHub.exclusiveContent")}</Text>'),
        ('>Packs & Bundles</Text>', '>{t("vipHub.packsAndBundles")}</Text>'),
        ('>Sessions Live</Text>', '>{t("vipHub.liveSessions")}</Text>'),
        ('>Cours Complets</Text>', '>{t("vipHub.completeCourses")}</Text>'),
        ('>Parcourir le Catalogue</Text>', '>{t("vipHub.browseCatalog")}</Text>'),
        ('>Experts Crypto</Text>', '>{t("vipHub.cryptoExperts")}</Text>'),
        ('>Experts en vedette</Text>', '>{t("vipHub.featuredExperts")}</Text>'),
        ('>Actualiser</Text>', '>{t("vipHub.refreshBtn")}</Text>'),
        ('>Voir tous les experts</Text>', '>{t("vipHub.viewAllExperts")}</Text>'),
        ('>IA Analyse</Text>', '>{t("vipHub.aiAnalysis")}</Text>'),
        ('>Prix cible (USD)</Text>', '>{t("vipHub.targetPrice")}</Text>'),
        ('placeholder="Nom (ex: Bitcoin)"', 'placeholder={t("vipHub.namePlaceholder")}'),
        ('placeholder="Prix d\'achat ($)"', 'placeholder={t("vipHub.purchasePricePlaceholder")}'),
        ('>Fermer</Text>', '>{t("common.close")}</Text>'),
        ('placeholder="Partagez vos insights... (utilisez $BTC pour mentionner)"', 'placeholder={t("vipHub.shareInsightsPlaceholder")}'),
        ('>Contenu du cours</Text>', '>{t("vipHub.courseContent")}</Text>'),
        ('>Progression</Text>', '>{t("vipHub.courseProgress")}</Text>'),
        ('>Contenu du module</Text>', '>{t("vipHub.moduleContent")}</Text>'),
        ('>Regarder la vidéo</Text>', '>{t("vipHub.watchVideo")}</Text>'),
        ('>Retour au cours</Text>', '>{t("vipHub.backToCourse")}</Text>'),
        ('>Comment trouver mon adresse ?</Text>', '>{t("vipHub.howToFindAddress")}</Text>'),
        ("'Continuer le cours'", 't("vipHub.continueCourse")'),
        ("'Commencer le cours'", 't("vipHub.startCourse")'),
    ],
    # === pro/catalog.tsx ===
    'app/pro/catalog.tsx': [
        ('>Chargement...</Text>', '>{t("common.loading")}</Text>'),
        ('>Revenus</Text>', '>{t("catalog.revenue")}</Text>'),
        ('>Ventes</Text>', '>{t("catalog.sales")}</Text>'),
        ('>Contenus</Text>', '>{t("catalog.contents")}</Text>'),
        ('>Aucun contenu</Text>', '>{t("catalog.noContent")}</Text>'),
        ('>Bundle, mentoring, abonnement...</Text>', '>{t("catalog.createOfferDesc")}</Text>'),
        ('>Aucune offre</Text>', '>{t("catalog.noOffer")}</Text>'),
        ('>Enregistrer</Text>', '>{t("common.save")}</Text>'),
        ('>Prix par session ($)</Text>', '>{t("catalog.pricePerSession")}</Text>'),
        ('>Questions</Text>', '>{t("catalog.questions")}</Text>'),
        ('>Ajouter une question</Text>', '>{t("catalog.addQuestion")}</Text>'),
        ('>Date</Text>', '>{t("catalog.date")}</Text>'),
        ('>Heure</Text>', '>{t("catalog.time")}</Text>'),
        ('>Contenu Premium</Text>', '>{t("catalog.premiumContent")}</Text>'),
        ('>Prix ($) *</Text>', '>{t("catalog.priceRequired")}</Text>'),
        ('>Aucun contenu disponible</Text>', '>{t("catalog.noContentAvailable")}</Text>'),
        ('>Créer du contenu</Text>', '>{t("catalog.createContentAction")}</Text>'),
    ],
    # === pro/apply.tsx ===
    'app/pro/apply.tsx': [
        (">En cours d'examen", '>{t("apply.pendingReview")}'),
        ('>Nom</Text>', '>{t("apply.nameLabel")}</Text>'),
        ('>Expertise</Text>', '>{t("apply.expertiseLabel")}</Text>'),
        (">Notes de l'admin</Text>", '>{t("apply.adminNotesLabel")}</Text>'),
        ('>Nom complet *</Text>', '>{t("apply.fullNameLabel")}</Text>'),
        (">Ajoutez des liens et preuves de votre expertise (optionnel)</Text>", '>{t("apply.addLinksSubtitle")}</Text>'),
        ('>Profil LinkedIn</Text>', '>{t("apply.linkedinLabel")}</Text>'),
        ('>Profil Twitter/X</Text>', '>{t("apply.twitterLabel")}</Text>'),
        ('placeholder="Ex: CFA, CFP, Certified Blockchain Expert..."', 'placeholder={t("apply.certPlaceholder")}'),
        ('>Devenir Mentor</Text>', '>{t("apply.becomeMentor")}</Text>'),
        ('>Profil</Text>', '>{t("apply.profileStep")}</Text>'),
        ('>Expertise</Text>', '>{t("apply.expertiseStep")}</Text>'),
        ('>Crédibilité</Text>', '>{t("apply.credibilityStep")}</Text>'),
        ('>Précédent</Text>', '>{t("apply.previous")}</Text>'),
        ('>Suivant</Text>', '>{t("apply.next")}</Text>'),
    ],
    # === pro/analytics.tsx ===
    'app/pro/analytics.tsx': [
        ('>Aucun avis pour le moment</Text>', '>{t("analytics.noReviews")}</Text>'),
        ('>Analytiques & Rapports</Text>', '>{t("analytics.title")}</Text>'),
        ('>Revenu Total</Text>', '>{t("analytics.totalRevenue")}</Text>'),
        ('>Inscriptions</Text>', '>{t("analytics.enrollments")}</Text>'),
        ('>Export & Rapports</Text>', '>{t("analytics.exportReports")}</Text>'),
    ],
    # === pro/[id].tsx ===
    'app/pro/[id].tsx': [
        ('>Mentor non trouvé</Text>', '>{t("mentorProfile.notFound")}</Text>'),
        ('>Retour</Text>', '>{t("common.back")}</Text>'),
        ('>Aucun service disponible</Text>', '>{t("mentorProfile.noServices")}</Text>'),
        ('>Réponse du mentor</Text>', '>{t("mentorProfile.mentorResponse")}</Text>'),
        ('>Aucun avis pour le moment</Text>', '>{t("mentorProfile.noReviews")}</Text>'),
        ('>Créneaux disponibles *</Text>', '>{t("mentorProfile.availableSlots")}</Text>'),
        ('>Aucun créneau disponible ce jour</Text>', '>{t("mentorProfile.noSlots")}</Text>'),
        ('>Message (optionnel)</Text>', '>{t("mentorProfile.messageOptional")}</Text>'),
        ('>Date</Text>', '>{t("mentorProfile.summaryDate")}</Text>'),
        ('>Heure</Text>', '>{t("mentorProfile.summaryTime")}</Text>'),
    ],
    # === pro/index.tsx ===
    'app/pro/index.tsx': [
        ('placeholder="Rechercher par nom, expertise..."', 'placeholder={t("mentorIndex.searchPlaceholder")}'),
        ('>Expertise</Text>', '>{t("mentorIndex.expertiseFilter")}</Text>'),
        ('>Trier par</Text>', '>{t("mentorIndex.sortBy")}</Text>'),
        ('>Aucun mentor trouvé</Text>', '>{t("mentorIndex.noMentorFound")}</Text>'),
        ('>Devenir Mentor</Text>', '>{t("mentorIndex.becomeMentor")}</Text>'),
    ],
    # === pro/course/[id].tsx ===
    'app/pro/course/[id].tsx': [
        ('>Video</Text>', '>{t("courseEditor.video")}</Text>'),
        ('>Type de question</Text>', '>{t("courseEditor.questionType")}</Text>'),
        ('>QCM</Text>', '>{t("courseEditor.mcq")}</Text>'),
        ('>Vrai/Faux</Text>', '>{t("courseEditor.trueFalse")}</Text>'),
        ('>Réponse</Text>', '>{t("courseEditor.answerType")}</Text>'),
        ('>Bonne réponse</Text>', '>{t("courseEditor.correctAnswer")}</Text>'),
        ('>Vrai</Text>', '>{t("courseEditor.trueVal")}</Text>'),
        ('>Faux</Text>', '>{t("courseEditor.falseVal")}</Text>'),
        ('>Réponse correcte (ou mots-clés)</Text>', '>{t("courseEditor.correctAnswerKeywords")}</Text>'),
        ('>Mots-clés acceptés (optionnel)</Text>', '>{t("courseEditor.acceptedKeywords")}</Text>'),
    ],
    # === pro/offers.tsx ===
    'app/pro/offers.tsx': [
        ('>Chargement...</Text>', '>{t("offers.loading")}</Text>'),
        ('>Mes Offres</Text>', '>{t("offers.title")}</Text>'),
        ('>Revenus totaux</Text>', '>{t("offers.totalRevenue")}</Text>'),
        ('>Ventes</Text>', '>{t("offers.sales")}</Text>'),
        ('>Contenus</Text>', '>{t("offers.contents")}</Text>'),
        ('>Aucune offre</Text>', '>{t("offers.noOffers")}</Text>'),
        ('>Prix ($) *</Text>', '>{t("offers.priceRequired")}</Text>'),
    ],
    # === pro/content-library.tsx ===
    'app/pro/content-library.tsx': [
        ('>Chargement...</Text>', '>{t("contentLibrary.loading")}</Text>'),
        ('>Premium</Text>', '>{t("contentLibrary.premium")}</Text>'),
    ],
    # === courses/index.tsx ===
    'app/courses/index.tsx': [
        ('>Catalogue des cours</Text>', '>{t("coursesList.title")}</Text>'),
        ('placeholder="Rechercher un cours..."', 'placeholder={t("coursesList.searchPlaceholder")}'),
        ('>Chargement des cours...</Text>', '>{t("coursesList.loading")}</Text>'),
    ],
    # === courses/[id]/index.tsx ===
    'app/courses/[id]/index.tsx': [
        ('>Chargement du cours...</Text>', '>{t("courseDetail.loading")}</Text>'),
        ('>Retour</Text>', '>{t("common.back")}</Text>'),
        ('>Contenu du cours</Text>', '>{t("courseDetail.courseContent")}</Text>'),
        ('>Quiz</Text>', '>{t("courseDetail.quiz")}</Text>'),
        ('>Prix</Text>', '>{t("courseDetail.price")}</Text>'),
    ],
    # === courses/[id]/learn.tsx ===
    'app/courses/[id]/learn.tsx': [
        ('>Quiz</Text>', '>{t("courseLearn.quizLabel")}</Text>'),
        ('>Envoyer</Text>', '>{t("courseLearn.send")}</Text>'),
        ('>Chargement du cours...</Text>', '>{t("courseLearn.loadingCourse")}</Text>'),
    ],
    # === (tabs)/index.tsx ===
    'app/(tabs)/index.tsx': [
        ('>Créer un post</Text>', '>{t("home.createPost")}</Text>'),
        ('>Partager</Text>', '>{t("common.share")}</Text>'),
    ],
    # === (tabs)/learn.tsx ===
    'app/(tabs)/learn.tsx': [
        ('>Leçons</Text>', '>{t("learn.lessons")}</Text>'),
        ('>Passer le Quiz Final</Text>', '>{t("learn.takeFinalQuiz")}</Text>'),
        ('>Leçon</Text>', '>{t("learn.lesson")}</Text>'),
        ('>Quiz Final</Text>', '>{t("learn.finalQuiz")}</Text>'),
    ],
    # === (tabs)/news.tsx ===
    'app/(tabs)/news.tsx': [
        (">Charger plus d'articles</Text>", '>{t("news.loadMore")}</Text>'),
        ('>Partager</Text>', '>{t("common.share")}</Text>'),
    ],
    # === (tabs)/community.tsx ===
    'app/(tabs)/community.tsx': [
        ('>Supprimer</Text>', '>{t("common.delete")}</Text>'),
        ('>Annuler</Text>', '>{t("common.cancel")}</Text>'),
    ],
    # === (tabs)/ai.tsx ===
    'app/(tabs)/ai.tsx': [
        ('>Communauté VIP</Text>', '>{t("vipPromo.communityVIP")}</Text>'),
    ],
    # === (tabs)/profile.tsx ===
    'app/(tabs)/profile.tsx': [
        ('>Débloquez toutes les fonctionnalités</Text>', '>{t("profile.unlockFeatures")}</Text>'),
        ('>Paramètres</Text>', '>{t("profile.settingsTitle")}</Text>'),
    ],
    # === settings/index.tsx ===
    'app/settings/index.tsx': [
        ('>Modifier le mot de passe</Text>', '>{t("settings.changePassword")}</Text>'),
        ('>© 2026 CryptonAI. Tous droits réservés.</Text>', '>{t("settings.copyright")}</Text>'),
    ],
    # === messages.tsx ===
    'app/messages.tsx': [
        ('>Voir le profil</Text>', '>{t("messages.viewProfile")}</Text>'),
    ],
    # === marketplace/index.tsx ===
    'app/marketplace/index.tsx': [
        ('>Premium</Text>', '>{t("marketplace.premium")}</Text>'),
    ],
}

BASE = '/app/frontend/'

for filepath, replacements in REPLACEMENTS.items():
    full_path = BASE + filepath
    try:
        with open(full_path, 'r') as f:
            content = f.read()
        
        changes = 0
        for old, new in replacements:
            if old in content:
                content = content.replace(old, new, 1)  # Replace first occurrence only
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
