// All 9 Games explicitly mapped to their individual asset folders
const GAMES_DATA = [
  {
    id: 'birdie-bartender',
    title: 'Birdie Bartender',
    description: 'Serve up pixelated drinks in this quirky arcade-style sim. Collect unique ingredients and mix cocktails.',
    price: '$9.99',
    category: 'Indie',
    image_url: 'assets/games/birdie-bartender/cover.png',
    video_url: 'assets/games/birdie-bartender/preview.mp4',
    screenshots: [
      'assets/games/birdie-bartender/snap1.png',
      'assets/games/birdie-bartender/snap2.png',
      'assets/games/birdie-bartender/snap3.png'
    ]
  },
  {
    id: 'doomslinger-dungeon',
    title: 'Doomslinger Dungeon',
    description: 'Navigate challenging dungeon mazes in this classic retro adventure. Collect keys and fight pixel bosses.',
    price: '$14.99',
    category: 'Adventure',
    image_url: 'assets/games/doomslinger-dungeon/cover.png',
    video_url: 'assets/games/doomslinger-dungeon/preview.mp4',
    screenshots: [
      'assets/games/doomslinger-dungeon/snap1.png',
      'assets/games/doomslinger-dungeon/snap2.png',
      'assets/games/doomslinger-dungeon/snap3.png'
    ]
  },
  {
    id: 'capybara-village',
    title: 'Capybara Village',
    description: 'Build and manage your own peaceful capybara village. Interact with cute, blocky characters.',
    price: '$12.99',
    category: 'Indie',
    image_url: 'assets/games/capybara-village/cover.png',
    video_url: 'assets/games/capybara-village/preview.mp4',
    screenshots: [
      'assets/games/capybara-village/snap1.png',
      'assets/games/capybara-village/snap2.png',
      'assets/games/capybara-village/snap3.png'
    ]
  },
  {
    id: 'disco-elysium',
    title: 'Disco Elysium',
    description: 'A groundbreaking isometric role-playing game with non-linear storytelling.',
    price: '$19.99',
    category: 'Classic',
    image_url: 'assets/games/disco-elysium/cover.png',
    video_url: 'assets/games/disco-elysium/preview.mp4',
    screenshots: [
      'assets/games/disco-elysium/snap1.png',
      'assets/games/disco-elysium/snap2.png',
      'assets/games/disco-elysium/snap3.png'
    ]
  },
  {
    id: 'island-deluxe',
    title: 'My Friendly Little Island Deluxe',
    description: 'Explore a charming island, complete quests, and meet colorful characters. Deluxe features.',
    price: '$14.99',
    category: 'New',
    image_url: 'assets/games/island-deluxe/cover.png',
    video_url: 'assets/games/island-deluxe/preview.mp4',
    screenshots: [
      'assets/games/island-deluxe/snap1.png',
      'assets/games/island-deluxe/snap2.png',
      'assets/games/island-deluxe/snap3.png'
    ]
  },
  {
    id: 'criss-cross-cove',
    title: 'The Treasure of CrissCross Cove',
    description: 'A thrilling pirate adventure. Decode cryptic maps to find hidden riches on the coast.',
    price: '$11.99',
    category: 'Adventure',
    image_url: 'assets/games/criss-cross-cove/cover.png',
    video_url: 'assets/games/criss-cross-cove/preview.mp4',
    screenshots: [
      'assets/games/criss-cross-cove/snap1.png',
      'assets/games/criss-cross-cove/snap2.png',
      'assets/games/criss-cross-cove/snap3.png'
    ]
  },
  {
    id: 'taiyaki-fabulous',
    title: 'Taiyaki Fabulous',
    description: 'Bake and serve delicious taiyaki sweets in a fast-paced arcade kitchen.',
    price: '$8.99',
    category: 'Action',
    image_url: 'assets/games/taiyaki-fabulous/cover.png',
    video_url: 'assets/games/taiyaki-fabulous/preview.mp4',
    screenshots: [
      'assets/games/taiyaki-fabulous/snap1.png',
      'assets/games/taiyaki-fabulous/snap2.png',
      'assets/games/taiyaki-fabulous/snap3.png'
    ]
  },
  {
    id: 'starlight-courier',
    title: 'Starlight Courier',
    description: 'Pilot space cargo ships across dangerous retro galaxies.',
    price: '$13.99',
    category: 'Action',
    image_url: 'assets/games/starlight-courier/cover.png',
    video_url: 'assets/games/starlight-courier/preview.mp4',
    screenshots: [
      'assets/games/starlight-courier/snap1.png',
      'assets/games/starlight-courier/snap2.png',
      'assets/games/starlight-courier/snap3.png'
    ]
  },
  {
    id: 'pixel-pioneer',
    title: 'Pixel Pioneer',
    description: 'Craft, mine, and explore procedural retro wilderness environments.',
    price: '$10.99',
    category: 'New',
    image_url: 'assets/games/pixel-pioneer/cover.png',
    video_url: 'assets/games/pixel-pioneer/preview.mp4',
    screenshots: [
      'assets/games/pixel-pioneer/snap1.png',
      'assets/games/pixel-pioneer/snap2.png',
      'assets/games/pixel-pioneer/snap3.png'
    ]
  }
];

