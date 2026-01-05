/**
 * Fetches the English flavor text (description) for a Pokemon species.
 * @param {string} url - The URL of the species data.
 * @returns {Promise<string>} The flavor text or a fallback message.
 */
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

/**
 * Renders the Pokemon details overlay with data and description.
 * @param {Object} pokemon - The Pokemon data object.
 * @param {string} description - The flavor text description.
 */
function renderOverlay(pokemon, description) {
    const container = document.getElementById('overlay-pokemon-data');
    
    container.className = 'pokemon-detail-card';
    container.classList.add(`bg-${pokemon.types[0]}`);

    container.innerHTML = getOverlayHtml(pokemon, description);
}

/**
 * Generates the HTML string for the overlay content.
 * @param {Object} pokemon - The Pokemon data object.
 * @param {string} description - The flavor text description.
 * @returns {string} The HTML string.
 */
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
        
        <div id="type-relations-container" class="type-relations-container">Loading relations...</div>

        <h3 style="margin-top: 1.5rem;">Evolution</h3>
        <div id="evolution-container" class="evolution-container">Loading...</div>
    `;
}

/**
 * Generates HTML for the Pokemon's stats.
 * @param {Array} stats - Array of stat objects.
 * @returns {string} HTML string for stats.
 */
function getStatsHtml(stats) {
    return stats.map(s => `
        <div class="stat-row">
            <span>${formatStatName(s.stat.name)}</span>
            <strong>${s.base_stat}</strong>
        </div>
    `).join('');
}

/**
 * Formats stat names for better readability (e.g., 'special-attack' -> 'Sp. Atk').
 * @param {string} name - The raw stat name.
 * @returns {string} The formatted name.
 */
function formatStatName(name) {
    return name
        .replace('special-', 'Sp. ')
        .replace('attack', 'Atk')
        .replace('defense', 'Def')
        .replace('hp', 'Hp')
        .replace('speed', 'Speed');
}

/**
 * Closes the detail overlay and restores body scrolling.
 * @param {Event} event - The click event (optional).
 */
function closeOverlay(event) {
    if (event) event.preventDefault();
    document.getElementById('overlay').classList.add('d-none');
    document.body.style.overflow = 'auto';
}

/**
 * Loads and calculates type relations (strengths/weaknesses) for a Pokemon.
 * Uses caching to minimize API requests.
 * @param {Object} pokemon - The Pokemon data object.
 */
async function loadTypeRelations(pokemon) {
    const cached = localStorage.getItem(`type_relations_${pokemon.id}`);
    if (cached) { renderTypeRelations(JSON.parse(cached)); return; }

    try {
        const typeData = await fetchDamageRelations(pokemon.types);
        const relations = calculateTypeRelations(typeData);

        trySaveToStorage(`type_relations_${pokemon.id}`, relations);
        renderTypeRelations(relations);
    } catch (e) { console.error('Relations Error:', e); }
}

/**
 * Fetches damage relation data for a list of types.
 * @param {Array<string>} types - List of type names.
 * @returns {Promise<Array>} Array of damage relation data.
 */
async function fetchDamageRelations(types) {
    return Promise.all(types.map(t => fetch(`https://pokeapi.co/api/v2/type/${t}`).then(res => res.json())));
}

/**
 * Calculates strong/weak relations based on type data.
 * @param {Array} typeData - Raw type data from API.
 * @returns {Object} Object containing arrays of strong and weak type names.
 */
function calculateTypeRelations(typeData) {
    const relations = { strong: new Set(), weak: new Set() };
    typeData.forEach(data => {
        data.damage_relations.double_damage_to.forEach(t => relations.strong.add(t.name));
        data.damage_relations.double_damage_from.forEach(t => relations.weak.add(t.name));
    });
    return { strong: Array.from(relations.strong), weak: Array.from(relations.weak) };
}

/**
 * Renders the type relations block in the overlay.
 * @param {Object} relations - Object with strong/weak arrays.
 */
function renderTypeRelations(relations) {
    const container = document.getElementById('type-relations-container');
    if (!container) return; // Wait for overlay render

    container.innerHTML = `
        <div class="relation-group">
            <span class="relation-title">Strong Against</span>
            <div class="relation-tags">
                ${relations.strong.length ? relations.strong.map(type => `<span class="type-badge bg-${type}">${type}</span>`).join('') : '<span>-</span>'}
            </div>
        </div>
        <div class="relation-group">
            <span class="relation-title">Weak Against</span>
            <div class="relation-tags">
                ${relations.weak.length ? relations.weak.map(type => `<span class="type-badge bg-${type}">${type}</span>`).join('') : '<span>-</span>'}
            </div>
        </div>
    `;
}

/* Evolution Chain */

/**
 * Loads and renders the evolution chain for a Pokemon.
 * Uses caching.
 * @param {Object} pokemon - The Pokemon data object.
 */
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

/**
 * Parses the recursive evolution chain data into a flat array.
 * @param {Object} chain - The recursive chain object.
 * @returns {Array} Array of evolution stages.
 */
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

/**
 * Renders the evolution chain cards.
 * @param {Array} chain - List of evolution stages.
 */
function renderEvolutionChain(chain) {
    const container = document.getElementById('evolution-container');
    if (container) {
        container.innerHTML = chain.map(p => `
            <div class="evo-card" onclick="openDetail(${p.id})">
                <img src="${p.image}" alt="${p.name}">
                <span style="text-transform: capitalize;">${p.name}</span>
            </div>
        `).join('<span class="evo-arrow">→</span>');
    }
}
