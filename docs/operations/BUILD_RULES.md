# RÈGLES DE FABRICATION — comment on construit et fait vivre un site

**Reviewed against commit:** `b176e8b` · **Reviewed:** 2026-09-13 · **Status:** CURRENT

**Ce que ce document est.** La distillation de
`iptv-network/docs/PLAYBOOK.md`, 225 Ko et 1 252 lignes. Ce fichier-là est le
manuel de fabrication du réseau : chaque fois que le propriétaire a fait un
choix ou corrigé un agent, la règle réutilisable en a été extraite. Ce qui suit
garde les règles qui changent une décision concrète.

**La distinction qui gouverne tout ce document.** Chaque règle porte une
marque :

- **`[PROPRIÉTAIRE]`** — le manuel attribue explicitement le choix à Benda : il
  l'a dit, il a corrigé, il a approuvé. Ces règles sont **citables**, au même
  titre que celles de `CLAUDE.md`. Elles ne sont pas encore inscrites dans
  `DECISIONS.md` : les y porter demande qu'il les relise et les reconnaisse, ce
  qui est l'objet de `IPTV-T-006`.
- **`[AGENT]`** — règle d'ingénierie déduite, sans attribution. Même statut que
  `docs/operations/HARD_LESSONS.md` : une observation, jamais une décision.

En cas de doute, la marque est `[AGENT]`. Une règle d'agent ne s'oppose jamais à
une instruction du propriétaire.

---

## 1. Identité et design

**1.** `[AGENT]` Une langue par site, jamais deux ; et **aucun maillage entre nos
sites**.
Un lien inter-sites ou une langue partagée signe le réseau — c'est la seule
empreinte que Google n'a pas à deviner.

**2.** `[PROPRIÉTAIRE]` Barre de qualité = le look cieloflux v2 : noir profond,
héros plein cadre d'au moins 92 % de la hauteur d'écran, **un seul** accent vif,
typographie display généreuse, animation en GSAP ScrollTrigger. **Réutiliser la
structure, jamais la peau.**
Un rendu plat mais correct et une passe claire ont tous deux été rejetés :
« correct mais plat » est jugé laid. Remplace Framer Motion comme moteur
d'animation.
2026-06-22

**3.** `[AGENT]` Alterner les températures : jamais plus de deux sites sombres
consécutifs, environ moitié-moitié ; un énième site de même température change
de famille de teinte **et** de luminosité de fond.
Décide la température du site suivant avant même son brief ; six sites sombres
étaient tous des quasi-noirs.
2026-06-20

**4.** `[AGENT]` Isolation stricte : aucun import d'interface entre dossiers de
design, feuille globale entièrement portée par `.<slug>-root`, jetons de thème
préfixés par site.
Le routeur empaquette le CSS de TOUS les designs — un jeton de couleur partagé
fait gagner la dernière définition et propage la mauvaise valeur, et le contrôle
d'isolation ne détecte pas ce cas.

**5.** `[AGENT]` Aucun code couleur hexadécimal dans la feuille globale,
commentaires compris : nommer le site avec lequel on contraste, jamais sa
couleur.
Le calcul de signature de palette lit le texte brut — piège tombé deux fois,
fausse collision.
2026-06-20

**6.** `[AGENT]` Empreinte disjointe sur chaque axe mesuré : nombre de chaînes,
films et séries, bases tarifaires, marque, polices, ordre des sections, titres
et H1. Les libellés de qualité et la liste d'appareils sont partageables ; les
H1 légaux obligatoires sont exemptés.
Un axe non discriminant compté comme collision fait rejeter des sites
conformes ; un axe oublié effondre l'empreinte.

**7.** `[AGENT]` L'imagerie doit porter la **marque**, pas la niche : si le
prompt fonctionnerait tel quel pour un concurrent du même secteur, il manque le
motif propre au nom.
Un « salon premium » générique est lu par le propriétaire comme un défaut de
design, pas comme un manque de finition.
2026-07-11

**8.** `[AGENT]` Enregistrer tout nouveau dossier de design en **cinq endroits** :
le registre, la table des hôtes, le routeur, la bibliothèque de statistiques, et
le contrôle d'isolation.
Sans entrée dans les statistiques, le site affiche des chiffres de repli ;
absent du contrôle d'isolation, il n'est jamais validé et le contrôle passe
quand même au vert.
2026-06-30

## 2. Mots-clés et titres

