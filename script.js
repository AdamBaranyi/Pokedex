let allPokemon = [];
let currentOffset = 0;
let isLoading = false;
let currentDetailId = 0;
const LIMIT = 30;

// Lädt Pokémon von der API
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

// Verarbeitet eine Liste von Pokémon-URLs und lädt deren Details
async function processPokemonBatch(urls) {
    const promises = urls.map(url => getPokemonDetails(url));
    const newPokemon = await Promise.all(promises);
    allPokemon = pushUnique(allPokemon, newPokemon);
    renderPokemonBatch(newPokemon);
}

// Fügt neue Elemente zum Array hinzu
function pushUnique(original, newItems) {
    return [...original, ...newItems]; // Simplified for now
}

// Holt Pokémon-Details (aus Cache oder API)
async function getPokemonDetails(url) {
    const id = getPokemonIdFromUrl(url);
    const cached = localStorage.getItem(`pokemon_${id}`);
    if (cached) return JSON.parse(cached);
    return await fetchAndCachePokemon(url, id);
}

// Lädt Daten von der API und speichert sie im Cache
async function fetchAndCachePokemon(url, id) {
    const data = await (await fetch(url)).json();
    const simplified = simplifyPokemonData(data);
    trySaveToStorage(id, simplified);
    return simplified;
}

// Extrahiert die ID aus der URL
function getPokemonIdFromUrl(url) {
    return url.split('/').filter(Boolean).pop();
}

// Speichert Daten sicher im LocalStorage
function trySaveToStorage(id, data) {
    try { localStorage.setItem(`pokemon_${id}`, JSON.stringify(data)); } 
    catch (e) { }
}

// Vereinfacht die API-Daten für die App
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

// Zeigt die Pokémon-Liste im HTML an
function renderPokemonBatch(pokemonList) {
    const list = document.getElementById('pokedex-list');
    let html = '';
    pokemonList.forEach(p => {
        html += getCardHtml(p);
    });
    list.innerHTML += html;
}

// Erstellt das HTML für eine einzelne Karte
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

// Lädt mehr Pokémon (alle oder gefiltert)
function loadMorePokemon() {
    if (typeMode) {
        loadTypePokemon(currentTypeFilter);
    } else {
        loadPokemon();
    }
}

// Steuert die Ladeanzeige
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

// Öffnet die Detailansicht eines Pokémon
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

let currentTypeFilter = 'all';
let typeMode = false;
let typePokemonList = []; 

// Filtert Pokémon nach Typ
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

// Aktualisiert die Filter-Buttons
function updateFilterUI(type) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.toLowerCase() === type || (type === 'all' && btn.innerText === 'All')) {
            btn.classList.add('active');
        }
    });
}

// Setzt die Pokedex-Daten zurück
function resetPokedexData() {
    allPokemon = [];
    currentOffset = 0;
    document.getElementById('pokedex-list').innerHTML = '';
    resetSearchForm();
}

// Lädt Pokémon eines bestimmten Typs
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

// Holt alle Pokémon eines Typs von der API
async function fetchTypeData(type) {
    const data = await (await fetch(`https://pokeapi.co/api/v2/type/${type}`)).json();
    typePokemonList = data.pokemon.map(p => p.pokemon);
}

// Aktualisiert den 'Mehr laden'-Button
function updateLoadMoreButton() {
    const btn = document.getElementById('load-more-btn');
    btn.style.display = currentOffset >= typePokemonList.length ? 'none' : 'inline-block';
}


// Sucht nach Pokémon
function searchPokemon() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const list = document.getElementById('pokedex-list');

    list.innerHTML = '';
    
    const filtered = allPokemon.filter(p => p.name.includes(query));

    updateSearchResult(filtered, list);
}

// Zeigt Suchergebnisse an
function updateSearchResult(filtered, list) {
    if (filtered.length === 0) {
        document.getElementById('error-message').classList.remove('d-none');
    } else {
        document.getElementById('error-message').classList.add('d-none');
        list.innerHTML = filtered.map(p => getCardHtml(p)).join('');
    }
}

// Überprüft Eingabe im Suchfeld
function handleSearchKeyUp(event) {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('search-button');
    const query = input.value.toLowerCase();
    const isValid = query.length >= 3;
    
    btn.disabled = !isValid;

    if (isValid) {
        searchPokemon();
    } else if (query.length === 0) {
        resetPokedex();
    }
}

// Geht zum nächsten Pokémon
function nextPokemon() {
    const index = allPokemon.findIndex(p => p.id === currentDetailId);
    if (index >= 0 && index < allPokemon.length - 1) {
        openDetail(allPokemon[index + 1].id);
    }
}

// Geht zum vorherigen Pokémon
function previousPokemon() {
    const index = allPokemon.findIndex(p => p.id === currentDetailId);
    if (index > 0) {
        openDetail(allPokemon[index - 1].id);
    }
}

// Setzt den Pokedex komplett zurück
function resetPokedex() {
    currentTypeFilter = null; 
    filterByType('all'); 
}

// Zeigt/Versteckt Filter auf Mobile
function toggleFilters() {
    const wrapper = document.getElementById('filter-wrapper');
    wrapper.classList.toggle('show');
}

// Leert das Suchformular
function resetSearchForm() {
    document.getElementById('search-input').value = '';
    document.getElementById('error-message').classList.add('d-none');
    document.getElementById('search-button').disabled = true;
}

// Initialisiert die App
function init() {
    resetSearchForm();
    loadPokemon();
}


