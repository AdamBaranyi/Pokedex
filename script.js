/*Global Constants*/
let allPokemon = [];
let currentOffset = 0;
let isLoading = false;
let currentDetailId = 0;
const LIMIT = 30; // Between 20 and 40

/* Main Fetch Function*/
async function loadPokemon() {
    if (isLoading) return;
    setLoadingState(true);
    const url = `https://pokeapi.co/api/v2/pokemon?limit=${LIMIT}&offset=${currentOffset}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const promises = data.results.map(p => getPokemonDetails(p.url));
        const newPokemon = await Promise.all(promises);

        allPokemon = [...allPokemon, ...newPokemon];
        renderPokemonBatch(newPokemon);
        currentOffset += LIMIT;
    } catch (e) {
        console.error('Error:', e);
    } finally {
        setLoadingState(false);
    }
}

/* Get Details (with Caching)*/
async function getPokemonDetails(url) {
    const id = getPokemonIdFromUrl(url);
    const cached = localStorage.getItem(`pokemon_${id}`);
    if (cached) return JSON.parse(cached);

    const response = await fetch(url);
    const data = await response.json();
    const simplified = simplifyPokemonData(data);

    trySaveToStorage(id, simplified);
    return simplified;
}

function getPokemonIdFromUrl(url) {
    return url.split('/').filter(Boolean).pop();
}

function trySaveToStorage(id, data) {
    try {
        localStorage.setItem(`pokemon_${id}`, JSON.stringify(data));
    } catch (e) { /* Ignore quota errors */ }
}

/* Data Simplification*/
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

/*Render Batch*/
function renderPokemonBatch(pokemonList) {
    const list = document.getElementById('pokedex-list');
    let html = '';
    pokemonList.forEach(p => {
        html += getCardHtml(p);
    });
    list.innerHTML += html;
}

/*Card Template*/
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

/*Load More Handler*/
function loadMorePokemon() {
    if (typeMode) {
        loadTypePokemon(currentTypeFilter);
    } else {
        loadPokemon();
    }
}

/*Loading State*/
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
async function openDetail(id) {
    currentDetailId = id;
    const pokemon = allPokemon.find(p => p.id === id);
    if (!pokemon) return;
    // Lazy Load Species Data (Description)
    let description = 'Loading description...';
    renderOverlay(pokemon, description);
    document.getElementById('overlay').classList.remove('d-none');
    document.body.style.overflow = 'hidden';

    description = await fetchFlavorText(pokemon.speciesUrl);
    renderOverlay(pokemon, description);
    loadEvolutionChain(pokemon);
    loadTypeRelations(pokemon);
}

/* Type Relations Logic managed in features.js */
/* Evolution Chain Logic managed in features.js */

/*Search Logic*/
/*Search & Filter Logic*/
let currentTypeFilter = 'all';
let typeMode = false;
let typePokemonList = []; // Stores the full list of {name, url} for the selected type

async function filterByType(type) {
    if (currentTypeFilter === type) return;
    currentTypeFilter = type;
    
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.toLowerCase() === type || (type === 'all' && btn.innerText === 'All')) {
            btn.classList.add('active');
        }
    });

    // Reset List
    allPokemon = [];
    currentOffset = 0;
    document.getElementById('pokedex-list').innerHTML = '';
    resetSearchForm();

    if (type === 'all') {
        typeMode = false;
        loadPokemon();
    } else {
        typeMode = true;
        await loadTypePokemon(type);
    }
}

async function loadTypePokemon(type) {
    setLoadingState(true);
    try {
        if (currentOffset === 0) {
           const response = await fetch(`https://pokeapi.co/api/v2/type/${type}`);
           const data = await response.json();
           typePokemonList = data.pokemon.map(p => p.pokemon);
        }

        const batch = typePokemonList.slice(currentOffset, currentOffset + LIMIT);
        const promises = batch.map(p => getPokemonDetails(p.url));
        const newPokemon = await Promise.all(promises);

        allPokemon = [...allPokemon, ...newPokemon];
        renderPokemonBatch(newPokemon);
        currentOffset += LIMIT;

        // Hide Load More if end reached
        if (currentOffset >= typePokemonList.length) {
             document.getElementById('load-more-btn').style.display = 'none';
        } else {
             document.getElementById('load-more-btn').style.display = 'inline-block';
        }

    } catch (e) {
        console.error('Type Load Error:', e);
    } finally {
        setLoadingState(false);
    }
}


function searchPokemon() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const list = document.getElementById('pokedex-list');

    list.innerHTML = '';
    
    // In typeMode, we filter the ALREADY LOADED pokemon from that type
    // Note: To search the ENTIRE type list would require loading all of them, which we skip for performance.
    // We stick to searching currently rendered items.
    const filtered = allPokemon.filter(p => p.name.includes(query));

    updateSearchResult(filtered, list);
}

function updateSearchResult(filtered, list) {
    if (filtered.length === 0) {
        document.getElementById('error-message').classList.remove('d-none');
    } else {
        document.getElementById('error-message').classList.add('d-none');
        filtered.forEach(p => list.innerHTML += getCardHtml(p));
    }
}

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
function nextPokemon() {
    const index = allPokemon.findIndex(p => p.id === currentDetailId);
    if (index >= 0 && index < allPokemon.length - 1) {
        openDetail(allPokemon[index + 1].id);
    }
}

function previousPokemon() {
    const index = allPokemon.findIndex(p => p.id === currentDetailId);
    if (index > 0) {
        openDetail(allPokemon[index - 1].id);
    }
}
/*Reset Pokedex*/
/*Reset Pokedex*/
function resetPokedex() {
    currentTypeFilter = null; // Force value change to trigger reload
    filterByType('all'); 
}

function resetSearchForm() {
    document.getElementById('search-input').value = '';
    document.getElementById('error-message').classList.add('d-none');
    document.getElementById('search-button').disabled = true;
}

/*Initialization*/
function init() {
    resetSearchForm();
    loadPokemon();
}