**9.** `[PROPRIÉTAIRE]` Le titre et la méta description **commencent** par le
mot-clé de la page, qui figure aussi mot pour mot dans le premier paragraphe du
corps — celui du composant héros.
Le mot-clé dans le seul titre est un échec. Règle étendue à tout le réseau, pas
aux seuls nouveaux sites.
2026-06-30

**10.** `[PROPRIÉTAIRE]` Ordonner les métas : mot-clé d'abord, puis un ou deux
atouts dont une vraie longue traîne, **accroche en dernier**. Titre à 60
caractères au plus, description à 160, mesurés par code, accroche variée par
site.
L'accroche est le dernier élément lu avant le clic et ne doit jamais tomber dans
la troncature.
2026-07-03

**11.** `[PROPRIÉTAIRE]` Chaque article vise **un** mot-clé à faible
concurrence : en tête du titre, en tête de la méta, dans la première phrase,
repris cinq à six fois naturellement.
Jamais la tête contestée qu'un site frère possède déjà.
2026-06-29

**12.** `[AGENT]` Mesurer la page de résultats avant de choisir une cible : 0 à 2
géants dans le top 10 = prenable, 3 à 4 = jouable, 7 et plus = ne pas y dépenser
une page. Deux leviers ouvrent une page fermée : **changer de pays** et
**qualifier la requête**.
Un site appliquait la règle du mot-clé en tête parfaitement, sur une requête
tenue par deux géants : techniquement irréprochable et invisible.

**13.** `[AGENT]` Un mot-clé n'appartient qu'à un seul site : l'anti-
cannibalisation filtre **tous** les rôles revendiqués, pas seulement les
primaires, et les variantes proches comptent comme collisions.
Même page de résultats = une seule de nos pages survit ; donner la même tête de
niche à deux sites frères affame tous ceux qui passent après le premier.

**14.** `[AGENT]` Attribuer la cible au site qui obtient **déjà** des impressions
dessus, et nettoyer les lignes orphelines qui bloquent silencieusement toute
réattribution.
Un mot-clé était attribué à un site pendant qu'un autre y faisait 117
impressions.
2026-08-20

**15.** `[AGENT]` Quand un site frère tient la tête générique, prendre comme
primaire la marque en **forme collée** et laisser la tête espacée à celui qui la
détient.
Un jeton de marque est navigationnel, classe trivialement, et passe
l'anti-cannibalisation.

**16.** `[AGENT]` L'angle éditorial est une couche de **message**, pas un
cluster : vérifier que son vocabulaire a du volume réel avant de le revendiquer.
Un angle rendait « rien trouvé » sur tous ses termes, alors que les acheteurs du
marché visé cherchaient autre chose.

**17.** `[AGENT]` Sources de cibles par ordre de coût : **Search Console
d'abord** (demande prouvée, gratuite), puis Google Suggest (sans clé ni quota),
et seulement ensuite la mesure de concurrence payante, sur les meilleurs
candidats.
L'élargissement est gratuit ; on ne paie que la mesure.
2026-09-08

**18.** `[AGENT]` Toujours enregistrer une cible avec un **rôle** : primaire pour
une page de vente, secondaire pour un article.
821 mots-clés sur environ 1 000 n'avaient aucun rôle — l'autopilote ne les voit
pas et le site écrit à l'aveugle.

**19.** `[PROPRIÉTAIRE]` **Aucune année passée dans le texte visible** : titres,
méta-titres, H1 et H2, corps, FAQ. Exceptions : slugs déjà indexés, vraies dates
de publication, identifiants de code.
Un extrait daté dans les résultats est d'abord un retard de cache — lire le
titre en ligne avant d'éditer quoi que ce soit.
2026-06-21

## 3. Contenu et rythme de publication

**20.** `[AGENT]` **Publier davantage n'améliore rien** : mêmes cadences,
meilleures cibles.
Corrélation entre nombre d'articles et position : **−0,04**, mesurée sur les 78
sites.

**21.** `[AGENT]` Avant d'écrire, grepper le fichier d'articles du site avec les
deux styles de guillemets, sur chaque point du plan et chaque famille de
synonymes de l'angle — pas seulement sur le mot-clé.
Un grep mono-style a sous-compté un site de 75 % : 3 articles vus sur 42.
2026-07-30 · 2026-09-13

