# LEÇONS PAYÉES — ce que le réseau a appris en cassant

**Reviewed against commit:** `b176e8b` · **Reviewed:** 2026-09-13 · **Status:** CURRENT

**Ce que ce document est.** La distillation de `iptv-network/docs/SOLUTIONS.md`,
299 Ko et 2 562 lignes de problèmes rencontrés en production entre juin et
septembre 2026. Chaque entrée d'origine porte un symptôme, une cause racine, une
correction et une leçon. Ce qui suit ne garde que les leçons, et seulement celles
dont l'oubli coûterait à nouveau quelque chose.

**Ce que ce document n'est pas.** Ce ne sont **pas des décisions du
propriétaire**. Ce sont des observations écrites par des agents après coup :
« ceci s'est produit, voilà ce qui l'évite ». Aucune n'a été soumise à
approbation. Elles ne peuvent donc pas être opposées à une instruction du
propriétaire — voir `DECISIONS.md`, qui seul porte ce qu'il a décidé.

**Comment lire une entrée.** La première ligne est la règle. La deuxième est
**ce que sa violation a coûté**, avec le chiffre mesuré quand il existe : c'est
la partie qui donne à la règle son poids. La troisième est la date.

**Pourquoi le coût figure.** Une règle sans son prix se discute. Une règle qui
dit « 230 commits d'articles détruits » ne se discute pas, elle se respecte.

---

## 1. Git et production de contenu

**1.** Commiter en nommant les chemins (`git commit -- <fichiers>`) et lire
`git diff --cached --stat` avant : l'index est partagé avec l'autopilote, et un
seul chemin non fusionné bloque tout commit sans pathspec.
Un commit « docs » a emporté 218 fichiers dont une suppression ; un
`JOURNAL.md` en conflit a bloqué 60 articles pendant 21 h, en silence.
2026-09-01 · 2026-09-02

**2.** Ne jamais `git worktree add -f <branche>` : utiliser `--detach`, et
contrôler `git worktree list | grep -c '\[main\]'` = 1.
Un `reset --hard` toutes les 2 h dans l'arbre de build Cloudflare a détruit
**230 commits d'articles** en trois jours.
2026-08-13

**3.** Dans les crons : `git fetch` + `git merge --no-edit`, jamais
`pull --rebase --autostash` — un pop en conflit laisse un chemin non fusionné et
le script sort quand même en 0. Grepper tous les `cron-*.sh` dès qu'un cas est
trouvé.
Données Semrush muettes 30 jours ; le même motif dormait dans 5 crons, deux
découverts seulement par le grep.
2026-09-03

**4.** Fusionner `articles.ts` en greffant les blocs `// @auto:<slug>` …
`// @end:<slug>`, jamais ligne à ligne ; le seul contrôle valable est
`git diff <fusion> <origin> -- '*.ts' | grep '^+'` vide.
Résolution ligne à ligne = TypeScript cassé sur 30 cherry-picks sur 43 ; un
contrôle par slug a laissé disparaître 3 articles (213 lignes) écrits sans
marqueurs par le cron vidéo.
2026-08-13 · 2026-08-22

**5.** Dans un clone éphémère : `git fetch origin <branche>` avant tout
diagnostic de divergence, `git merge-base --is-ancestor` pour trancher,
`git rev-parse --is-shallow-repository` puis `--unshallow` avant toute mesure
`git log --since`.
Fausse alerte de divergence ; un `checkout -B` a orphelin 3 commits ; le
garde-fou de vélocité comptait 49 commits/30 j au lieu de 817, puis « 0 site »
au lieu de 78.
2026-08-03 · 2026-08-13 · 2026-08-27

**6.** Tester le CONTENU de stdout de `claude -p`, jamais son code de sortie : il
rend 0 quand le quota est épuisé, et il existe DEUX quotas, session et
hebdomadaire.
Deux jours de sites comptés en « research failed » sans qu'aucun modèle n'ait
tourné ; une file de 34 sites aurait été brûlée en quelques minutes.
2026-08-06 · 2026-08-13

