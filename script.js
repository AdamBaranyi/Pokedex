let allPokemon = [];
let currentOffset = 0;
let isLoading = false;
let currentDetailId = 0;
const LIMIT = 30;

/**
 * Loads a batch of Pokemon from the PokeAPI.
 * Uses pagination via currentOffset.
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
 * Processes a list of Pokemon URLs, fetches details for each,
 * and updates the global list and UI.
 * @param {string[]} urls - List of Pokemon URLs to fetch.
 */
async function processPokemonBatch(urls) {
    const promises = urls.map(url => getPokemonDetails(url));
    const newPokemon = await Promise.all(promises);
    allPokemon = pushUnique(allPokemon, newPokemon);
    renderPokemonBatch(newPokemon);
}

/**
 * Helper to add new items to an array without duplicates (simplified).
 * @param {Array} original - Original array.
 * @param {Array} newItems - New items to add.
 * @returns {Array} Combined array.
 */
function pushUnique(original, newItems) {
    return [...original, ...newItems]; // Simplified for now
}

/**
 * Fetches or retrieves cached Pokemon details.
 * @param {string} url - The URL for the Pokemon data.
 * @returns {Promise<Object>} Pokemon details object.
 */
async function getPokemonDetails(url) {
    const id = getPokemonIdFromUrl(url);
    const cached = localStorage.getItem(`pokemon_${id}`);
    if (cached) return JSON.parse(cached);
    return await fetchAndCachePokemon(url, id);
}

/**
 * Fetches Pokemon data from API, simplifies it, and caches it.
 * @param {string} url - API URL.
 * @param {string} id - Pokemon ID.
 * @returns {Promise<Object>} Simplified Pokemon object.
 */
async function fetchAndCachePokemon(url, id) {
    const data = await (await fetch(url)).json();
    const simplified = simplifyPokemonData(data);
    trySaveToStorage(id, simplified);
    return simplified;
}

/**
 * Extracts Pokemon ID from its API URL.
 * @param {string} url - The URL (e.g., .../pokemon/1/).
 * @returns {string} The ID (e.g., "1").
 */
function getPokemonIdFromUrl(url) {
    return url.split('/').filter(Boolean).pop();
}

/**
 * Safely tries to save data to localStorage.
 * @param {string} id - Identifier key.
 * @param {Object} data - Data to stringify and save.
 */
function trySaveToStorage(id, data) {
    try { localStorage.setItem(`pokemon_${id}`, JSON.stringify(data)); } 
    catch (e) { }
}

/**
 * Reduces raw API data to essential fields needed for the app.
 * @param {Object} data - Raw API response.
 * @returns {Object} Simplified Pokemon object.
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
 * Renders a list of Pokemon cards to the DOM.
 * @param {Array} pokemonList - List of Pokemon objects to render.
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
 * Generates HTML for a single Pokemon card.
 * @param {Object} pokemon - Pokemon object.
 * @returns {string} HTML string.
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
 * Handles the "Load More" button click.
 * Loads either general Pokemon or typed-filtered Pokemon based on mode.
 */
function loadMorePokemon() {
    if (typeMode) {
        loadTypePokemon(currentTypeFilter);
    } else {
        loadPokemon();
    }
}

/**
 * Toggles the loading state UI (spinner, button disable).
 * @param {boolean} loading - True if loading, false otherwise.
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
 * Opens the specific Pokemon detail overlay.
 * Initiates async fetching of extra data (flavor text, evolution, etc.).
 * @param {number} id - The Pokemon ID to open.
 */
async function openDetail(id) {
    currentDetailId = id;
    const pokemon = allPokemon.find(p => p.id === id);
    if (!pokemon) return;

    let description = 'Loading description...';
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
 * Filters the displayed Pokemon by a specific type (or 'all').
 * Handles UI updates and data reloading.
 * @param {string} type - The type to filter by (e.g., 'fire', 'water').
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
 * Updates the visual state of filter buttons.
 * @param {string} type - The currently active type.
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
 * Resets the Pokedex data state (clear list, reset offset, clear search).
 */
function resetPokedexData() {
    allPokemon = [];
    currentOffset = 0;
    document.getElementById('pokedex-list').innerHTML = '';
    resetSearchForm();
}

/**
 * Loads a batch of Pokemon of a specific type.
 * @param {string} type - The type to load.
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
 * Fetches the list of all Pokemon for a specific type.
 * @param {string} type - The type name.
 */
async function fetchTypeData(type) {
    const data = await (await fetch(`https://pokeapi.co/api/v2/type/${type}`)).json();
    typePokemonList = data.pokemon.map(p => p.pokemon);
}

/**
 * Updates visibility of the 'Load More' button based on data availability.
 */
function updateLoadMoreButton() {
    const btn = document.getElementById('load-more-btn');
    btn.style.display = currentOffset >= typePokemonList.length ? 'none' : 'inline-block';
}


/**
 * Filters the current Pokemon list based on the search input.
 */
function searchPokemon() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const list = document.getElementById('pokedex-list');

    list.innerHTML = '';
    
    const filtered = allPokemon.filter(p => p.name.includes(query));

    updateSearchResult(filtered, list);
}

/**
 * Renders search results or shows an error message if none found.
 * @param {Array} filtered - Filtered Pokemon list.
 * @param {HTMLElement} list - DOM element container.
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
 * Handles key interactions in the search input (Enter key & validation).
 * @param {KeyboardEvent} event - The key event.
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
 * Navigate to the next Pokemon in the list.
 */
function nextPokemon() {
    const index = allPokemon.findIndex(p => p.id === currentDetailId);
    if (index >= 0 && index < allPokemon.length - 1) {
        openDetail(allPokemon[index + 1].id);
    }
}

/**
 * Navigate to the previous Pokemon in the list.
 */
function previousPokemon() {
    const index = allPokemon.findIndex(p => p.id === currentDetailId);
    if (index > 0) {
        openDetail(allPokemon[index - 1].id);
    }
}

/*Reset Pokedex*/

/**
 * Resets the Pokedex to its initial state (All types).
 */
function resetPokedex() {
    currentTypeFilter = null; 
    filterByType('all'); 
}

/* Filter Toggle */

/**
 * Toggles visibility of the filter menu on mobile devices.
 */
function toggleFilters() {
    const wrapper = document.getElementById('filter-wrapper');
    wrapper.classList.toggle('show');
}

/*Reset Search Form*/

/**
 * Clears the search input and resets error messages.
 */
function resetSearchForm() {
    document.getElementById('search-input').value = '';
    document.getElementById('error-message').classList.add('d-none');
    document.getElementById('search-button').disabled = true;
}

/*Initialization*/

/**
 * Initializes the application by loading initial data.
 */
function init() {
    resetSearchForm();
    loadPokemon();
}