**22.** `[AGENT]` Seuil d'arrêt : **deux sections du plan déjà couvertes**
ailleurs sur le même site suffisent à s'arrêter et à remonter la correspondance,
au lieu d'écrire une version « plus différenciée ».
Trois articles publiés en huit jours couvraient déjà les sept points d'un plan —
le défaut est le générateur de propositions, pas l'article.
2026-09-08

**23.** `[AGENT]` Une proposition approuvée approuve **l'angle, jamais les
chiffres** : vérifier chaque montant, date et référence légale sur une source
primaire, et exiger deux sources indépendantes pour un fait concernant un tiers.
Un chiffre proche du vrai survit au contrôle de plausibilité et serait parti en
production.
2026-07-30

**24.** `[AGENT]` Rejet automatique de toute proposition dont le différenciateur
est « nous montrons les vrais prix ».
Le prix vient de la base au rendu : l'étape qui rédige la proposition ne peut
pas le connaître, elle l'a donc inventé par construction.
2026-09-13

**25.** `[AGENT]` Re-vérifier sur le web l'état réel d'un événement sportif au
moment d'écrire, et re-marquer l'article à chaque changement de phase.
Quatre clubs annoncés « qualifiés » étaient éliminés depuis huit jours,
affirmation répétée dans deux articles publiés.
2026-09-08

**26.** `[AGENT]` Corriger un fait faux sur une page déjà indexée = **édition
chirurgicale** des paragraphes concernés dans leurs marqueurs, jamais un
re-slug.
Le re-slug est réservé aux pages bloquées à l'indexation et aux DMCA ;
l'appliquer ici jette de l'historique pour une faute de contenu.

**27.** `[AGENT]` Mesurer la similarité par l'union, après retrait des mots du
thème, avec deux conditions : au moins trois mots réellement partagés **et** au
moins 50 %.
Diviser par le plus petit ensemble a bloqué 100 articles sur 106.
2026-08-20

**28.** `[AGENT]` Le corpus anti-doublon se construit en listant le dossier des
designs, et reçoit le site d'origine : même site = cannibalisation, bloquant ;
autre site = empreinte de réseau, signalée mais non bloquante.
Trois designs codés en dur signifiaient qu'un site ne se comparait jamais à
lui-même — 187 paires quasi identiques sur 52 sites, garde-fou actif deux mois
sans rien voir.

**29.** `[AGENT]` Toute contrainte de format annoncée dans un prompt doit avoir
son contrôle en code ; et **un défaut cosmétique se corrige, il ne rejette pas**.
72 descriptions dépassaient 160 caractères sans qu'aucun contrôle n'existe, et
un article recalé pour cinq caractères restait bloqué en brouillon alors que
Google tronque tout seul.

**30.** `[AGENT]` La porte qualité automatique est le seul filtre avant
publication — 1 200 mots au moins, exactement deux appels à l'action visant des
cibles différentes, unicité, liens internes, données structurées — et
l'opérateur corrige **après** publication.
Remplace le circuit brouillon → approbation manuelle → publication du
2026-06-16.

**31.** `[AGENT]` Publier sur un site migré = **trois fichiers** ; vérifier par un
mot du corps et le canonique, jamais par un code 200.
Le filet de sécurité renvoie un slug inconnu vers l'accueil : la page répond 200
avec zéro contenu d'article, sans aucun 404.
2026-06-29

**32.** `[AGENT]` Couvertures d'articles générées par le cron de 06:40 ; ne jamais
payer le générateur cher par défaut.
Remplace la génération systématique coûteuse à la rédaction.
2026-08-03

## 4. Conversion et contact

**33.** `[PROPRIÉTAIRE]` **Ne jamais inventer, deviner ni recopier un numéro
WhatsApp** depuis un brief, une file d'attente ou une documentation ancienne.
Site sans numéro attribué : demander, jamais de valeur d'attente ni d'emprunt.
Un numéro plausible — bon indicatif, bon format — est précisément le piège, et
des numéros bannis ont été redéployés par erreur. La liste des numéros valides
est un instantané ; seule la règle est durable.
2026-08-06

**34.** `[AGENT]` Après tout changement de numéro, faire concorder les **deux
sources** : la constante du code, lue par la fonction d'ouverture de chat, et la
colonne en base, qui **gagne** au runtime.
La grille tarifaire et les boutons ne lisent pas la même source.

**35.** `[AGENT]` Le mode d'appel à l'action — widget ou WhatsApp — vit chez
DaoudChat, **pas dans ce dépôt** : ne jamais le forcer en dur dans un design,
vérifier par le point d'entrée public que le site interroge.
La bascule prend effet au chargement suivant, sans reconstruction ; un forçage
en dur désynchronise le site du tableau de bord pour de bon.

