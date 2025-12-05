"use strict";

// Chargement des modules
const express = require("express");
const app = express();
const PORT = process.env.PORT || 8888;
const server = app.listen(PORT, function () {
    console.log(`C'est parti ! En attente de connexion sur le port ${PORT}...`);
});

// Ecoute sur les websockets
const { Server } = require("socket.io");
const io = new Server(server);

// Configuration d'express pour utiliser le répertoire "public"
app.use(express.static("public"));
// set up to serve default file
app.get("/", function (req, res) {
    res.sendFile(__dirname + "/public/odin.html");
});

/***************************************************************
 *           Gestion des clients et des connexions
 ***************************************************************/

let parties = {};

let compteur = 0;

/**
 * Supprime une partie et libère les ressources associées
 * @param {number} partie - L'identifiant numérique de la partie à supprimer
 */
function supprimerPartie(partie) {
    console.log("Suppression de la partie " + partie);
    delete parties[partie];
}

/**********************************************************************
 ***                      Gestion des websockets                    ***
 **********************************************************************/

/** Nombre maximum de manches par partie */
const NB_MANCHES_MAX = 3;

/**
 * Représente une carte du jeu
 * @class
 */
class Carte {
    /** @type {number} Valeur de la carte (1-9) */
    valeur;
    /** @type {string} Couleur de la carte (Bleu, Rouge, Rose, Noir, Vert, Jaune) */
    couleur;

    /**
     * Crée une nouvelle carte
     * @param {number} valeur - Valeur de la carte (1-9)
     * @param {string} couleur - Couleur de la carte
     */
    constructor(valeur, couleur) {
        this.valeur = valeur;
        this.couleur = couleur;
    }

    /**
     * Retourne une représentation textuelle de la carte
     * @returns {string} Format "valeur de couleur"
     */
    toString() {
        return this.valeur + " de " + this.couleur;
    }
}

/**
 * Représente un joueur dans la partie
 * @class
 */
class Joueur {
    /** @type {Object} Socket.io du joueur */
    socket;
    /** @type {Array<Carte>} Cartes en main du joueur */
    main = [];
    /** @type {string} Pseudo du joueur */
    pseudo;
    /** @type {number} Score cumulé du joueur */
    score = 0;

    /**
     * Crée un nouveau joueur
     * @param {Object} socket - Socket.io du joueur
     * @param {string} pseudo - Pseudo du joueur
     */
    constructor(socket, pseudo) {
        this.socket = socket;
        this.pseudo = pseudo;
    }

