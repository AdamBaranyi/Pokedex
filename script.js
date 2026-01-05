let allPokemon = [];
let currentOffset = 0;
let isLoading = false;
let currentDetailId = 0;
const LIMIT = 30;

/**
 * Lädt eine Charge von Pokémon von der PokeAPI.
 * Verwendet Paginierung über currentOffset.
 */
async function loadPokemon() {
    if (isLoading) return;
    setLoadingState(true);
    try {
        const url = `https://pokeapi.co/api/v2/pokemon?limit=${LIMIT}&offset=${currentOffset}`;
        const data = await (await fetch(url)).json();
        await processPokemonBatch(data.results.map(p => p.url));
        currentOffset += LIMIT;
    } catch (e) { console.error('Error:', e); } 
    finally { setLoadingState(false); }
}

/**
 * Verarbeitet eine Liste von Pokémon-URLs, ruft Details für jedes ab
 * und aktualisiert die globale Liste und die Benutzeroberfläche.
 * @param {string[]} urls - Liste der abzurufenden Pokémon-URLs.
 */
async function processPokemonBatch(urls) {
    const promises = urls.map(url => getPokemonDetails(url));
    const newPokemon = await Promise.all(promises);
    allPokemon = pushUnique(allPokemon, newPokemon);
    renderPokemonBatch(newPokemon);
}

/**
 * Hilfsfunktion zum Hinzufügen neuer Elemente zu einem Array ohne Duplikate (vereinfacht).
 * @param {Array} original - Ursprüngliches Array.
 * @param {Array} newItems - Neue hinzuzufügende Elemente.
 * @returns {Array} Kombiniertes Array.
 */
function pushUnique(original, newItems) {
    return [...original, ...newItems]; // Simplified for now
}

/**
 * Ruft Pokémon-Details ab oder lädt sie aus dem Cache.
 * @param {string} url - Die URL für die Pokémon-Daten.
 * @returns {Promise<Object>} Pokémon-Detailobjekt.
 */
async function getPokemonDetails(url) {
    const id = getPokemonIdFromUrl(url);
    const cached = localStorage.getItem(`pokemon_${id}`);
    if (cached) return JSON.parse(cached);
    return await fetchAndCachePokemon(url, id);
}

/**
 * Ruft Pokémon-Daten von der API ab, vereinfacht sie und speichert sie im Cache.
 * @param {string} url - API-URL.
 * @param {string} id - Pokémon-ID.
 * @returns {Promise<Object>} Vereinfachtes Pokémon-Objekt.
 */
async function fetchAndCachePokemon(url, id) {
    const data = await (await fetch(url)).json();
    const simplified = simplifyPokemonData(data);
    trySaveToStorage(id, simplified);
    return simplified;
}

/**
 * Extrahiert die Pokémon-ID aus ihrer API-URL.
 * @param {string} url - Die URL (z.B. .../pokemon/1/).
 * @returns {string} Die ID (z.B. "1").
 */
function getPokemonIdFromUrl(url) {
    return url.split('/').filter(Boolean).pop();
}

/**
 * Versucht sicher, Daten im localStorage zu speichern.
 * @param {string} id - Identifikationsschlüssel.
 * @param {Object} data - Zu stringifizierende und speichernde Daten.
 */
function trySaveToStorage(id, data) {
    try { localStorage.setItem(`pokemon_${id}`, JSON.stringify(data)); } 
    catch (e) { }
}

/**
 * Reduziert rohe API-Daten auf die für die App benötigten wesentlichen Felder.
 * @param {Object} data - Rohe API-Antwort.
 * @returns {Object} Vereinfachtes Pokémon-Objekt.
 */
function simplifyPokemonData(data) {
    return {
        id: data.id,
        name: data.name,
        types: data.types.map(t => t.type.name),
        image: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
        stats: data.stats,
        speciesUrl: data.species.url
    };
}

/**
 * Rendert eine Liste von Pokémon-Karten in das DOM.
 * @param {Array} pokemonList - Liste der zu rendernden Pokémon-Objekte.
 */
