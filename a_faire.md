# 📊 Analyse de votre implémentation vs Règles officielles

## ✅ Ce que vous faites **CORRECTEMENT**

### 1. **Distribution initiale**

-   ✅ 9 cartes par joueur
-   ✅ Mélange aléatoire
-   ✅ Sélection aléatoire du premier joueur

### 2. **Premier tour de la première manche**

-   ✅ 1 seule carte obligatoire
-   ✅ Pas de comparaison
-   ✅ Initialise le tas central

### 3. **Tours normaux - Validation**

-   ✅ Même nombre de cartes OU +1
-   ✅ Valeur combinée supérieure (fonction `plusGrandeValeur`)
-   ✅ Pioche 1 carte du tas après avoir joué

### 4. **Gestion des tours**

-   ✅ Rotation circulaire (0→1→2→0)
-   ✅ Notifications aux joueurs

---

## ❌ Ce que vous **NE FAITES PAS** (selon les règles)

### 🔴 Règles manquantes - Critique

#### 1. **Validation "même valeur OU même couleur"**

```javascript
// ❌ Vous ne vérifiez PAS ceci actuellement
// Les cartes jouées doivent TOUTES avoir :
// - Soit la même valeur (ex: 5♥ 5♦ 5♣)
// - Soit la même couleur (ex: 3♥ 7♥ 9♥)
```

**Où l'ajouter :** Dans `socket.on("jouer_carte")` avant validation de la valeur

---

#### 2. **Système de "passer"**

```javascript
// ❌ Vous n'avez PAS de mécanisme pour passer
// Actuellement : carte.length === 0 → passe au suivant
// ✅ C'est déjà partiellement fait !
```

**Mais il manque :**

-   Compteur de passes consécutives
-   Détection "tout le monde a passé sauf 1" → Fin du tour

---

#### 3. **Fin de tour (défausser le tas)**

```javascript
// ❌ Vous ne videz JAMAIS le tas
// Règle : Si tous passent sauf 1 → vider tasCartes
```

**Concept à implémenter :**

```
Joueur A joue
Joueur B passe (compteur = 1)
Joueur C passe (compteur = 2)
Joueur A rejoue → compteur = 0
Joueur B passe (compteur = 1)
Joueur C passe (compteur = 2)
→ 2 passes consécutives = fin du tour
→ Vider le tas
→ Joueur A démarre nouveau tour avec 1 carte
```

---

#### 4. **Fin de manche - Condition 1**

```javascript
// ❌ Pas implémenté
// Si vous démarrez un tour ET toutes vos cartes sont :
// - Même valeur OU même couleur
// → Vous pouvez les jouer TOUTES → Fin de manche
```

---

#### 5. **Fin de manche - Condition 2**

```javascript
// ❌ Partiellement fait
// Si après avoir joué, votre main est vide
// → NE PAS piocher
// → Fin de manche
```

**Actuellement :** Vous forcez toujours la pioche

---

#### 6. **Calcul des scores**

```javascript
// ❌ Pas implémenté
// À la fin de chaque manche :
// Score = nombre de cartes restantes en main
```

---

#### 7. **Système de manches multiples**

```javascript
// ❌ Pas implémenté
// - 5 manches au total
// - Redistribuer 9 cartes à chaque nouvelle manche
// - Le joueur suivant du 1er joueur de la manche précédente commence
```

---

#### 8. **Condition de victoire**

```javascript
// ❌ Pas implémenté
// Après 5 manches : Score le plus BAS gagne
```

---

## 🛠️ Plan d'implémentation par priorité

### Phase 1 : Compléter les règles de base 🔴

#### A. Validation "même valeur OU même couleur"

**Où :** Dans `socket.on("jouer_carte")`, après `transformerCarte`

**Comment :**

```javascript
function validerCombinaison(cartes) {
    if (cartes.length <= 1) return true; // 1 carte = toujours valide

    // Vérifier même valeur
    const memeValeur = cartes.every((c) => c.valeur === cartes[0].valeur);

    // Vérifier même couleur
    const memeCouleur = cartes.every((c) => c.couleur === cartes[0].couleur);

    return memeValeur || memeCouleur;
}
```

---

#### B. Système de passes et fin de tour

**Données à ajouter dans `parties[partie]` :**

```javascript
parties[partie] = {
    // ...existing
    passesConsecutives: 0, // Compte les passes
    dernierJoueurActif: null, // Qui a joué en dernier
};
```

**Logique :**

```javascript
// Quand joueur joue une carte
passesConsecutives = 0;
dernierJoueurActif = index;

// Quand joueur passe
passesConsecutives++;
if (passesConsecutives === 2) {
    // Tout le monde a passé sauf dernierJoueurActif
    finDuTour();
}
```

**Fonction `finDuTour()` :**

```javascript
function finDuTour() {
    // 1. Vider le tas
    parties[partie].tasCartes = [];

    // 2. Reset compteur
    parties[partie].passesConsecutives = 0;

    // 3. Le dernier joueur actif démarre nouveau tour
    parties[partie].courant = parties[partie].dernierJoueurActif;

    // 4. Premier tour du nouveau cycle = 1 carte obligatoire
    parties[partie].premierTour = true;

    // 5. Notifier
    notifierNouveauTour();
}
```

---

#### C. Détecter fin de manche

**Après avoir joué des cartes :**