**7.** Compter les articles par le champ `date` des articles, jamais par date de
commit.
Le comptage par commit annonçait 15 et 13 par jour et masquait la chute réelle
de 63 à 46 puis 26, les articles récupérés portant une autre date de commit.
2026-08-13

**8.** Surveiller séparément les quatre états : écrit sur disque, commité,
poussé, servi — un compteur « commités non poussés » ne voit pas « jamais
commités ».
223 articles bloqués dans l'index, invisibles ; 60 autres bloqués 21 h pendant
que le bilan de santé annonçait « rien à signaler ».
2026-08-20 · 2026-09-02

**9.** Agents parallèles sur un arbre partagé : chaque agent commite avec
pathspec explicite, et toute contrainte « au plus un » se tranche AVANT la
rédaction des briefs.
Un commit a ratissé les fichiers d'un agent frère ; la consigne de backlink
copiée dans 2 briefs sur 3 a posé 2 liens là où 1 était autorisé.
2026-07-30 · 2026-08-04

**10.** Toute écriture programmatique dans un fichier source doit être validée
par `tsc` dans le MÊME passage.
Une virgule manquante insérée par `appendArticle()` a rendu le build impossible
pour les 78 sites à la fois.
2026-08-06

## 2. Déploiement et hébergement

**11.** Ne pas remettre de filtre « Ignored Build Step » sur Vercel : sa clone
est trop courte, `HEAD^` n'existe pas, et tout code ≠ 1 vaut « saute le build ».
Toute optimisation pouvant supprimer une mise en ligne se teste dans les deux
sens.
**30 déploiements annulés d'affilée**, plus aucune mise en ligne, de façon
invisible — pour 8 $/mois d'économie visée ; le filtre n'avait été validé que
sur un commit docs sauté, jamais sur un commit de contenu.
2026-08-13

**12.** Deux pipelines ne partagent jamais un répertoire de build. Redémarrer le
service ne répare rien. *(Remplace le correctif « ajouter un `systemctl
restart` ».)*
Quatre pannes en deux jours sur les sites du VPS : pages sans CSS le matin,
erreurs 500 l'après-midi, même cause.
2026-08-06

**13.** Chaque hébergement du parc doit avoir son propre cron de déploiement :
Vercel se déploie au push, Cloudflare et le VPS non.
`.next` du VPS vieux de 14 jours et 59 articles en 404 ; les workers Cloudflare
ne se déployaient jamais seuls.
2026-08-03 · 2026-09-03

**14.** Un marqueur de déploiement n'avance qu'en cas de SUCCÈS et doit couvrir
le même périmètre que le filtre de sélection, sinon il efface des changements de
tous les diffs suivants.
27 fichiers de vérification IndexNow marqués déployés sans l'être,
définitivement sortis du périmètre.
2026-09-03

**15.** Cloudflare plafonne à **25 Mo par fichier** : garder
`optimization.splitChunks.maxSize` et contrôler
`find apps/sites/.open-next/assets -type f -size +20M` après l'ajout de tout
design.
Un chunk à 29,4 Mo a rendu les workers indéployables — panne invisible tant
qu'on ne cherche pas à publier.
2026-08-07

**16.** Sur une facturation à la minute-CPU, mesurer deux tailles de machine
avant de choisir : `enhanced` (8 cœurs) s'est révélé aussi rapide que `turbo`
(30 cœurs).
94 $ de builds sur une facture de 134 $/mois, dont 22 cœurs payés sans effet
mesurable.
2026-08-13

**17.** Le contrôle final est l'URL réelle en production : statut, **taille de la
page**, feuille de style effectivement servie, contenu attendu — jamais « le
script a fini ».
Pages de 1,6 Ko répondant 200 ; un CSS en 400 qu'un simple contrôle de taille
n'aurait pas vu ; articles présents dans `origin` mais en 404 en ligne.
2026-08-06 · 2026-08-13

**18.** Préfixer toute entrée crontab de `cd <dépôt> &&` — une redirection de log
relative fait échouer le job avant son démarrage. Auditer le crontab ENTIER et
vérifier la première exécution réelle depuis un répertoire neutre.
5 crons morts quatre jours sans le moindre log, diagnostiqués à tort en
« reboot / disque / identifiants » ; 2 autres découverts une semaine plus tard.
2026-08-03 · 2026-08-06

