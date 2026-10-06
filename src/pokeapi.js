// Small wrapper around PokéAPI (https://pokeapi.co). No API key needed.

const API = 'https://pokeapi.co/api/v2';
const MAX_ID = 1025;

const MODEL_BASE = 'https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt';

let indexPromise = null;
const pokemonCache = new Map();

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// "mr-mime" -> "Mr Mime"
export function prettyName(name) {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function padId(id) {
  return `#${String(id).padStart(3, '0')}`;
}

export function modelUrl(id, shiny = false) {
  return `${MODEL_BASE}/${shiny ? 'shiny' : 'regular'}/${id}.glb`;
}

// Loads the list of all Pokémon names once: [{ id, name }].
export function loadIndex() {
  if (!indexPromise) {
    indexPromise = getJson(`${API}/pokemon-species?limit=${MAX_ID}`)
      .then((data) =>
        data.results
          .map((entry) => ({
            id: Number(entry.url.split('/').filter(Boolean).pop()),
            name: entry.name,
          }))
          .sort((a, b) => a.id - b.id),
      )
      .catch((err) => {
        indexPromise = null; // allow a retry
        throw err;
      });
  }
  return indexPromise;
}

// Filters the index by name (substring) or number. Prefix matches come first.
export function searchIndex(index, query) {
  const q = query.trim().toLowerCase();
  if (!q) return index;
  if (/^\d+$/.test(q)) {
    return index.filter((p) => String(p.id).startsWith(q.replace(/^0+/, '') || '0'));
  }
  const prefix = [];
  const rest = [];
  for (const p of index) {
    if (p.name.startsWith(q)) prefix.push(p);
    else if (p.name.includes(q)) rest.push(p);
  }
  return prefix.concat(rest);
}

// Full details for one Pokémon (cached).
export function getPokemon(id) {
  if (!pokemonCache.has(id)) {
    const promise = Promise.all([getJson(`${API}/pokemon/${id}`), getJson(`${API}/pokemon-species/${id}`)])
      .then(([poke, species]) => {
        const flavor = species.flavor_text_entries.find((e) => e.language.name === 'en');
        return {
          id,
          name: prettyName(species.name),
          types: poke.types.map((t) => t.type.name),
          height: poke.height / 10, // decimetres -> metres
          weight: poke.weight / 10, // hectograms -> kilograms
          abilities: poke.abilities.map((a) => prettyName(a.ability.name)),
          stats: poke.stats.map((s) => ({ name: s.stat.name, value: s.base_stat })),
          cryUrl: poke.cries?.latest || poke.cries?.legacy || null,
          artworkUrl: poke.sprites.other?.['official-artwork']?.front_default || poke.sprites.front_default,
          // The VR font has no accented letters ("POK\u00e9MON"), so strip accents.
          flavorText: flavor
            ? flavor.flavor_text.replace(/[\f\n\r]+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            : '',
        };
      })
      .catch((err) => {
        pokemonCache.delete(id);
        throw err;
      });
    pokemonCache.set(id, promise);
  }
  return pokemonCache.get(id);
}