function renderPokemonBatch(pokemonList) {
    const list = document.getElementById('pokedex-list');
    let html = '';
    pokemonList.forEach(p => {
        html += getCardHtml(p);
    });
    list.innerHTML += html;
}

/**
 * Generiert HTML für eine einzelne Pokémon-Karte.
 * @param {Object} pokemon - Pokémon-Objekt.
 * @returns {string} HTML-String.
 */
function getCardHtml(pokemon) {
    const mainType = pokemon.types[0];
    return `
    <div class="pokemon-card bg-${mainType}" onclick="openDetail(${pokemon.id})">
        <span class="type-badge">#${pokemon.id}</span>
        <img src="${pokemon.image}" class="pokemon-image" alt="${pokemon.name}" loading="lazy">
        <h2 class="pokemon-name">${pokemon.name}</h2>
        <div class="types-container">
            ${pokemon.types.map(t => `<span class="type-badge">${t}</span>`).join('')}
        </div>
    </div>`;
}

/**
 * Behandelt den Klick auf den "Mehr laden"-Button.
 * Lädt entweder allgemeine Pokémon oder nach Typ gefilterte Pokémon, basierend auf dem Modus.
 */
function loadMorePokemon() {
    if (typeMode) {
        loadTypePokemon(currentTypeFilter);
    } else {
        loadPokemon();
    }
}

/**
 * Schaltet die Ladezustands-UI um (Spinner, Button deaktivieren).
 * @param {boolean} loading - True wenn geladen wird, sonst false.
 */
function setLoadingState(loading) {
    isLoading = loading;
    const spinner = document.getElementById('loading-container');
    const loadBtn = document.getElementById('load-more-btn');

    if (loading) {
        spinner.classList.remove('d-none');
        loadBtn.disabled = true;
    } else {
        spinner.classList.add('d-none');
        loadBtn.disabled = false;
    }
}

/* Details / Lazy Loading*/

/**
 * Öffnet das spezifische Pokémon-Detail-Overlay.
 * Startet das asynchrone Abrufen zusätzlicher Daten (Beschreibungstext, Entwicklung usw.).
 * @param {number} id - Die zu öffnende Pokémon-ID.
 */
async function openDetail(id) {
    currentDetailId = id;
    const pokemon = allPokemon.find(p => p.id === id);
    if (!pokemon) return;

    let description = 'Lade Beschreibung...';
    renderOverlay(pokemon, description);
    document.getElementById('overlay').classList.remove('d-none');
    document.body.style.overflow = 'hidden';

    description = await fetchFlavorText(pokemon.speciesUrl);
    renderOverlay(pokemon, description);
    loadEvolutionChain(pokemon);
    loadTypeRelations(pokemon);
}




/*Search & Filter Logic*/
let currentTypeFilter = 'all';
let typeMode = false;
let typePokemonList = []; 

/**
 * Filtert die angezeigten Pokémon nach einem bestimmten Typ (oder 'all').
 * Behandelt UI-Aktualisierungen und das Neuladen von Daten.
 * @param {string} type - Der zu filternde Typ (z.B. 'fire', 'water').
 */
async function filterByType(type) {
    if (currentTypeFilter === type) return;
    currentTypeFilter = type;
    updateFilterUI(type);
    resetPokedexData();

    if (type === 'all') {
        typeMode = false;
        loadPokemon();
    } else {
        typeMode = true;
        await loadTypePokemon(type);
    }
}

/**
 * Aktualisiert den visuellen Zustand der Filter-Buttons.
 * @param {string} type - Der aktuell aktive Typ.
 */
function updateFilterUI(type) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.toLowerCase() === type || (type === 'all' && btn.innerText === 'All')) {
            btn.classList.add('active');
        }
    });
}

/**
 * Setzt den Pokedex-Datenzustand zurück (Liste leeren, Offset zurücksetzen, Suche leeren).
 */
function resetPokedexData() {
    allPokemon = [];
    currentOffset = 0;
    document.getElementById('pokedex-list').innerHTML = '';
    resetSearchForm();
}