**19.** `tsc --noEmit` propre ne prouve pas qu'un déploiement tient : la
frontière client/serveur de Next échappe au typage. Après toute conversion en
lot, grepper `onClick=` avec la première ligne `'use client'`, puis curler
chaque domaine touché.
4 sites en 500 après une conversion de 63 sites, sur 9 lots d'agents tous
« tsc propre ».
2026-07-23

**20.** Sur un vhost multi-domaines, ne jamais lancer certbot sur un
sous-ensemble : toujours `--cert-name` avec `--expand` et la liste complète.
6 noms de domaine privés de certificat valide, injoignables en HTTPS.
2026-08-06

**21.** En environnement éphémère, lire l'état du relais sortant avant de
conclure à un problème d'authentification ; les jetons Vercel et Cloudflare
expirent indépendamment (replis : push git, clé globale Cloudflare).
`wrangler`, l'API Supabase et Semrush diagnostiqués à tort comme jetons morts,
sessions perdues à changer de clé.
2026-07-04 · 2026-07-30

## 3. Mesure et référencement

**22.** Toute requête Search Console passe par la clé du compte du site ; les
propriétés « préfixe d'URL » exigent le champ `property`, `sc-domain:` leur
étant impossible.
Trois scripts tombés l'un après l'autre en 403 sur les sites récents ; un 403
qui durait depuis la création d'un site.
2026-06-24 · 2026-08-13

**23.** L'indexation se lit à l'API URL Inspection, jamais par `site:` ; un
rapport d'impressions vide ne prouve pas la non-indexation, et un retrait DMCA
reste invisible à l'inspection.
Une alerte de « désindexation générale » sur un site dont l'accueil était
indexé depuis cinq jours.
2026-06-26 · 2026-08-13

**24.** Le titre de la page de vente doit reprendre la requête de marque
EXACTEMENT telle qu'elle est tapée, vérifiée dans Search Console.
Un pluriel de trop dans le titre, le H1, la méta et le JSON-LD a fait classer la
FAQ à la place de la page de vente, **sur le mot-clé qui porte 40 % du trafic du
réseau**.
2026-08-16

**25.** Avant tout re-slug d'une page « non indexée », lire le canonique choisi
par Google : un canonique qui pointe ailleurs est une cause différente, que le
re-slug reproduirait à l'identique.
Un site invisible à cause d'un canonique vers une redirection morte ; le
re-slug prévu n'aurait rien changé.
2026-07-04

**26.** Une coïncidence de date n'est pas une cause : construire un groupe
témoin et mesurer à périmètre constant. Position stable et clics en chute = la
page de résultats a changé, pas le classement.
Une chute réseau de −28 % attribuée au maillage interne, alors que les sites
SANS lien avaient chuté deux fois plus ; le plus gros perdant ne bougeait que de
la position 5,0 à 6,5.
2026-08-06

**27.** Sur notification DMCA : ne pas contre-notifier, re-slugger les seules
pages de valeur, rediriger en 301, puis pousser les nouveaux slugs à l'API
Indexing.
4 courriels en une nuit listant tout un site ; la surveillance des boîtes est le
seul canal d'alerte existant. Une contre-notification exige une déclaration sous
serment qui révèle l'identité réelle du propriétaire.
2026-06-26

**27b.** **Un re-slug seul programme la notification suivante.** Retirer la
marque de la méta et du titre **D'ABORD**, re-sluguer **ENSUITE**. Le re-slug
restaure la visibilité ; il ne retire pas la cause, et la nouvelle URL porte
exactement le contenu qui a déclenché la plainte.
`liste-iptv.srl` a été re-sluguée le 2026-07-12 sur notification. Deux mois plus
tard, le 2026-09-08, la NOUVELLE URL était réclamée à son tour : la méta
annonçait toujours « calcio (Serie A, Champions, DAZN) ». Et ce n'était pas une
page secondaire — c'était la page d'accueil, servie 200 pendant **13 jours**
après l'avis. Mesure sur la page : Serie A 29×, Champions 29×, DAZN 25×.
2026-09-21

