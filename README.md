# Ludo

Jeu de Ludo local, en français, jouable à 2, 3 ou 4 sur le même écran. Le projet utilise HTML, CSS et JavaScript sans dépendances ni étape de compilation.

## Lancer le jeu

Ouvrez `index.html` dans un navigateur récent. Dans **Paramètres**, choisissez le nombre de joueurs et leurs couleurs. Les règles complètes sont accessibles avec le bouton **Règles**.

Chaque joueur lance le dé placé dans sa base lorsque son tour arrive. Les déplacements se font case par case ; le jeu choisit automatiquement l'unique coup possible. Trois six consécutifs annulent le troisième lancer et font passer le tour. Un pion arrivé au centre disparaît du plateau et est comptabilisé par un repère dans sa base. Les pions sur une même case se rangent en grille et se réduisent pour rester dans la case.

Les règles sont présentées dans `index.html`; la logique et l'état de la partie se trouvent dans `game.js`, et la mise en page dans `styles.css`.

Le jeu produit aussi des effets sonores synthétiques : bruit rythmé pendant l'animation du dé et mélodie lorsqu'un pion adverse est capturé.