**36.** `[AGENT]` Adresse de contact par routage courriel sur un domaine **neuf
uniquement** ; sur un domaine migré, ne jamais toucher aux enregistrements de
messagerie.
Le routage ajoute ses propres enregistrements et casse silencieusement les
boîtes en service d'une boutique reprise.

## 5. Domaines et indexation

**37.** `[PROPRIÉTAIRE]` L'achat de domaine est une **porte** : proposer cinq
candidats vérifiés et attendre que le propriétaire achète. La mise en ligne est
une seconde porte.

**38.** `[AGENT]` Réutiliser un domaine déjà possédé, jamais racheter, et
consigner immédiatement toute acquisition manuelle. Nommage : évocateur avec
indice de mot-clé, `.com` d'abord, prononçable, sans tiret pour les achats
neufs, sans année. Les extensions nationales à condition de résidence sont
exclues.
Un domaine acquis à la main est invisible à l'étape suivante, qui régénère des
candidats et double-achète.

**39.** `[AGENT]` Migration d'un site **vivant** : l'étape d'identité ne touche
aucun DNS. La bascule est exactement trois modifications, valeurs de retour
arrière enregistrées, **un site canari** entièrement vérifié avant les suivants.
Laisser l'enregistrement IPv6 en place = la moitié du trafic reste sur
l'ancienne origine ; juste après la bascule, un 200 peut être l'ancien site en
cache.

**40.** `[PROPRIÉTAIRE]` **Espacer de deux à trois minutes** toute action
automatisée répétée sur plusieurs sites — soumission de plan de site,
signalement, demande d'indexation. Jamais en parallèle.
Une machine qui touche tous nos sites à la même seconde signe le réseau comme
automatisé.
2026-06-21

**41.** `[PROPRIÉTAIRE]` La seule façon de pousser une exploration Google depuis
le code est l'API Indexing, quota de 200 URL par jour et par projet, déployée
**site par site**, jamais réseau entier.
Le bouton du panneau Search Console n'a pas d'API, et le protocole concurrent ne
nourrit que d'autres moteurs.
2026-06-21

**42.** `[PROPRIÉTAIRE]` Vieux domaine avec page confirmée non indexée : nouveau
slug riche en mots-clés, redirection permanente, **puis** poussée à l'API
Indexing — **sans demander l'autorisation**. Les pages légales obligatoires
restent en 200.
Pré-autorisé parce que la non-indexation vient de Google ; un re-slug sans
resoumission est un travail inachevé, et chaque page bloquée mérite sa propre
URL, pas une redirection vers l'accueil.
2026-06-21

**43.** `[PROPRIÉTAIRE]` Sites **neufs** : poussée d'indexation seule, jamais de
re-slug ni de redirection. « URL inconnue de Google » sur un domaine neuf est
normal, pas un déclencheur.
Remplace l'application de la règle précédente aux domaines récents.
2026-06-22

**44.** `[PROPRIÉTAIRE]` **Ne jamais re-sluguer une page indexée.** Deux
exceptions datées : une URL visée par une notification DMCA, et un ordre
explicite du propriétaire.
Changer le slug d'une page qui classe jette son entrée d'index et son historique
pour zéro gain.

**45.** `[PROPRIÉTAIRE]` DMCA = **action autonome immédiate** : re-slug,
redirection, build, déploiement, poussée d'indexation, rapport après. Jamais de
contre-notification.
La suppression est un filtre de résultats invisible à l'inspection d'URL, et une
contre-notification exige une déclaration sous serment qui révèle l'identité
réelle du propriétaire.
2026-06-26

**46.** `[AGENT]` « Est-ce indexé ? » se lit uniquement par l'inspection d'URL,
jamais par un opérateur de recherche ; chaque appel passe par la clé du compte
du site, et il faut vérifier la **forme** de la propriété avant de conclure à
une panne de droits. Vérification d'un nouveau site par **balise méta**, jamais
par fichier à la racine.
Un opérateur de recherche masque les pages indexées sur un domaine jeune ; une
clé partagée renvoie 403 sur les autres comptes ; le routeur multi-tenant
intercepte les fichiers statiques à la racine.

## 6. Prix et produits