**27c.** **Une surveillance bornée à 24 h ne retrouve pas ce qu'elle a manqué.**
`gmail-watch` tourne toutes les 3 h mais n'interroge que le dernier jour : un
avis arrivé pendant une interruption du cron, ou classé par un filtre, n'est plus
jamais revu. Balayer à **365 jours** sur le dossier « tous les messages »
périodiquement, pas seulement quand on soupçonne quelque chose.
19 notifications de droits d'auteur retrouvées en une passe, dont une non
traitée depuis 13 jours ; aucune n'apparaissait dans les passes quotidiennes.
2026-09-21

**28.** Le risque DMCA ne se compte pas en mentions de marque : chercher le motif
**marque-porte-marque** (« notre abonnement inclut X ») et trier par surface —
URL, titre, méta d'abord.
115 occurrences signalées, 3 sites réellement concernés après vérification
manuelle.
2026-09-09

**29.** Le contrôle SEO se mesure sur le HTML SERVI ; `fetch` supprime l'en-tête
`Host`, il faut curl ou un client bas niveau, et tuer tout serveur résiduel
avant la vérification.
Audits entiers menés contre le mauvais site ou contre un serveur périmé : faux
404 et faux succès.
2026-06-18 · 2026-06-19

**30.** **Un 401 ne prouve pas qu'une clé est morte** : faire varier le schéma
d'authentification ET la version du point d'entrée. Ne jamais écraser une clé
stockée par une clé non vérifiée ; distinguer « clé refusée » de « compte à zéro
unité ».
Un accès Semrush valide déclaré mort, sur le point d'être remplacé — ce qui
aurait détruit la seule clé encore reconnue.
2026-09-09

## 4. Contenu et doublons

**31.** Avant d'écrire, grepper le VRAI fichier d'articles du site avec LES DEUX
styles de guillemets ET les brouillons non commités : la liste d'articles
fournie dans le prompt est périmée.
52 blocages sur un site en 14 jours, 13 sur un autre, 187 paires quasi
identiques sur 52 sites ; un garde-fou de déduplication ne lisait que 3 designs
sur 78.
2026-08-06 · 2026-09-12

**32.** Un mot-clé reformulé, un titre réécrit ou un « nouvel angle » ne prouvent
rien : seule la mise en correspondance plan ↔ titres de sections déjà en ligne
détecte le doublon.
20 blocages en une seule journée sur un même site, chacun attrapé à la main,
aucun par la vérification amont.
2026-09-09

**33.** Un mot-clé n'est « couvert » que si un article le reprend, jugé titre par
titre — mais le test littéral ne suffit pas : il tient « anual » et « 12 meses »
pour distincts et requalifie le même sujet indéfiniment.
Un mot-clé vu « 100 % couvert » à tort par comparaison aux titres concaténés ;
à l'inverse, un mot-clé rejugé neuf à chaque passage a produit 52 propositions
en double.
2026-08-16 · 2026-09-09

**34.** Une similarité de titres se normalise par **l'union**, jamais par le plus
petit ensemble, après retrait des mots du thème, avec deux conditions : 3 mots
partagés ET 50 %. Et les alertes se groupent en journal avec récapitulatif,
jamais un courriel par événement.
100 faux blocages sur 106 brouillons et une boîte inondée ; le jour où un vrai
blocage est survenu, il était noyé.
2026-08-20

**35.** « Approuvé » approuve l'angle, pas l'arithmétique ni les faits : vérifier
chaque chiffre, date, lieu et référence juridique à la source avant d'écrire.
Une amende citée à 15 280 € au lieu de 2 582–15 493 € ; deux articles publiés
sur une prémisse fausse (équipes éliminées huit jours plus tôt) ; des dates et
circuits fabriqués.
2026-07-30 · 2026-09-08 · 2026-09-10

**36.** Tout prix cité dans un brief est **inventé par construction** : les prix
vivent en base et dans la configuration du site, invisibles à l'étape rédaction.
Un brief dont le différenciateur est « on montre les vrais prix » se bloque.
12 chiffres d'économie non réconciliés sur un seul site ; un plan « mensuel »
chiffré alors qu'aucun plan mensuel n'existe.
2026-09-08