/**
 * Lädt eine Charge von Pokémon eines bestimmten Typs.
 * @param {string} type - Der zu ladende Typ.
 */
async function loadTypePokemon(type) {
    setLoadingState(true);
    try {
        if (currentOffset === 0) await fetchTypeData(type);
        const batch = typePokemonList.slice(currentOffset, currentOffset + LIMIT);
        await processPokemonBatch(batch.map(p => p.url));
        
        currentOffset += LIMIT;
        updateLoadMoreButton();
    } catch (e) {
        console.error('Type Load Error:', e);
    } finally { setLoadingState(false); }
}

/**
 * Ruft die Liste aller Pokémon für einen bestimmten Typ ab.
 * @param {string} type - Der Typ-Name.
 */
async function fetchTypeData(type) {
    const data = await (await fetch(`https://pokeapi.co/api/v2/type/${type}`)).json();
    typePokemonList = data.pokemon.map(p => p.pokemon);
}

/**
 * Aktualisiert die Sichtbarkeit des 'Mehr laden'-Buttons basierend auf Datenverfügbarkeit.
 */
function updateLoadMoreButton() {
    const btn = document.getElementById('load-more-btn');
    btn.style.display = currentOffset >= typePokemonList.length ? 'none' : 'inline-block';
}


/**
 * Filtert die aktuelle Pokémon-Liste basierend auf der Sucheingabe.
 */
function searchPokemon() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const list = document.getElementById('pokedex-list');

    list.innerHTML = '';
    
    const filtered = allPokemon.filter(p => p.name.includes(query));

    updateSearchResult(filtered, list);
}

/**
 * Rendert Suchergebnisse oder zeigt eine Fehlermeldung, wenn keine gefunden wurden.
 * @param {Array} filtered - Gefilterte Pokémon-Liste.
 * @param {HTMLElement} list - DOM-Element-Container.
 */
function updateSearchResult(filtered, list) {
    if (filtered.length === 0) {
        document.getElementById('error-message').classList.remove('d-none');
    } else {
        document.getElementById('error-message').classList.add('d-none');
        filtered.forEach(p => list.innerHTML += getCardHtml(p));
    }
}

/**
 * Behandelt Tasteninteraktionen im Suchfeld (Enter-Taste & Validierung).
 * @param {KeyboardEvent} event - Das Tastenereignis.
 */
function handleSearchKeyUp(event) {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('search-button');
    const isValid = input.value.length >= 3;
    
    btn.disabled = !isValid;

    if (event.key === 'Enter' && isValid) {
        searchPokemon();
    }
}

/*Navigation*/

/**
 * Navigiert zum nächsten Pokémon in der Liste.
 */
function nextPokemon() {
    const index = allPokemon.findIndex(p => p.id === currentDetailId);
    if (index >= 0 && index < allPokemon.length - 1) {
        openDetail(allPokemon[index + 1].id);
    }
}

/**
 * Navigiert zum vorherigen Pokémon in der Liste.
 */
function previousPokemon() {
    const index = allPokemon.findIndex(p => p.id === currentDetailId);
    if (index > 0) {
        openDetail(allPokemon[index - 1].id);
    }
}

/*Reset Pokedex*/

/**
 * Setzt den Pokedex auf seinen Anfangszustand zurück (Alle Typen).
 */
function resetPokedex() {
    currentTypeFilter = null; 
    filterByType('all'); 
}

/* Filter Toggle */

/**
 * Schaltet die Sichtbarkeit des Filtermenüs auf Mobilgeräten um.
 */
function toggleFilters() {
    const wrapper = document.getElementById('filter-wrapper');
    wrapper.classList.toggle('show');
}

/*Reset Search Form*/

/**
 * Leert das Suchfeld und setzt Fehlermeldungen zurück.
 */
function resetSearchForm() {
    document.getElementById('search-input').value = '';
    document.getElementById('error-message').classList.add('d-none');
    document.getElementById('search-button').disabled = true;
}

/*Initialization*/

/**
 * Initialisiert die Anwendung durch Laden der ersten Daten.
 */
function init() {
    resetSearchForm();
    loadPokemon();
}

