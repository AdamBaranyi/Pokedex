/**
 * Ruft den englischen Beschreibungstext für eine Pokémon-Spezies ab.
 * @param {string} url - Die URL der Spezies-Daten.
 * @returns {Promise<string>} Der Beschreibungstext oder eine Fallback-Nachricht.
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
 * Rendert das Pokémon-Detail-Overlay mit Daten und Beschreibung.
 * @param {Object} pokemon - Das Pokémon-Datenobjekt.
 * @param {string} description - Die Textbeschreibung.
 */
function renderOverlay(pokemon, description) {
    const container = document.getElementById('overlay-pokemon-data');
    
    container.className = 'pokemon-detail-card';
    container.classList.add(`bg-${pokemon.types[0]}`);

    container.innerHTML = getOverlayHtml(pokemon, description);
}

/**
 * Generiert den HTML-String für den Overlay-Inhalt.
 * @param {Object} pokemon - Das Pokémon-Datenobjekt.
 * @param {string} description - Die Textbeschreibung.
 * @returns {string} Der HTML-String.
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
 * Generiert HTML für die Pokémon-Statistiken.
 * @param {Array} stats - Array von Statistik-Objekten.
 * @returns {string} HTML-String für Statistiken.
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
 * Formatiert Statistik-Namen für bessere Lesbarkeit (z.B. 'special-attack' -> 'Sp. Atk').
 * @param {string} name - Der rohe Statistik-Name.
 * @returns {string} Der formatierte Name.
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
 * Schließt das Detail-Overlay und stellt das Scrollen des Body wieder her.
 * @param {Event} event - Das Klick-Ereignis (optional).
 */
function closeOverlay(event) {
    if (event) event.preventDefault();
    document.getElementById('overlay').classList.add('d-none');
    document.body.style.overflow = 'auto';
}

/**
 * Lädt und berechnet Typ-Beziehungen (Stärken/Schwächen) für ein Pokémon.
 * Nutzt Caching, um API-Anfragen zu minimieren.
 * @param {Object} pokemon - Das Pokémon-Datenobjekt.
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
 * Ruft Schadensbeziehungsdaten für eine Liste von Typen ab.
 * @param {Array<string>} types - Liste der Typ-Namen.
 * @returns {Promise<Array>} Array von Schadensbeziehungsdaten.
 */
async function fetchDamageRelations(types) {
    return Promise.all(types.map(t => fetch(`https://pokeapi.co/api/v2/type/${t}`).then(res => res.json())));
}

/**
 * Berechnet starke/schwache Beziehungen basierend auf Typ-Daten.
 * @param {Array} typeData - Rohe Typ-Daten von der API.
 * @returns {Object} Objekt mit Arrays für starke und schwache Typ-Namen.
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
 * Rendert den Typ-Beziehungs-Block im Overlay.
 * @param {Object} relations - Objekt mit Arrays für stark/schwach.
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
 * Lädt und rendert die Entwicklungskette für ein Pokémon.
 * Nutzt Caching.
 * @param {Object} pokemon - Das Pokémon-Datenobjekt.
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
 * Parst die rekursive Entwicklungsketten-Daten in ein flaches Array.
 * @param {Object} chain - Das rekursive Ketten-Objekt.
 * @returns {Array} Array der Entwicklungsstufen.
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
 * Rendert die Entwicklungsketten-Karten.
 * @param {Array} chain - Liste der Entwicklungsstufen.
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