**37.** Une consolidation de doublons ne tient que si la CAUSE est corrigée : le
générateur qui ne voit que 3 articles sur 16 en reproduira.
Un site reconsolidé, 8 doublons revenus en 4 jours ; Google avait refusé
d'indexer le cluster entier.
2026-08-06

**38.** Sur un site migré, publier = **trois fichiers** : le contenu, la route
statique, la liste blanche du routeur. Un 200 obtenu en suivant les redirections
n'est pas une page atteignable : vérifier le corps et le canonique.
Articles publiés affichant la page d'accueil, sans 404, donc sans signal
d'erreur.
2026-06-29 · 2026-08-03

**39.** Les liens internes doivent être des URL absolues — la fonction de
linkification n'en reconnaît pas d'autres — et les réponses de FAQ ne sont pas
linkifiées du tout.
Liens rendus en texte brut sur des pages publiques, pire qu'une absence de lien.
2026-08-05 · 2026-08-06

**40.** Vérifier guillemets courbes et guillemets allemands après toute édition
du fichier d'articles ; à défaut de `tsc`, extraire le bloc marqué et le passer
à un analyseur JSON.
Builds cassés par une apostrophe typographique promue délimiteur de chaîne ;
6 chaînes allemandes rompues en une seule rédaction.
2026-07-06 · 2026-08-07

## 5. Données et bases

**41.** Toute valeur éditable au panneau se lit **au runtime**, jamais depuis une
constante de build ; et grepper les nombres codés en dur dans les pages avant de
fixer une valeur par défaut.
Les modifications du panneau n'apparaissaient qu'après reconstruction ; les
appels à l'action restaient sur l'ancien numéro partout sauf dans la table de
prix.
2026-06-15

**42.** Un `catch` vide sur un appel réseau transforme une panne en verdict :
compter et afficher les échecs séparément des résultats.
« 0 défaut sur 65 sites » alors que les 65 requêtes étaient bloquées ; 24
mesures échouées classées « requête perdue d'avance ».
2026-07-29 · 2026-08-30

**43.** Ne jamais additionner « refusé pour une raison normale » et « refusé pour
une erreur ».
125 insertions rejetées par un type de colonne comptées comme « mots-clés déjà
pris par un autre site ».
2026-08-30

**44.** Quand deux outils se parlent par une colonne, vérifier l'écrivain ET le
lecteur ensemble ; deux filtres complémentaires doivent couvrir tout
l'intervalle, bornes écrites côte à côte.
Des semaines de rôles écrits et jamais lus ; les mots-clés en position 21-99
n'appartenaient à aucun des deux filtres.
2026-08-30

**45.** Un mode simulation doit court-circuiter ce qui **coûte**, pas seulement
ce qui écrit ; et Supabase plafonne un `select` à 1 000 lignes, il faut paginer.
Mesures payantes déclenchées en simulation ; index d'attributions tronqué sans
aucune erreur.
2026-08-30

**46.** Ne jamais laisser la moitié du parc derrière un seul canal de
conversion ; la base gagne au runtime, le code exige un déploiement, donc
corriger la base d'abord.
Un bannissement a coupé **39 sites sur 78** ; la correction en a concentré 75
sur un unique numéro.
2026-08-08

## 6. Sécurité et secrets

**47.** Un secret transcrit à la main se vérifie **par empreinte** contre la
source, jamais par un simple chargement JSON, et une clé privée par une
vérification de structure.
9 sites muets sur une clé corrompue d'un caractère et pourtant valide en JSON ;
corruption répétée deux fois sur le même fichier, puis 3 secrets corrompus en
une seule passe.
2026-08-10 · 2026-09-06

**48.** Quand une empreinte échoue, **bissecter** — moitiés, quarts, puis
morceaux d'environ 200 caractères avec leur propre empreinte — au lieu de
retranscrire tout le bloc.
La retranscription complète reproduisait la même erreur à l'identique ; la
bissection localise en 4-5 essais au lieu de 16.
2026-09-07 · 2026-09-08