    /**
     * Retire une carte de la main du joueur
     * @param {Carte} carte - La carte à retirer
     * @returns {boolean} true si la carte a été retirée, false sinon
     */
    retirerCarte(carte) {
        const index = this.main.findIndex((c) => c.valeur === carte.valeur && c.couleur === carte.couleur);
        if (index > -1) {
            this.main.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Ajoute une carte à la main du joueur
     * @param {Carte} carte - La carte à ajouter
     */
    ajouterCarte(carte) {
        this.main.push(carte);
    }

    /**
     * Ajoute plusieurs cartes à la main du joueur
     * @param {Array<Carte>} cartes - Les cartes à ajouter
     */
    ajouterCartes(cartes) {
        this.main.push(...cartes);
    }

    /**
     * Trie les cartes en main du joueur
     * @param {boolean} couleur - Si true, trie par couleur puis valeur. Si false, trie par valeur uniquement
     */
    trierMain(couleur) {
        if (couleur) {
            const ordreCouleurs = ["Bleu", "Rouge", "Rose", "Noir", "Vert", "Jaune"];

            this.main.sort((a, b) => {
                const indexCouleurA = ordreCouleurs.indexOf(a.couleur);
                const indexCouleurB = ordreCouleurs.indexOf(b.couleur);

                if (indexCouleurA !== indexCouleurB) {
                    return indexCouleurA - indexCouleurB;
                }

                return b.valeur - a.valeur;
            });
        } else {
            this.main.sort((a, b) => {
                return b.valeur - a.valeur;
            });
        }
    }

    /**
     * Trie la main et l'envoie au client via socket
     */
    envoyerMain() {
        this.trierMain(true);
        this.socket.emit("main", this.main);
    }

    /**
     * Vérifie si le joueur possède toutes les cartes spécifiées
     * @param {Array<Carte>} cartes - Les cartes à vérifier
     * @returns {boolean} true si le joueur possède toutes les cartes, false sinon
     */
    possedeCartes(cartes) {
        for (let carte of cartes) {
            const index = this.main.findIndex((c) => c.valeur === carte.valeur && c.couleur === carte.couleur);
            if (index === -1) {
                return false;
            }
        }
        return true;
    }

    /**
     * Retourne le nombre de cartes en main
     * @returns {number} Nombre de cartes
     */
    getNbCartes() {
        return this.main.length;
    }

    /**
     * Retourne le pseudo du joueur
     * @returns {string} Pseudo du joueur
     */
    getPseudo() {
        return this.pseudo;
    }

    /**
     * Retourne le score actuel du joueur
     * @returns {number} Score du joueur
     */
    getScore() {
        return this.score;
    }

    /**
     * Définit le score du joueur
     * @param {number} score - Nouveau score du joueur
     */
    setScore(score) {
        this.score = score;
    }
}

/**
 * Gestion de la connexion d'un nouveau client via WebSocket
 */
io.on("connection", (socket) => {
    console.log("Un client est connecté : " + socket.id);

    /** @type {number} Index du joueur dans le tableau des joueurs (-1 = en attente de partie, 0-2 = position dans la partie) */
    let index = -1;
    /** @type {number|null} Numéro de la partie à laquelle participe le joueur */
    let partie = null;

    /**
     *  Demande le démarrage d'une partie.
     *  @param  pseudo  le pseudo du joueur
     */
    socket.on("demarrer", function (pseudo) {
        // vérification du pseudo
        if (!pseudo || pseudo.trim().length === 0 || typeof pseudo !== "string" || pseudo.length > 20) {
            socket.emit("erreur", "Pseudo invalide.");
            return;
        }

        console.log("Le joueur " + pseudo + " demande à démarrer une partie.");

        // si le joueur est déjà en train de jouer à une partie
        if (index != -1) {
            socket.emit("erreur", "Joueur déjà connecté.");
            return;
        }

        console.log("Pseudo reçu : ", pseudo);

        // assignation d'une place au joueur
        if (parties[compteur] && parties[compteur].joueurs.length < 3) {
            partie = compteur;
            index = parties[partie].joueurs.length;
        } else {
            // creation d'une nouvelle partie
            compteur++;
            partie = compteur;
            parties[partie] = { joueurs: [], courant: -1, premierTour: true, tasCartes: [], cartesEnCoursDejeu: [], nbManches: 0 };
            index = 0;
        }

        // ajout du joueur à la partie en cours
        parties[partie].joueurs[index] = new Joueur(socket, pseudo);
        console.log("  -> joueur ajouté à la partie " + partie + ", à l'indice " + index);

        if (parties[partie].joueurs.length == 3) {
            // les trois joueurs sont prêts
            console.log("Début de la partie " + partie);
            debutPartie(partie);
        } else {
            // seul le joueur présent est là
            socket.emit("en_attente", "En attente d'autres joueurs");
        }
    });

    /**
     * Démarre une partie : crée et distribue le jeu de cartes, choisit le premier joueur
     * @param {number} partie - Numéro de la partie à démarrer
     */
    function debutPartie(partie) {
        // Création du jeu de cartes
        let jeuDeCartes = [];
        const couleurs = ["Bleu", "Rouge", "Rose", "Noir", "Vert", "Jaune"];
        for (let couleur of couleurs) {
            for (let valeur = 1; valeur <= 9; valeur++) {
                jeuDeCartes.push(new Carte(valeur, couleur));
            }
        }

        // Mélange du jeu de cartes
        for (let i = jeuDeCartes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            let temp = jeuDeCartes[i];
            jeuDeCartes[i] = jeuDeCartes[j];
            jeuDeCartes[j] = temp;
        }

        // Distribution des 9 cartes aux joueurs
        for (let i = 0; i < 3; i++) {
            parties[partie].joueurs[i].ajouterCartes(jeuDeCartes.slice(i * 9, i * 9 + 9));

            // Envoi des mains aux joueurs
            parties[partie].joueurs[i].envoyerMain();
        }

        // Choisir aléatoirement le joueur qui commence
        parties[partie].courant = (Math.random() * 3) | 0;

        // Préparer les infos adversaires
        let nbCartesAdversaires = [];
        for (let i = 0; i < 3; i++) {
            nbCartesAdversaires.push({
                pseudo: parties[partie].joueurs[i].pseudo,
                nbCartes: parties[partie].joueurs[i].getNbCartes(),
            });
        }

        // Informer les joueurs du début de la partie
        for (let i = 0; i < 3; i++) {
            if (i === parties[partie].courant) {
                parties[partie].joueurs[i].socket.emit("a_toi", {
                    message: "Démarrage de la partie, vous commencez.",
                    tasCartes: parties[partie].tasCartes,
                    nbCartesAdversaires: nbCartesAdversaires,
                });
            } else {
                parties[partie].joueurs[i].socket.emit("a_l_autre", {
                    message: "Démarrage de la partie. En attente du tour de " + parties[partie].joueurs[parties[partie].courant].getPseudo() + ".",
                    tasCartes: parties[partie].tasCartes,
                    nbCartesAdversaires: nbCartesAdversaires,
                });
            }
        }

        console.log("Contenu de la partie " + partie + " :", parties[partie]);
    }

    /**
     * Gestion de la demande de tri des cartes du joueur
     * @param {boolean} couleur - Si true, trie par couleur puis valeur. Si false, trie par valeur uniquement
     */
    socket.on("trier_carte", function (couleur) {
        if (!parties[partie] || index === -1) {
            socket.emit("erreur", "Partie introuvable.");
            return;
        }

        parties[partie].joueurs[index].trierMain(couleur);
        parties[partie].joueurs[index].socket.emit("main", parties[partie].joueurs[index].main);
    });

    /**
     * Gestion de l'action de jeu : un joueur joue une ou plusieurs cartes
     * Vérifie la validité du coup selon les règles (premier tour, nombre de cartes, valeur, couleur)
     * @param {Array<Object>} carte - Tableau de cartes jouées (peut être vide pour passer)
     */
    socket.on("jouer_carte", function (carte) {
        if (!parties[partie] || index === -1) {
            socket.emit("erreur", "Partie introuvable.");
            return;
        }

        // Vérifier que c'est le tour du joueur
        if (index !== parties[partie].courant) {
            socket.emit("erreur", "Ce n'est pas votre tour de jouer.");
            return;
        }

        const cartesJouees = carte.map(transformerCarte);

        // Vérifier que le joueur possède bien les cartes jouées
        if (cartesJouees.length > 0 && !parties[partie].joueurs[index].possedeCartes(cartesJouees)) {
            socket.emit("erreur", "Vous ne possédez pas toutes les cartes que vous essayez de jouer.");
            return;
        }

        console.log("Le joueur " + parties[partie].joueurs[index].pseudo + " joue :", cartesJouees);

        // ========== CAS 1 : PASSE (0 carte) ==========
        if (cartesJouees.length === 0) {
            traiterPasse();
            return;
        }

        // ========== CAS 2 : PREMIER TOUR ==========
        if (parties[partie].premierTour) {
            traiterPremierTour(cartesJouees);
            return;
        }

        // ========== CAS 3 : TOUR NORMAL ==========
        traiterTourNormal(cartesJouees);
    });

    /**
     * Traite le cas où le joueur passe son tour (joue 0 carte)
     * Vérifie qu'on n'est pas au premier tour, incrémente le compteur de passes
     * Si 2 passes consécutives, déclenche la fin du tour
     */
    function traiterPasse() {
        if (parties[partie].premierTour) {
            socket.emit("erreur", "Vous devez jouer au moins une carte lors du premier tour.");
            return;
        }

        console.log(parties[partie].joueurs[index].getPseudo() + " passe son tour.");
        parties[partie].passesConsecutives++;

        if (parties[partie].passesConsecutives === 2) {
            console.log("Deux passes consécutives, fin du tour.");
            finDuTour();
        } else {
            passerAuJoueurSuivant();
        }
    }

    /**
     * Traite le premier tour de la manche
     * Règles : jouer 1 carte OU toutes ses cartes (si même valeur ou couleur)
     * @param {Array<Carte>} cartesJouees - Les cartes jouées par le joueur
     */
    function traiterPremierTour(cartesJouees) {
        // Vérification : 1 carte OU toutes les cartes
        if (cartesJouees.length > 1 && cartesJouees.length !== parties[partie].joueurs[index].getNbCartes()) {
            socket.emit(
                "erreur",
                "Vous devez jouer une carte lors de la première manche ou toutes vos cartes seulement si elles ont toute la même valeur ou la même couleur."
            );
            return;
        }

        // Vérification : si plusieurs cartes, même valeur OU même couleur
        if (cartesJouees.length > 1 && !verifierMemeCouleurOuValeur(cartesJouees)) {
            socket.emit("erreur", "Les cartes jouées doivent être de la même valeur ou de la même couleur.");
            return;
        }

        // Retirer les cartes et mettre à jour le tas
        retirerCartes(cartesJouees);
        parties[partie].tasCartes = cartesJouees;
        parties[partie].premierTour = false;

        // Vérifier fin de manche
        if (parties[partie].joueurs[index].getNbCartes() === 0) {
            socket.emit("coup_valide");
            finDeManche();
        } else {
            parties[partie].passesConsecutives = 0;
            parties[partie].dernierJoueurActif = index;
            passerAuJoueurSuivant();
        }
    }

    /**
     * Traite un tour normal (après le premier tour)
     * Règles : jouer autant ou +1 carte que le tas, même valeur/couleur, valeur supérieure
     * Si le joueur vide sa main, déclenche la fin de manche. Sinon, demande sélection dans le tas
     * @param {Array<Carte>} cartesJouees - Les cartes jouées par le joueur
     */
    function traiterTourNormal(cartesJouees) {
        const nbCartesTas = parties[partie].tasCartes.length;

        // Vérification : nombre de cartes = tas OU tas+1
        if (cartesJouees.length !== nbCartesTas && cartesJouees.length !== nbCartesTas + 1) {
            socket.emit("erreur", `Vous devez jouer ${nbCartesTas} ou ${nbCartesTas + 1} cartes.`);
            return;
        }

        // Vérification : si plusieurs cartes, même couleur OU même valeur
        if (cartesJouees.length > 1 && !verifierMemeCouleurOuValeur(cartesJouees)) {
            socket.emit("erreur", "Les cartes jouées doivent être de la même valeur ou de la même couleur.");
            return;
        }

        // Vérification : valeur > tas
        if (plusGrandeValeur(cartesJouees) <= plusGrandeValeur(parties[partie].tasCartes)) {
            socket.emit("erreur", "La valeur des cartes jouées doit être supérieure à celle du joueur précédent.");
            return;
        }

        // Retirer les cartes
        retirerCartes(cartesJouees);

        // Vérifier fin de manche
        if (parties[partie].joueurs[index].getNbCartes() === 0) {
            parties[partie].tasCartes = cartesJouees;
            socket.emit("coup_valide");
            finDeManche();
            return;
        }

        // Le joueur continue : sélection carte du tas
        parties[partie].passesConsecutives = 0;
        parties[partie].dernierJoueurActif = index;
        parties[partie].cartesEnCoursDejeu = cartesJouees;

        socket.emit("coup_valide");
        socket.emit("selectionner_carte_dans_tas", parties[partie].tasCartes);
    }

    /**
     * Gestion de la sélection d'une carte dans le tas après avoir joué
     * Retire la carte du tas, l'ajoute à la main du joueur, met à jour le tas
     * Passe au joueur suivant
     * @param {Object} carteSelectionnee - Carte sélectionnée par le joueur dans le tas
     */
    socket.on("carte_dans_tas_selectionnee", function (carteSelectionnee) {
        if (!parties[partie] || index === -1) {
            socket.emit("erreur", "Partie introuvable.");
            return;
        }

        const cartesJouees = parties[partie].cartesEnCoursDejeu;

        if (!cartesJouees) {
            socket.emit("erreur", "Erreur : aucune carte en cours de jeu.");
            return;
        }

        if (index !== parties[partie].courant) {
            socket.emit("erreur", "Ce n'est pas votre tour de jouer.");
            return;
        }

        // retirer la carte du tas
        let carteTas = transformerCarte(carteSelectionnee);
        console.log("carteTas :", carteTas);

        const indexCarte = parties[partie].tasCartes.findIndex((c) => c.valeur === carteTas.valeur && c.couleur === carteTas.couleur);
        if (indexCarte > -1) {
            parties[partie].tasCartes.splice(indexCarte, 1);
        } else {
            socket.emit("erreur", "La carte sélectionnée n'est pas dans le tas.");
            return;
        }

        // ajouter la carte du tas à la main du joueur
        parties[partie].joueurs[index].ajouterCarte(carteTas);
        parties[partie].joueurs[index].envoyerMain();

        // Mettre à jour le tas de cartes jouées
        parties[partie].tasCartes = cartesJouees;

        console.log("Nouveau tas de cartes :", parties[partie].tasCartes);

        delete parties[partie].cartesEnCoursDejeu;

        // passer au joueur suivant
        passerAuJoueurSuivant();
    });

    /**
     * Vérifie que toutes les cartes ont la même couleur OU la même valeur
     * Règle du jeu : quand on joue plusieurs cartes, elles doivent respecter cette contrainte
     * @param {Array<Carte>} cartes - Les cartes à vérifier
     * @returns {boolean} true si même couleur OU même valeur, false sinon
     */
    function verifierMemeCouleurOuValeur(cartes) {
        const valeurRef = cartes[0].valeur;
        const couleurRef = cartes[0].couleur;
        let memeValeur = true;
        let memeCouleur = true;

        for (let i = 1; i < cartes.length; i++) {
            if (cartes[i].valeur !== valeurRef) memeValeur = false;
            if (cartes[i].couleur !== couleurRef) memeCouleur = false;
        }

        return memeValeur || memeCouleur;
    }

    /**
     * Retire les cartes de la main du joueur et envoie la main mise à jour au client
     * Fonction utilitaire pour éviter la duplication de code
     * @param {Array<Carte>} cartes - Les cartes à retirer
     */
    function retirerCartes(cartes) {
        for (let carte of cartes) {
            parties[partie].joueurs[index].retirerCarte(carte);
        }
        parties[partie].joueurs[index].envoyerMain();
    }

    /**
     * Passe au joueur suivant dans l'ordre de rotation
     * Envoie "a_toi" au joueur actif et "a_l_autre" aux autres joueurs
     */
    function passerAuJoueurSuivant() {
        parties[partie].courant = (parties[partie].courant + 1) % 3;

        let nbCartesAdversaires = [];
        for (let i = 0; i < 3; i++) {
            nbCartesAdversaires.push({
                pseudo: parties[partie].joueurs[i].getPseudo(),
                nbCartes: parties[partie].joueurs[i].getNbCartes(),
                estCourant: i === parties[partie].courant,
            });
        }

        parties[partie].joueurs[parties[partie].courant].socket.emit("a_toi", {
            message: "C'est à votre tour de jouer.",
            tasCartes: parties[partie].tasCartes,
            nbCartesAdversaires: nbCartesAdversaires,
        });

        for (let i = 0; i < 3; i++) {
            if (i !== parties[partie].courant) {
                parties[partie].joueurs[i].socket.emit("a_l_autre", {
                    message: "En attente du tour de " + parties[partie].joueurs[parties[partie].courant].getPseudo() + ".",
                    tasCartes: parties[partie].tasCartes,
                    nbCartesAdversaires: nbCartesAdversaires,
                });
            }
        }
    }

    /**
     * Transforme une carte brute (objet simple du client) en instance de Carte
     * Convertit la valeur en entier pour éviter les erreurs de type
     * @param {Object} carteBrute - Objet avec propriétés valeur et couleur
     * @returns {Carte} Instance de Carte créée
     */
    function transformerCarte(carteBrute) {
        return new Carte(parseInt(carteBrute.valeur), carteBrute.couleur);
    }

    /**
     * Retourne la plus grande valeur avec la combinaison de cartes donnée
     * @param {Array<Carte>} cartes - Tableau de cartes
     * @returns {number} La valeur formée par concaténation des valeurs triées
     */
    function plusGrandeValeur(cartes) {
        let copieCartes = cartes.slice();
        copieCartes.sort((a, b) => b.valeur - a.valeur);
        let valeurConcatenee = copieCartes.map((c) => c.valeur).join("");

        return parseInt(valeurConcatenee);
    }

    /**
     * Déclenche la fin du tour après 2 passes consécutives
     * Vide le tas, réinitialise l'état, le dernier joueur actif recommence un nouveau tour
     */
    function finDuTour() {
        console.log("Fin du tour, tout le monde a passé sauf " + parties[partie].joueurs[parties[partie].dernierJoueurActif].pseudo);

        // Vider le tas
        parties[partie].tasCartes = [];

        // Reset compteur
        parties[partie].passesConsecutives = 0;

        // Le dernier joueur actif démarre le nouveau tour
        parties[partie].courant = parties[partie].dernierJoueurActif;
        parties[partie].premierTour = true;

        // Notifier les joueurs
        let nbCartesAdversaires = [];
        for (let i = 0; i < 3; i++) {
            nbCartesAdversaires.push({
                pseudo: parties[partie].joueurs[i].getPseudo(),
                nbCartes: parties[partie].joueurs[i].getNbCartes(),
                estCourant: i === parties[partie].courant,
            });
        }

        parties[partie].joueurs[parties[partie].courant].socket.emit("a_toi", {
            message: "Nouveau tour ! Jouez 1 carte.",
            tasCartes: [],
            nbCartesAdversaires: nbCartesAdversaires,
        });

        for (let i = 0; i < 3; i++) {
            if (i !== parties[partie].courant) {
                parties[partie].joueurs[i].socket.emit("a_l_autre", {
                    message: "Nouveau tour. En attente de " + parties[partie].joueurs[parties[partie].courant].getPseudo() + ".",
                    tasCartes: [],
                    nbCartesAdversaires: nbCartesAdversaires,
                });
            }
        }
    }

    /**
     * Déclenche la fin de la manche : calcule les scores, notifie les joueurs
     * Incrémente le compteur de manches et vérifie si c'est la fin de partie
     * Sinon, lance une nouvelle manche après 3 secondes
     */
    function finDeManche() {
        console.log("Fin de la manche " + (parties[partie].nbManches + 1));

        // Calculer les scores
        let scoresPartie = [];
        for (let i = 0; i < 3; i++) {
            const cartesRestantes = parties[partie].joueurs[i].getNbCartes();
            parties[partie].joueurs[i].setScore(parties[partie].joueurs[i].getScore() + cartesRestantes);

            scoresPartie.push({
                pseudo: parties[partie].joueurs[i].getPseudo(),
                cartesRestantes: cartesRestantes,
                scoreTotal: parties[partie].joueurs[i].getScore(),
            });

            console.log(
                parties[partie].joueurs[i].getPseudo() + " : " + cartesRestantes + " cartes restantes, score total : " + parties[partie].joueurs[i].getScore()
            );
        }

        // Préparer les infos adversaires pour l'affichage
        let nbCartesAdversaires = [];
        for (let i = 0; i < 3; i++) {
            nbCartesAdversaires.push({
                pseudo: parties[partie].joueurs[i].getPseudo(),
                nbCartes: parties[partie].joueurs[i].getNbCartes(),
            });
        }

        // Notifier les joueurs
        for (let i = 0; i < 3; i++) {
            parties[partie].joueurs[i].socket.emit("fin_manche", {
                scores: scoresPartie,
                nbManche: parties[partie].nbManches + 1,
                nbCartesAdversaires: nbCartesAdversaires,
                nbManchesMax: NB_MANCHES_MAX,
            });
        }

        // Incrémenter le compteur de manches
        parties[partie].nbManches++;

        // Vérifier fin de partie
        if (parties[partie].nbManches >= NB_MANCHES_MAX) {
            finDePartie();
        } else {
            // Nouvelle manche après 3 secondes
            setTimeout(() => {
                if (parties[partie]) {
                    // Vérifier que la partie existe encore
                    nouvelleManche();
                }
            }, 10000);
        }
    }

    /**
     * Démarre une nouvelle manche : vide les mains, crée et distribue un nouveau jeu
     * Le joueur suivant dans l'ordre commence cette nouvelle manche
     */
    function nouvelleManche() {
        console.log("Démarrage de la manche " + (parties[partie].nbManches + 1));

        // Vider les mains
        for (let joueur of parties[partie].joueurs) {
            joueur.main = [];
        }

        // Créer et mélanger nouveau deck
        let jeuDeCartes = [];
        const couleurs = ["Bleu", "Rouge", "Rose", "Noir", "Vert", "Jaune"];
        for (let couleur of couleurs) {
            for (let valeur = 1; valeur <= 9; valeur++) {
                jeuDeCartes.push(new Carte(valeur, couleur));
            }
        }

        // Mélange
        for (let i = jeuDeCartes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [jeuDeCartes[i], jeuDeCartes[j]] = [jeuDeCartes[j], jeuDeCartes[i]];
        }

        // Distribution
        for (let i = 0; i < 3; i++) {
            parties[partie].joueurs[i].ajouterCartes(jeuDeCartes.slice(i * 9, i * 9 + 9));
            parties[partie].joueurs[i].envoyerMain();
        }

        // Le joueur suivant du dernier gagnant commence
        // Si pas de gagnant précédent, continuer la rotation
        parties[partie].courant = (parties[partie].courant + 1) % 3;

        // Reset état
        parties[partie].tasCartes = [];
        parties[partie].premierTour = true;
        parties[partie].passesConsecutives = 0;

        // Notifier
        let nbCartesAdversaires = [];
        for (let i = 0; i < 3; i++) {
            nbCartesAdversaires.push({
                pseudo: parties[partie].joueurs[i].pseudo,
                nbCartes: 9,
                estCourant: i === parties[partie].courant,
            });
        }

        for (let i = 0; i < 3; i++) {
            if (i === parties[partie].courant) {
                parties[partie].joueurs[i].socket.emit("a_toi", {
                    message: "Nouvelle manche ! Vous commencez. Jouez 1 carte.",
                    tasCartes: [],
                    nbCartesAdversaires: nbCartesAdversaires,
                });
            } else {
                parties[partie].joueurs[i].socket.emit("a_l_autre", {
                    message: "Nouvelle manche. En attente de " + parties[partie].joueurs[parties[partie].courant].getPseudo() + ".",
                    tasCartes: [],
                    nbCartesAdversaires: nbCartesAdversaires,
                });
            }
        }
    }

    /**
     * Déclenche la fin de la partie : détermine le(s) gagnant(s), crée le classement
     * Notifie tous les joueurs et supprime la partie après 10 secondes
     */
    function finDePartie() {
        console.log("Fin de la partie " + partie);

        // Trouver le gagnant
        let scoreMin = Math.min(...parties[partie].joueurs.map((j) => j.score));
        let gagnants = parties[partie].joueurs.filter((j) => j.score === scoreMin);

        // Classement
        let classement = parties[partie].joueurs.map((j) => ({ pseudo: j.pseudo, score: j.score })).sort((a, b) => a.score - b.score);

        console.log("Classement final :", classement);

        // Notifier tous les joueurs
        for (let joueur of parties[partie].joueurs) {
            joueur.socket.emit("fin_partie", {
                gagnant: gagnants.length === 1 ? gagnants[0].pseudo : "Égalité !",
                gagnants: gagnants.map((g) => g.pseudo),
                classement: classement,
            });
        }

        // Supprimer la partie après 10 secondes
        setTimeout(() => supprimerPartie(partie), 10000);
    }

    /**
     * Gestion de la déconnexion d'un joueur
     * Notifie les autres joueurs de la partie et supprime la partie en cours
     */
    socket.on("disconnect", function () {
        console.log("Déconnexion du joueur " + socket.id);

        // Vérifier que le joueur était bien dans une partie
        if (partie === null || !parties[partie]) {
            console.log("Le joueur n'était pas dans une partie active.");
            return;
        }

        // CONNAITRE qui se déconnecte
        let indexJoueur = parties[partie].joueurs.findIndex((j) => j.socket.id === socket.id);
        console.log("Index du joueur déconnecté dans la partie " + partie + " : " + indexJoueur);
        console.log("Pseudo du joueur déconnecté : " + (indexJoueur >= 0 ? parties[partie].joueurs[indexJoueur].getPseudo() : "Inconnu"));

        // Si le joueur faisait partie d'une partie en cours
        if (indexJoueur >= 0) {
            console.log("Fin de la partie (abandon)");

            // Notifier les joueurs
            for (let i = 0; i < parties[partie].joueurs.length; i++) {
                if (i !== indexJoueur && parties[partie].joueurs[i]) {
                    parties[partie].joueurs[i].socket.emit("deconnexion", parties[partie].joueurs[indexJoueur].getPseudo() + " s'est déconnecté.");
                }
            }

            supprimerPartie(partie);
        }
    });
});