**47.** `[AGENT]` Formule tarifaire universelle : quatre durées par un à trois
écrans, remise de 10 % par écran supplémentaire, arrondi à l'entier. Les bases
par palier sont **globalement uniques sur tout le réseau**, toutes devises
confondues.
La base tarifaire est un axe d'empreinte au même titre que la palette — une
devise distincte en est un très durable.

**48.** `[AGENT]` Avant toute modification de prix, chercher la fonction de
lecture runtime dans le design : **la surcharge en base gagne sur le code**, et
une surcharge dont les identifiants de plan ne correspondent pas est totalement
inerte.
Dix sites portaient une surcharge que le code n'a jamais trouvée ; l'édition du
code semble réussir — build vert, déploiement correct — sans que le prix affiché
bouge, ce qui se diagnostique à tort comme un problème de cache.
2026-07-15

**49.** `[PROPRIÉTAIRE]` Après toute modification de prix, lancer le script de
synchronisation ; **ne jamais éditer à la main** le fichier de référence des
prix.
Ce fichier est lu directement par le propriétaire hors panneau, et il dérivait :
55 sites sur 63, plusieurs manquants.
2026-07-14

**50.** `[AGENT]` **Champs verrouillés** — marque, domaine, WhatsApp, prix,
contact, entité légale, statistiques de catalogue : un agent ne les écrit
jamais, il **propose**. Le verrou vaut aussi pour un site en construction.
Une collision d'empreinte sur un champ verrouillé se résout par une valeur
suggérée, pas par une écriture.

**51.** `[PROPRIÉTAIRE]` **Jamais de description produit générée** : contenu réel
filtré, ou rien. Une description vide est acceptable. Titre court et porteur du
mot-clé, composé pour que le mot-clé ne soit jamais tronqué.
2026-07-02

**52.** `[AGENT]` **Ne jamais inventer d'avis, de note ni de garantie** : sans
témoignage réel sur la source, supprimer la section et omettre la note agrégée.
La garantie d'une migration se recopie mot pour mot, jamais uniformisée entre
sites frères.
Une note de repli existe déjà pour l'éligibilité aux données structurées, donc
rien ne justifie de fabriquer ; sept jours chez l'un et un mois chez l'autre
sont des faits commerciaux liés à leurs clients existants.

## 7. Exploitation quotidienne

**53.** `[AGENT]` **`git push` ne déploie que Vercel.** Les workers Cloudflare
attendent leur cron toutes les deux heures, le VPS le sien. Lire l'hébergement
du site **avant** de promettre une mise en ligne.
Un correctif « réseau entier » reste périmé sur une vingtaine de sites, sans
aucune erreur ni avertissement.

**54.** `[PROPRIÉTAIRE]` Sur la machine du propriétaire, **jamais de `git
push`** ; sur l'hôte autopilote, le push est autorisé avec rapport exact —
branche, identifiants de commit, fichiers — sauf changement large ou risqué.
Remplace le « ne jamais pousser » du manuel par la règle par hôte de
`CLAUDE.md`. Voir `IPTV-D-006`.

**55.** `[AGENT]` Vérifier sur la **page servie**, puis par une capture d'écran
regardée, jamais dans le code. Un article n'existe que commité, poussé **et**
déployé, et la surveillance doit couvrir les fichiers jamais commités.
Trois défauts réels — CSS en erreur, héros invisible, images absentes — ont
passé tous les contrôles automatiques ; un conflit git non résolu a fait
disparaître 60 articles pendant 21 h sans une seule alerte.
2026-08-07 · 2026-09-02

**56.** `[AGENT]` Deux builds ne partagent jamais un dossier de compilation.
Le build Cloudflare écrase le dossier que sert le VPS : le build « réussit », le
typage passe, la page répond 200, et seule une capture montre la page nue.
2026-08-07

**57.** `[AGENT]` **Grouper les alertes** : au-delà d'environ cinq occurrences
par jour, journal plus récapitulatif du soir. L'envoi immédiat est réservé au
rare qui exige une action humaine dans l'heure — DMCA, site hors ligne, quota
épuisé.
Deux inondations en trois semaines, dont 106 courriels en quelques jours. Une
alerte qu'on cesse de lire donne l'illusion d'une surveillance.
2026-08-20

**58.** `[AGENT]` Valider tout audit de masse sur **un cas ouvert à la main**
avant de le rapporter.
Un audit a produit cinq faux positifs massifs, jusqu'à 77 sites sur 78 : mauvais
champ mesuré, motif borné, libellé traduit deviné. Un audit qui crie faux masque
les vrais défauts.
2026-08-16