**49.** Ne pas retranscrire à la main un JSON imbriqué ; l'encodage base64 ne
sert que pour les secrets structurés, les secrets plats se relisent en clair.
*(Remplace la consigne « ne plus jamais utiliser le base64 ».)*
Des séquences d'échappement tapées littéralement ont invalidé les 7 clés de
service en une passe.
2026-08-28 · 2026-09-06

**50.** Une action qui **dépense de l'argent** ne doit jamais être à un clic
d'une liste : confirmation saisie au clavier, garde d'idempotence, et
inscription des actifs déjà possédés là où l'agent les lit.
Un achat de domaine en double était atteignable par un seul clic, l'actif déjà
acquis n'étant visible que chez le registrar.
2026-06-17

**51.** Mettre les valeurs métier dans le brief INITIAL, ou attendre la fin du
sous-agent : modifier les fichiers d'un agent en cours déclenche un retour
arrière défensif.
Une session entière passée à révoquer puis ré-appliquer une grille tarifaire.
2026-07-18

## 7. Méthode de vérification

**52.** Vérifier **un cas à la main** avant de rapporter une mesure de masse ; un
chiffre bas et plausible accuse l'instrument avant la réalité.
5 faux positifs massifs dans un seul audit (77, 52, 19, 7 et 6 sites), dont un
analyseur borné à 3 000 caractères qui n'extrayait aucun article et concluait
« zéro doublon ».
2026-08-16 · 2026-08-27

**53.** Un « succès » ou un code de sortie 0 ne prouve rien : mesurer le
RÉSULTAT, par un contrôle **indépendant** de la tâche qui échoue.
Un ordonnanceur affichait 72 exécutions en succès par jour pendant deux pannes
simultanées ; une erreur écrite dans une sortie que personne ne lit est aussi
muette qu'un `catch` vide.
2026-08-13 · 2026-09-02

**54.** Une alarme jamais déclenchée en test ne prouve rien : abaisser le seuil
et la voir sonner.
Deux pannes d'hébergement ont couru sans détection, faute d'une sonde qui les
couvrait et qu'on aurait vue se déclencher.
2026-08-13

**55.** Un contrôle qui n'inspecte que ce que la transformation a su reconnaître
ne prouve rien : comparer les deux états ENTIERS. Après résolution d'un conflit
sur un fichier append-only, **l'écart de lignes doit valoir exactement le nombre
de marqueurs retirés**.
Un contrôle par slug a validé sa propre cécité : 3 articles, 213 lignes, perdus
malgré un vert complet.
2026-08-22 · 2026-09-10

**56.** Une affirmation de brief — « domaine vierge », « site parqué », « déjà
corrigé » — se vérifie avant d'agir : DNS, MX, HTML servi, Search Console.
Un domaine décrit comme vierge hébergeait un site tiers en production avec
messagerie active ; le câblage prévu l'aurait éteint.
2026-06-21

**57.** Après une bascule DNS, valider la **signature du contenu** — langue,
marque dans le titre — pas un 200 : un enregistrement précédemment proxifié sert
l'ancien site une à trois minutes.
Un vérificateur acceptant le premier 200 déclarait la bascule réussie alors que
l'ancien site était encore servi.
2026-06-20

**58.** Vérifier que les dépendances sont installées avant de lire un mur
d'erreurs `tsc` comme une régression.
Des centaines d'erreurs sur des fichiers jamais touchés, diagnostiquées comme
une panne généralisée du dépôt.
2026-07-31 · 2026-09-09

**59.** Un diagnostic établi depuis un dépôt **sans accès à l'hôte qui exécute**
reste provisoire : attendre la disparition du SYMPTÔME, et lire aussi le script
utile, pas seulement son enveloppe git.
Semrush déclaré réparé, puis 32 jours de silence supplémentaires ; la vraie
cause était dans un script jamais lu.
2026-09-04 · 2026-09-05

**60.** Diffuser contre la dernière liste **vérifiée**, pas contre une référence
trouvée en contexte ; et faire passer la barrière de tests sur l'état vierge
avant toute modification.
8 URL déjà connues repoussées à l'API Indexing, quota gaspillé jusqu'à un refus ;
six tests rouges attribués à tort au premier fichier écrit, alors qu'il manquait
le commit initial.
2026-09-03 · 2026-09-09
