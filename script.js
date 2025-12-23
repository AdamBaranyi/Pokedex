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
    loadPokemon();
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
}

/* Evolution Chain Logic */
async function loadEvolutionChain(pokemon) {
    const cached = localStorage.getItem(`evo_chain_${pokemon.id}`);
    if (cached) { renderEvolutionChain(JSON.parse(cached)); return; }

    try {
        const species = await (await fetch(pokemon.speciesUrl)).json();
        const chainData = await (await fetch(species.evolution_chain.url)).json();
        const chain = parseEvolutionChain(chainData.chain);
        
        trySaveToStorage(`evo_chain_${pokemon.id}`, chain);
        renderEvolutionChain(chain);
    } catch (e) { console.error('Evo Error:', e); }
}

function parseEvolutionChain(chain) {
    const result = [];
    let current = chain;
    while (current) {
        const id = getPokemonIdFromUrl(current.species.url);
        result.push({
            name: current.species.name, id: id,
            image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
        });
        current = current.evolves_to[0];
    }
    return result;
}

function renderEvolutionChain(chain) {
    const container = document.getElementById('evolution-container');
    if (container) {
        container.innerHTML = chain.map(p => `
            <div class="evo-card" onclick="openDetail(${p.id})">
                <img src="${p.image}" alt="${p.name}">
                <span>${p.name}</span>
            </div>
        `).join('<span class="evo-arrow">→</span>');
    }
}

async function fetchFlavorText(url) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        const entry = data.flavor_text_entries.find(e => e.language.name === 'en');
        return entry ? entry.flavor_text.replace(/\f/g, ' ') : 'No description available.';
    } catch {
        return 'Could not load description.';
    }
}

function renderOverlay(pokemon, description) {
    const container = document.getElementById('overlay-pokemon-data');
    container.innerHTML = getOverlayHtml(pokemon, description);
}

function getOverlayHtml(pokemon, description) {
    return `
        <img src="${pokemon.image}" class="detail-img">
        <h2 class="pokemon-name" style="font-size: 2.5rem">${pokemon.name}</h2>
        <div>
            ${pokemon.types.map(t => `<span class="type-badge bg-${t}">${t}</span>`).join('')}
        </div>
        <p style="margin: 1rem 0; font-style: italic;">${description}</p>
        <div class="detail-stats">
            ${getStatsHtml(pokemon.stats)}
        </div>
        <h3 style="margin-top: 1.5rem;">Evolution</h3>
        <div id="evolution-container" class="evolution-container">Loading...</div>
    `;
}

function getStatsHtml(stats) {
    return stats.map(s => `
        <div class="stat-row">
            <span>${formatStatName(s.stat.name)}</span>
            <strong>${s.base_stat}</strong>
        </div>
    `).join('');
}

function formatStatName(name) {
    return name
        .replace('special-', 'Sp. ')
        .replace('attack', 'Atk')
        .replace('defense', 'Def')
        .replace('hp', 'Hp')
        .replace('speed', 'Speed');
}

function closeOverlay(event) {
    if (event) event.preventDefault();
    document.getElementById('overlay').classList.add('d-none');
    document.body.style.overflow = 'auto';
}

/*Search Logic*/
function searchPokemon() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const list = document.getElementById('pokedex-list');

    if (query.length < 3) return;

    list.innerHTML = '';
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

function checkSearchInput() {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('search-button');
    btn.disabled = input.value.length < 3;
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
function resetPokedex() {
    currentOffset = 0;
    allPokemon = [];
    document.getElementById('pokedex-list').innerHTML = '';
    resetSearchForm();
    loadPokemon();
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

