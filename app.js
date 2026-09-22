// Database Config (Populate with your keys when adding Supabase)
const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT_URL.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_PUBLIC_KEY';

let supabase = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL.includes('.supabase.co')) {
  supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Default Fallback Inventory with Local File Paths
const FALLBACK_GAMES = [
  {
    id: 'doomslinger-dungeon',
    title: 'Doomslinger Dungeon',
    description: 'Navigate challenging dungeon mazes in this classic retro adventure. Collect keys and fight pixel bosses.',
    price: '$14.99',
    category: 'Adventure',
    image_url: 'assets/games/doomslinger-cover.png',
    video_url: 'assets/games/doomslinger-preview.mp4',
    screenshots: [
      'assets/games/doomslinger-snap1.png',
      'assets/games/doomslinger-snap2.png',
      'assets/games/doomslinger-snap3.png'
    ]
  }
];

let GAMES_DATA = [...FALLBACK_GAMES];
let selectedGame = null;

// Screen Switcher Helper
function navigateTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.add('hidden');
    s.classList.remove('active');
  });
  
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }
}

// Load Games from Supabase or Fallback Local Array
async function fetchGames() {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('games').select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        GAMES_DATA = data;
      }
    } catch (err) {
      console.warn('Database offline, using local fallback assets.', err);
    }
  }
  renderGames(GAMES_DATA);
}

// Render Catalogue Grid
function renderGames(gamesList) {
  const grid = document.getElementById('game-grid');
  
  if (!gamesList || gamesList.length === 0) {
    grid.innerHTML = '<p class="col-span-3 text-center text-zinc-500 py-8 text-xs">No games found.</p>';
    return;
  }

  grid.innerHTML = gamesList.map(game => `
    <div onclick="openCheckout('${game.id}')" class="bg-zinc-800 border-2 border-zinc-700 rounded-xl p-3 flex flex-col justify-between cursor-pointer hover:border-amber-400 transition-colors">
      <img src="${game.image_url}" alt="${game.title}" class="w-full h-32 object-cover rounded-lg mb-2 bg-zinc-950" />
      <div>
        <h4 class="text-xs font-bold text-amber-400 mb-1">${game.title}</h4>
        <p class="text-[9px] text-zinc-400 line-clamp-3 leading-relaxed mb-2">${game.description}</p>
      </div>
    </div>
  `).join('');
}

// Category Filter Function
function filterCategory(categoryName) {
  if (categoryName === 'all') {
    renderGames(GAMES_DATA);
  } else {
    const filtered = GAMES_DATA.filter(g => g.category && g.category.toLowerCase() === categoryName.toLowerCase());
    renderGames(filtered);
  }
}

// Open Details / Checkout Modal
function openCheckout(gameId) {
  selectedGame = GAMES_DATA.find(g => g.id === gameId);
  if (!selectedGame) return;

  document.getElementById('detail-title').innerText = selectedGame.title;
  document.getElementById('detail-price').innerText = `Price: ${selectedGame.price}`;
  document.getElementById('detail-img').src = selectedGame.image_url;

  // Set Video Preview
  const video = document.getElementById('preview-video');
  const videoSrc = document.getElementById('preview-video-src');
  if (selectedGame.video_url) {
    videoSrc.src = selectedGame.video_url;
    video.load();
  }

  // Set Screenshots
  const container = document.getElementById('screen-grabs-container');
  if (selectedGame.screenshots && selectedGame.screenshots.length > 0) {
    container.innerHTML = selectedGame.screenshots.map(src => `
      <img src="${src}" class="bg-zinc-900 rounded-lg h-16 w-full object-cover border border-zinc-700" alt="Grab" />
    `).join('');
  } else {
    container.innerHTML = `
      <div class="bg-zinc-900 rounded-lg h-16 border border-zinc-700 flex items-center justify-center text-[8px] text-zinc-500">NO MEDIA</div>
      <div class="bg-zinc-900 rounded-lg h-16 border border-zinc-700 flex items-center justify-center text-[8px] text-zinc-500">NO MEDIA</div>
      <div class="bg-zinc-900 rounded-lg h-16 border border-zinc-700 flex items-center justify-center text-[8px] text-zinc-500">NO MEDIA</div>
    `;
  }

  navigateTo('modal-checkout');
}

// Flashing Process Simulation
function startPrintingProcess() {
  navigateTo('screen-progress');
  document.getElementById('printing-cart-title').innerText = selectedGame ? selectedGame.title : 'GAME';

  const progressBar = document.getElementById('progress-bar');
  progressBar.style.width = '0%';

  let progress = 0;
  const interval = setInterval(() => {
    progress += 10;
    progressBar.style.width = `${progress}%`;

    if (progress >= 100) {
      clearInterval(interval);
      const success = Math.random() > 0.15; // 85% success rate simulation
      if (success) {
        navigateTo('screen-landing');
      } else {
        navigateTo('screen-error');
      }
    }
  }, 400);
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  fetchGames();

  document.getElementById('screen-landing').addEventListener('click', () => {
    navigateTo('screen-browse');
  });

  document.getElementById('btn-cancel').addEventListener('click', () => {
    navigateTo('screen-browse');
  });

  document.getElementById('btn-start-print').addEventListener('click', () => {
    startPrintingProcess();
  });

  document.getElementById('btn-error-reset').addEventListener('click', () => {
    navigateTo('screen-landing');
  });
});