```javascript
// Vérifier si main vide
if (parties[partie].joueurs[index].main.length === 0) {
    finDeManche();
    return; // Ne pas passer au suivant
}

// Vérifier si début de tour + toutes cartes même val/couleur
if (parties[partie].premierTour && peutJouerToutesLesCartes(index)) {
    // Proposer au joueur de jouer toutes ses cartes
    socket.emit("peut_finir_manche", { nbCartes: main.length });
}
```

---

### Phase 2 : Système de manches 🟠

#### Structure de données

```javascript
parties[partie] = {
    // ...existing
    nbManches: 0, // Compteur de manches (0-4)
    scores: [0, 0, 0], // Score cumulé de chaque joueur
    premierJoueurManche: 0, // Qui a commencé la manche actuelle
};
```

#### Fonction `finDeManche()`

**Étapes :**

1. Calculer scores (cartes restantes)
2. Les ajouter aux scores cumulés
3. Incrémenter `nbManches`
4. Si `nbManches < 5` → Nouvelle manche
5. Sinon → Fin de partie

**Code conceptuel :**

```javascript
function finDeManche() {
    // 1. Calculer scores
    for (let i = 0; i < 3; i++) {
        const cartesRestantes = parties[partie].joueurs[i].main.length;
        parties[partie].scores[i] += cartesRestantes;
    }

    // 2. Notifier scores
    notifierScoresManche();

    // 3. Incrémenter
    parties[partie].nbManches++;

    // 4. Vérifier fin
    if (parties[partie].nbManches >= 5) {
        finDePartie();
    } else {
        nouvelleManche();
    }
}
```

---

#### Fonction `nouvelleManche()`

**Étapes :**

1. Réinitialiser mains des joueurs
2. Créer + mélanger nouveau deck
3. Redistribuer 9 cartes
4. Choisir premier joueur (suivant de la manche précédente)
5. Réinitialiser tas + compteurs

**Code conceptuel :**

```javascript
function nouvelleManche() {
    // 1. Reset mains
    for (let joueur of parties[partie].joueurs) {
        joueur.main = [];
    }

    // 2. Nouveau deck
    let deck = creerDeck();
    melangerDeck(deck);

    // 3. Distribution
    for (let i = 0; i < 3; i++) {
        joueurs[i].ajouterCartes(deck.slice(i * 9, i * 9 + 9));
        joueurs[i].envoyerMain();
    }

    // 4. Premier joueur = suivant du précédent
    parties[partie].premierJoueurManche = (parties[partie].premierJoueurManche + 1) % 3;
    parties[partie].courant = parties[partie].premierJoueurManche;

    // 5. Reset
    parties[partie].tasCartes = [];
    parties[partie].premierTour = true;
    parties[partie].passesConsecutives = 0;

    // 6. Notifier
    notifierDebutManche();
}
```

---

#### Fonction `finDePartie()`

**Étapes :**

1. Trouver le gagnant (score minimal)
2. Créer classement
3. Notifier tous les joueurs
4. Supprimer la partie

**Code conceptuel :**

```javascript
function finDePartie() {
    // 1. Trouver gagnant
    let scoreMin = Math.min(...parties[partie].scores);
    let gagnantIndex = parties[partie].scores.indexOf(scoreMin);

    // 2. Classement
    let classement = parties[partie].joueurs
        .map((j, i) => ({
            pseudo: j.pseudo,
            score: parties[partie].scores[i],
        }))
        .sort((a, b) => a.score - b.score);

    // 3. Notifier
    for (let joueur of parties[partie].joueurs) {
        joueur.socket.emit("fin_partie", {
            gagnant: parties[partie].joueurs[gagnantIndex].pseudo,
            classement: classement,
        });
    }

    // 4. Cleanup
    setTimeout(() => supprimerPartie(partie), 5000);
}
```

---

### Phase 3 : UX et polish 🟢

1. Animations des cartes
2. Sons
3. Historique des coups
4. Chat
5. Bouton "Rejouer"

---

## 📋 Checklist d'implémentation

| Feature                        | État        | Priorité   |
| ------------------------------ | ----------- | ---------- |
| ✅ Distribution 9 cartes       | Done        | -          |
| ✅ Premier tour 1 carte        | Done        | -          |
| ✅ Valeur combinée             | Done        | -          |
| ❌ Validation même val/couleur | **À faire** | 🔴 HAUTE   |
| ❌ Compteur de passes          | **À faire** | 🔴 HAUTE   |
| ❌ Fin de tour (vider tas)     | **À faire** | 🔴 HAUTE   |
| ❌ Fin manche (main vide)      | **À faire** | 🔴 HAUTE   |
| ❌ Fin manche (toutes cartes)  | **À faire** | 🟠 MOYENNE |
| ❌ Calcul scores               | **À faire** | 🟠 MOYENNE |
| ❌ Système 5 manches           | **À faire** | 🟠 MOYENNE |
| ❌ Redistribution              | **À faire** | 🟠 MOYENNE |
| ❌ Fin de partie               | **À faire** | 🟠 MOYENNE |

---

## 🎯 Par où commencer ?

**Je recommande cet ordre :**

1. **Validation combinaison** (même val/couleur) → 30 min
2. **Système de passes** → 1h
3. **Fin de tour** (vider tas) → 30 min
4. **Fin de manche** (main vide) → 1h
5. **Calcul scores** → 30 min
6. **Système manches** → 2h
7. **Fin de partie** → 1h

**Temps estimé total : ~6-7h de développement**

Voulez-vous que je vous aide à implémenter une de ces fonctionnalités en détail ? 🚀
