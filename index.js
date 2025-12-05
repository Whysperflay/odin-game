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
 *  Suppression de la partie (réinit joueurs);
 *  @param partie
 */
function supprimerPartie(partie) {
    console.log("Suppression de la partie " + partie);
    delete parties[partie];
}

/**********************************************************************
 ***                      Gestion des websockets                    ***
 **********************************************************************/

const NB_MANCHES_MAX = 3;

class Carte {
    valeur;
    couleur;

    constructor(valeur, couleur) {
        this.valeur = valeur;
        this.couleur = couleur;
    }

    toString() {
        return this.valeur + " de " + this.couleur;
    }
}

class Joueur {
    socket;
    main = [];
    pseudo;
    score = 0;

    constructor(socket, pseudo) {
        this.socket = socket;
        this.pseudo = pseudo;
    }

    retirerCarte(carte) {
        const index = this.main.findIndex((c) => c.valeur === carte.valeur && c.couleur === carte.couleur);
        if (index > -1) {
            this.main.splice(index, 1);
            return true;
        }
        return false;
    }

    ajouterCarte(carte) {
        this.main.push(carte);
    }

    ajouterCartes(cartes) {
        this.main.push(...cartes);
    }

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
    envoyerMain() {
        this.trierMain(true);
        this.socket.emit("main", this.main);
    }

    possedeCartes(cartes) {
        for (let carte of cartes) {
            const index = this.main.findIndex((c) => c.valeur === carte.valeur && c.couleur === carte.couleur);
            if (index === -1) {
                return false;
            }
        }
        return true;
    }

    getNbCartes() {
        return this.main.length;
    }

    getPseudo() {
        return this.pseudo;
    }

    getScore() {
        return this.score;
    }

    setScore(score) {
        this.score = score;
    }
}

