# Pokedex App

Eine moderne, responsive Pokedex-Webanwendung, entwickelt mit JavaScript, HTML und CSS. Sie nutzt die [PokeAPI](https://pokeapi.co/), um Pokemon-Daten in einer ansprechenden Benutzeroberfläche anzuzeigen.

## Funktionen

- **Dynamisches Pokemon-Raster**: Lädt und zeigt Pokemon mit Lazy Loading an.
- **Typen-Filter**: Filtere Pokemon nach Typ (z.B. Feuer, Wasser) direkt über die API.
- **Suchfunktion**: Suche nach Namen (Startet mit Enter oder Klick).
- **Detailansicht & Evolution**: Zeigt Stats und die komplette Entwicklungskette an.
- **Reset-Funktion**: Klicke auf das Logo, um die App zurückzusetzen.
- **Effiziente Datenverarbeitung**: Nutzt LocalStorage zum Cachen von Details & Evolutionen.
- **Modernes Design**: Dynamische Hintergrundfarben je nach Typ und Pokeball-Ladeanimation.
- **Responsive Design**: Optimiert für Desktop und Mobile.

## Tech Stack

- **HTML5**: Für die semantische Struktur.
- **CSS3**: Für das Styling (Flexbox, Grid, Responsive Design).
- **JavaScript**: Für die Logik, API-Kommunikation und DOM-Manipulation.
- **PokeAPI**: Externe REST-API für Pokemon-Daten.

## Installation & Nutzung

1.  Repository klonen.
2.  `index.html` im Browser öffnen.
3.  Viel Spaß beim Entdecken der Pokemon-Welt!

## Projektstruktur

- `index.html`: Hauptstruktur und Container-Elemente.
- `style.css`: Basis-Styles & Layout.
- `components.css`: UI-Komponenten (Karten, Buttons, Overlay).
- `responsive.css`: Media Queries für mobile Anpassungen.
- `script.js`: Kern-Logik (Initialisierung, Suche, Liste).
- `features.js`: Detail-Features (Overlay, Evolution, Typ-Effektivität).