let selectedGame = null;

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

function renderGames(gamesList) {
  const grid = document.getElementById('game-grid');
  grid.innerHTML = gamesList.map(game => `
    <div onclick="openCheckout('${game.id}')" class="bg-zinc-800 border-2 border-zinc-700 rounded-xl p-3 flex flex-col justify-between cursor-pointer hover:border-amber-400 transition-colors">
      <img src="${game.image_url}" alt="${game.title}" class="w-full h-28 object-cover rounded-lg mb-2 bg-zinc-950" />
      <div>
        <h4 class="text-[11px] font-bold text-amber-400 mb-1 leading-tight">${game.title}</h4>
        <p class="text-[8px] text-zinc-400 line-clamp-3 leading-relaxed mb-2">${game.description}</p>
      </div>
    </div>
  `).join('');
}

function filterCategory(categoryName) {
  document.querySelectorAll('.category-btn').forEach(btn => {
    if (btn.innerText.toLowerCase() === categoryName.toLowerCase() || (categoryName === 'all' && btn.innerText === 'All Games')) {
      btn.className = 'category-btn active px-4 py-2 rounded-full bg-zinc-100 text-black font-bold text-xs';
    } else {
      btn.className = 'category-btn px-4 py-2 rounded-full bg-zinc-800 text-zinc-300 font-bold text-xs border border-zinc-700';
    }
  });

  if (categoryName === 'all') {
    renderGames(GAMES_DATA);
  } else {
    const filtered = GAMES_DATA.filter(g => g.category && g.category.toLowerCase() === categoryName.toLowerCase());
    renderGames(filtered);
  }
}

function openCheckout(gameId) {
  selectedGame = GAMES_DATA.find(g => g.id === gameId);
  if (!selectedGame) return;

  document.getElementById('detail-title').innerText = selectedGame.title;
  document.getElementById('detail-price').innerText = `Price: ${selectedGame.price}`;
  document.getElementById('detail-img').src = selectedGame.image_url;

  const video = document.getElementById('preview-video');
  const videoSrc = document.getElementById('preview-video-src');
  if (selectedGame.video_url) {
    videoSrc.src = selectedGame.video_url;
    video.load();
  }

  const container = document.getElementById('screen-grabs-container');
  container.innerHTML = selectedGame.screenshots.map(src => `
    <img src="${src}" class="bg-zinc-900 rounded-lg h-14 w-full object-cover border border-zinc-700" alt="Grab" />
  `).join('');

  navigateTo('modal-checkout');
}

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
      const success = Math.random() > 0.15;
      if (success) {
        navigateTo('screen-landing');
      } else {
        navigateTo('screen-error');
      }
    }
  }, 400);
}

document.addEventListener('DOMContentLoaded', () => {
  renderGames(GAMES_DATA);

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