io.on("connection", (socket) => {
    console.log("Un client est connecté : " + socket.id);

    let index = -1; // -1 : en attente de partie, 0 ou 1 position dans le tableau de joueurs.
    let partie = null; // numéro de partie à laquelle participe le joueur

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
     * Démarre une partie
     * @param {int} partie numéro de la partie
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

    socket.on("trier_carte", function (couleur) {
        if (!parties[partie] || index === -1) {
            socket.emit("erreur", "Partie introuvable.");
            return;
        }

        parties[partie].joueurs[index].trierMain(couleur);
        parties[partie].joueurs[index].socket.emit("main", parties[partie].joueurs[index].main);
    });

    /**
     * Gestion du jeu - un joueur joue une carte
     * @param {Array} carte tableau de carte jouée
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
        if (!parties[partie].joueurs[index].possedeCartes(cartesJouees) && cartesJouees.length > 0) {
            socket.emit("erreur", "Vous ne possédez pas toutes les cartes que vous essayez de jouer.");
            return;
        }

        console.log("Le joueur " + parties[partie].joueurs[index].pseudo + " joue la carte :", cartesJouees);

        // Gestion de la carte jouée
        // Vérifier si c'est la première manche
        if (parties[partie].premierTour) {
            console.log("Première manche - vérification de la carte jouée.");
            console.log("Cartes jouées :", carte);

            // Au premier tour, impossible de passer
            if (carte.length === 0) {
                socket.emit("erreur", "Vous devez jouer au moins une carte lors du premier tour.");
                return;
            }

            if (carte.length !== 1) {
                // si c'est toutes les cartes qu'il lui reste
                if (parties[partie].joueurs[index].getNbCartes() !== carte.length) {
                    socket.emit(
                        "erreur",
                        "Vous devez jouer une carte lors de la première manche ou toutes vos cartes seulement si elles ont toute la même valeur ou la même couleur."
                    );
                    console.log("Carte jouée invalide : plusieurs cartes jouées ou aucune carte jouée lors de la première manche.");
                    return;
                }
                // vérifier que toutes les cartes sont de la même valeur ou de la même couleur
                const valeurRef = cartesJouees[0].valeur;
                const couleurRef = cartesJouees[0].couleur;
                let memeValeur = true;
                let memeCouleur = true;
                for (let i = 1; i < cartesJouees.length; i++) {
                    if (cartesJouees[i].valeur !== valeurRef) {
                        memeValeur = false;
                    }
                    if (cartesJouees[i].couleur !== couleurRef) {
                        memeCouleur = false;
                    }
                }
                if (!memeValeur && !memeCouleur) {
                    socket.emit(
                        "erreur",
                        "Cartes jouées invalide. Lorsque vous jouez plusieurs cartes, elles doivent être de la même valeur ou de la même couleur."
                    );
                    return;
                }

                parties[partie].premierTour = false;

                for (let c of cartesJouees) {
                    parties[partie].joueurs[index].retirerCarte(c);
                }
                parties[partie].joueurs[index].envoyerMain();

                parties[partie].tasCartes = cartesJouees;

                finDeManche();
                return;
            }

            parties[partie].premierTour = false;

            //retirer la carte au joueur
            parties[partie].joueurs[index].retirerCarte(cartesJouees[0]);

            // lui renvoyer sa nouvelle main
            parties[partie].joueurs[index].envoyerMain();

            // Mettre à jour le tas de cartes jouées
            parties[partie].tasCartes = cartesJouees;

            // compteur de passes
            parties[partie].passesConsecutives = 0;
            parties[partie].dernierJoueurActif = index;

            // Passer au joueur suivant
            passerAuJoueurSuivant();
            return;
        }

        // aucune carte jouée, il passe son tour
        if (carte.length === 0) {
            console.log(parties[partie].joueurs[index].getPseudo() + " passe son tour.");

            parties[partie].passesConsecutives++;

            // si 2 passes consécutives fin du tour
            if (parties[partie].passesConsecutives === 2) {
                console.log("Deux passes consécutives, fin du tour.");
                finDuTour();
                return;
            }

            // passer au joueur suivant
            passerAuJoueurSuivant();
            return;
        }

        // si le nombre de cartes jouées n'est pas égal au nombre de cartes du tas ou au nombre de cartes du tas + 1
        const nbCartesTas = parties[partie].tasCartes.length;
        if (cartesJouees.length !== nbCartesTas && cartesJouees.length !== nbCartesTas + 1) {
            console.log("Carte jouée invalide : nombre de cartes jouées incorrect.");
            socket.emit("erreur", "Vous devez jouer " + nbCartesTas + " ou " + (nbCartesTas + 1) + " cartes.");
            return;
        }

        // si plusieurs cartes jouées, vérifier qu'elles sont toutes de la même valeur ou de la meme couleur
        if (cartesJouees.length > 1) {
            const valeurRef = cartesJouees[0].valeur;
            const couleurRef = cartesJouees[0].couleur;
            let memeValeur = true;
            let memeCouleur = true;
            for (let i = 1; i < cartesJouees.length; i++) {
                if (cartesJouees[i].valeur !== valeurRef) {
                    memeValeur = false;
                }
                if (cartesJouees[i].couleur !== couleurRef) {
                    memeCouleur = false;
                }
            }
            if (!memeValeur && !memeCouleur) {
                console.log("Carte jouée invalide : les cartes jouées ne sont pas de la même valeur ou de la même couleur.");
                socket.emit(
                    "erreur",
                    "Cartes jouées invalide. Lorsque vous jouez plusieurs cartes, elles doivent être de la même valeur ou de la même couleur."
                );
                return;
            }
        }

        // si la valeur des cartes jouées est inférieure à celle du tas
        if (plusGrandeValeur(cartesJouees) <= plusGrandeValeur(parties[partie].tasCartes)) {
            // si la valeur des cartes jouées est inférieure à celle du tas
            console.log("Carte jouée invalide : valeur des cartes jouées inférieure à celle du joueur précédent.");
            socket.emit("erreur", "Cartes jouées invalide. La valeur des cartes jouées doit être supérieure à celle du joueur précédent.");
            return;
        }

        // Retirer les cartes jouées de la main du joueur
        for (let c of cartesJouees) {
            parties[partie].joueurs[index].retirerCarte(c);
        }

        // Vérifier si le joueur a vidé sa main
        if (parties[partie].joueurs[index].getNbCartes() === 0) {
            console.log("Le joueur " + parties[partie].joueurs[index].pseudo + " a vidé sa main !");

            // Mettre à jour le tas avec les cartes jouées
            parties[partie].tasCartes = cartesJouees;

            // Envoyer la main vide au joueur
            parties[partie].joueurs[index].envoyerMain();

            // Fin de manche directe, pas de sélection dans le tas
            socket.emit("coup_valide");
            finDeManche();
            return;
        }

        // Le joueur a encore des cartes, il doit sélectionner une carte dans le tas
        parties[partie].passesConsecutives = 0;
        parties[partie].dernierJoueurActif = index;
        parties[partie].cartesEnCoursDejeu = cartesJouees;

        // Envoyer la main mise à jour au joueur
        parties[partie].joueurs[index].envoyerMain();

        socket.emit("coup_valide");
        socket.emit("selectionner_carte_dans_tas", parties[partie].tasCartes);
    });

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
     * Passe au joueur suivant
     * @param {number} partie - L'identifiant de la partie en cours
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
     * Transforme une carte brute en objet Carte
     * @param {*} carteBrute
     * @returns {Carte}
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
     * Fin du tour
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
     * Fin de manche - calcul des scores
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
            }, 3000);
        }
    }

    /**
     * Démarre une nouvelle manche
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
     * Fin de partie - annonce du gagnant
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
     *  Gestion des déconnexions
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
