const SUPABASE_URL = 'https://tskbfytfjsiavwysecuk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_I27CpcilWluOjUSSb6y_pQ_t9ylEjmB';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let GAMES_DATA = [];
let currentUser = null; // Gamer session
let currentStoreEmail = localStorage.getItem('kiosk_store_email'); // Store session
let selectedGameForWishlist = null;
let currentCategory = 'all';

// Lightbox variables
let currentLightboxImages = [];
let currentLightboxIndex = 0;

/* ==================== HELPER: URL & VIDEO FORMATTERS ==================== */

function formatImageUrl(url) {
  if (!url) return '';
  const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }
  return url;
}

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  let videoId = null;

  if (url.includes('youtube.com/watch?v=')) {
    videoId = url.split('v=')[1]?.split('&')[0];
  } else if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0];
  } else if (url.includes('youtube.com/embed/')) {
    videoId = url.split('embed/')[1]?.split('?')[0];
  }

  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?autoplay=0&mute=0&rel=0&controls=1&modestbranding=1`;
  }
  return null;
}

/* ==================== SUPABASE DATA LOADING ==================== */

async function loadGamesFromSupabase() {
  const { data, error } = await supabaseClient
    .from('games')
    .select('*');

  if (error) {
    console.error('Error fetching games from Supabase:', error);
    return;
  }

  GAMES_DATA = data.map(game => {
    const rawImageUrl = game.image_url || game.cover_url || game.cartridge_image_url || '';
    const imageUrl = formatImageUrl(rawImageUrl);

    let gallery = [];
    if (game.screenshots) {
      if (Array.isArray(game.screenshots)) {
        gallery = game.screenshots.map(formatImageUrl);
      } else if (typeof game.screenshots === 'string') {
        try {
          const parsed = JSON.parse(game.screenshots);
          gallery = (Array.isArray(parsed) ? parsed : [game.screenshots]).map(formatImageUrl);
        } catch (e) {
          gallery = game.screenshots.split(',').map(s => s.trim()).filter(Boolean).map(formatImageUrl);
        }
      }
    }

    if (gallery.length === 0) {
      gallery = [
        'assets/brand/snap.png',
        'assets/brand/snap.png',
        'assets/brand/snap.png'
      ];
    }

    return {
      ...game,
      image_url: imageUrl,
      rom_url: game.rom_url || '',
      screenshots: gallery,
      sort_order: game.sort_order || 999 
    };
  }).sort((a, b) => a.sort_order - b.sort_order);

  renderGames(GAMES_DATA);
}

function navigateTo(screenId) {
  if (screenId === 'screen-landing') {
    logoutUser();
  }

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
  if (!grid) return;

  grid.innerHTML = gamesList.map(game => `
    <div onclick="openCheckout('${game.id}')" class="bg-zinc-800 border-2 border-zinc-700 rounded-xl p-3 flex flex-col justify-between cursor-pointer hover:border-amber-400 transition-colors">
      <img src="${game.image_url}" alt="${game.title || game.name}" class="w-full aspect-square object-cover rounded-lg mb-2 bg-zinc-950" />
      <div>
        <h4 class="text-[12px] font-bold text-amber-400 mb-1 leading-tight whitespace-nowrap overflow-hidden text-ellipsis block">${game.title || game.name}</h4>
        <p class="text-[8px] text-zinc-400 line-clamp-3 leading-relaxed mb-2">${game.description}</p>
      </div>
    </div>
  `).join('');
}

function filterCategory(categoryName) {
  currentCategory = categoryName;

  document.querySelectorAll('.category-btn').forEach(btn => {
    if (btn.innerText.toLowerCase() === categoryName.toLowerCase() || (categoryName === 'all' && btn.innerText === 'All Games')) {
      btn.className = 'category-btn active px-4 py-2 rounded-full bg-zinc-100 text-black font-bold text-xs';
    } else {
      btn.className = 'category-btn px-4 py-2 rounded-full bg-zinc-800 text-zinc-300 font-bold text-xs border border-zinc-700';
    }
  });

  applyFilters();
}

function applyFilters() {
  const query = document.getElementById('search-input')?.value.trim().toLowerCase() || '';

  const filtered = GAMES_DATA.filter(game => {
    const gameTitle = (game.title || game.name || '').toLowerCase();
    const matchesCategory = currentCategory === 'all' || 
      (game.category && game.category.toLowerCase() === currentCategory.toLowerCase());
    const matchesSearch = !query || gameTitle.includes(query);

    return matchesCategory && matchesSearch;
  });

  renderGames(filtered);
}

function openCheckout(gameId) {
  const selectedGame = GAMES_DATA.find(g => g.id === gameId);
  if (!selectedGame) return;

  selectedGameForWishlist = selectedGame;
  document.getElementById('detail-title').innerText = selectedGame.title || selectedGame.name;
  document.getElementById('detail-price').innerText = `Price: ${selectedGame.price || '$0.00'}`;
  document.getElementById('detail-img').src = selectedGame.image_url;
  
  document.getElementById('detail-description').innerText = selectedGame.description || 'No description available for this game.';

  const video = document.getElementById('preview-video');
  const videoSrc = document.getElementById('preview-video-src');
  const iframe = document.getElementById('preview-iframe');
  const playIcon = document.getElementById('preview-play-icon');

  const videoUrl = selectedGame.video_url || '';
  const youtubeEmbedUrl = getYouTubeEmbedUrl(videoUrl);

  if (youtubeEmbedUrl) {
    if (video) video.classList.add('hidden');
    if (iframe) {
      iframe.src = youtubeEmbedUrl;
      iframe.classList.remove('hidden');
    }
    if (playIcon) playIcon.classList.add('hidden');
  } else if (videoUrl) {
    if (iframe) {
      iframe.src = '';
      iframe.classList.add('hidden');
    }
    if (video && videoSrc) {
      videoSrc.src = videoUrl;
      video.classList.remove('hidden');
      video.load();
    }
    if (playIcon) playIcon.classList.remove('hidden');
  } else {
    if (iframe) { iframe.src = ''; iframe.classList.add('hidden'); }
    if (video) video.classList.add('hidden');
    if (playIcon) playIcon.classList.remove('hidden');
  }

  currentLightboxImages = selectedGame.screenshots || [];
  const container = document.getElementById('screen-grabs-container');
  if (container) {
    container.innerHTML = currentLightboxImages.map((src, index) => `
      <img src="${src}" onclick="openLightbox(${index})" class="bg-zinc-900 rounded-lg aspect-square w-full object-cover border border-zinc-700 hover:border-amber-400 cursor-pointer transition-colors" alt="Grab" />
    `).join('');
  }

  updateWishlistButtonUI();
  navigateTo('modal-checkout');
}

/* ==================== WISHLIST BUTTON UI TOGGLE ==================== */

function isGameInUserWishlist(gameTitle) {
  if (!currentUser || !currentUser.wishlist) return false;
  const list = currentUser.wishlist.split(', ').filter(Boolean);
  return list.includes(gameTitle);
}

function updateWishlistButtonUI() {
  const wishlistBtn = document.getElementById('btn-wishlist');
  if (!wishlistBtn || !selectedGameForWishlist) return;

  const title = selectedGameForWishlist.title || selectedGameForWishlist.name;
  if (isGameInUserWishlist(title)) {
    wishlistBtn.className = 'bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded-xl font-bold text-xs transition-colors';
    wishlistBtn.innerText = 'Wishlist';
  } else {
    wishlistBtn.className = 'bg-amber-500 hover:bg-amber-400 text-black py-2 rounded-xl font-bold text-xs transition-colors';
    wishlistBtn.innerText = 'Wishlist';
  }
}

async function toggleGameWishlistStatus() {
  if (!selectedGameForWishlist) return;
  if (!currentUser) {
    openWishlistAuthModal(selectedGameForWishlist);
    return;
  }

  const title = selectedGameForWishlist.title || selectedGameForWishlist.name;
  let wishlistArray = currentUser.wishlist ? currentUser.wishlist.split(', ').filter(Boolean) : [];

  if (wishlistArray.includes(title)) {
    wishlistArray = wishlistArray.filter(t => t !== title);
  } else {
    wishlistArray.push(title);
  }

  const updatedWishlist = wishlistArray.join(', ');
  const { error } = await supabaseClient
    .from('users')
    .update({ wishlist: updatedWishlist })
    .eq('id', currentUser.id);

  if (!error) {
    currentUser.wishlist = updatedWishlist;
    updateWishlistButtonUI();
  } else {
    console.error('Failed to update wishlist:', error);
    alert('Failed to update wishlist. Please try again.');
  }
}

/* ==================== LIGHTBOX LOGIC ==================== */

function openLightbox(index) {
  if (!currentLightboxImages.length) return;
  currentLightboxIndex = index;
  const lightboxImg = document.getElementById('lightbox-img');
  if (lightboxImg) lightboxImg.src = currentLightboxImages[currentLightboxIndex];
  const lightbox = document.getElementById('modal-lightbox');
  if (lightbox) lightbox.classList.remove('hidden');
}

function closeLightbox() {
  const lightbox = document.getElementById('modal-lightbox');
  if (lightbox) lightbox.classList.add('hidden');
}

function lightboxNext() {
  if (!currentLightboxImages.length) return;
  currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length;
  document.getElementById('lightbox-img').src = currentLightboxImages[currentLightboxIndex];
}

function lightboxPrev() {
  if (!currentLightboxImages.length) return;
  currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length;
  document.getElementById('lightbox-img').src = currentLightboxImages[currentLightboxIndex];
}

/* ==================== SESSION LOGIC (STORE & GAMER) ==================== */

async function handleStoreLogin() {
  const emailInput = document.getElementById('store-login-email').value.trim().toLowerCase();
  const pinInput = document.getElementById('store-login-pin').value.trim();
  const errorMsg = document.getElementById('store-login-error');
  const loginBtn = document.getElementById('btn-store-login');

  if (!emailInput || !pinInput) {
    if (errorMsg) errorMsg.classList.remove('hidden');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.innerText = 'AUTHENTICATING...';

  try {
    const { data: store, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('email', emailInput)
      .eq('pin', pinInput)
      .eq('account_type', 'store')
      .single();

    if (error || !store) {
      if (errorMsg) errorMsg.classList.remove('hidden');
      loginBtn.disabled = false;
      loginBtn.innerText = 'ACTIVATE KIOSK';
      return;
    }

    currentStoreEmail = store.email;
    localStorage.setItem('kiosk_store_email', store.email);
    
    document.getElementById('screen-store-login').classList.add('hidden');
    document.getElementById('screen-store-login').classList.remove('active');
    navigateTo('screen-landing');

  } catch (err) {
    console.error('Store login error:', err);
    if (errorMsg) errorMsg.classList.remove('hidden');
    loginBtn.disabled = false;
    loginBtn.innerText = 'ACTIVATE KIOSK';
  }
}

function checkStoreSession() {
  if (currentStoreEmail) {
    document.getElementById('screen-store-login').classList.add('hidden');
    document.getElementById('screen-store-login').classList.remove('active');
    navigateTo('screen-landing');
  } else {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.add('hidden');
      s.classList.remove('active');
    });
    const storeLogin = document.getElementById('screen-store-login');
    if (storeLogin) {
      storeLogin.classList.remove('hidden');
      storeLogin.classList.add('active');
    }
  }
}

function setCurrentUser(user) {
  currentUser = user;
  localStorage.setItem('kiosk_user_email', user.email);

  const loginText = document.getElementById('login-text');
  if (loginText) loginText.innerText = user.email.split('@')[0];

  const wishlistBtn = document.getElementById('btn-user-wishlist');
  if (wishlistBtn) wishlistBtn.classList.remove('hidden');

  updateWishlistButtonUI();
}

function logoutUser() {
  currentUser = null;
  localStorage.removeItem('kiosk_user_email');

  const loginText = document.getElementById('login-text');
  if (loginText) loginText.innerText = 'Login';

  const wishlistBtn = document.getElementById('btn-user-wishlist');
  if (wishlistBtn) wishlistBtn.classList.add('hidden');

  closeUserWishlistView();
  updateWishlistButtonUI();
}

async function checkSavedUserSession() {
  const savedEmail = localStorage.getItem('kiosk_user_email');
  if (!savedEmail) return;
  try {
    const { data: user } = await supabaseClient
      .from('users')
      .select('*')
      .ilike('email', savedEmail)
      .eq('account_type', 'gamer')
      .single();

    if (user) setCurrentUser(user);
  } catch (err) {
    console.error('Session restore failed:', err);
  }
}

/* ==================== WISHLIST VIEW & AUTH MODALS ==================== */

async function removeFromWishlist(gameTitle) {
  if (!currentUser) return;

  let wishlistArray = currentUser.wishlist ? currentUser.wishlist.split(', ').filter(Boolean) : [];
  wishlistArray = wishlistArray.filter(t => t !== gameTitle);
  const updatedWishlist = wishlistArray.join(', ');

  const { error } = await supabaseClient
    .from('users')
    .update({ wishlist: updatedWishlist })
    .eq('id', currentUser.id);

  if (!error) {
    currentUser.wishlist = updatedWishlist;
    updateWishlistButtonUI();
    openUserWishlistView();
  } else {
    console.error('Failed to remove game from wishlist:', error);
    alert('Failed to remove game. Please try again.');
  }
}

async function openUserWishlistView() {
  if (!currentUser) return;
  const modal = document.getElementById('modal-wishlist-view');
  const container = document.getElementById('wishlist-items-container');
  if (!modal || !container) return;

  container.innerHTML = '<div class="col-span-3 text-center text-xs text-zinc-400 py-8">Loading wishlist...</div>';
  modal.classList.remove('hidden');

  try {
    const { data: user, error } = await supabaseClient
      .from('users')
      .select('wishlist')
      .eq('id', currentUser.id)
      .single();

    if (error || !user) {
      container.innerHTML = '<div class="col-span-3 text-center text-xs text-rose-500 py-8">Failed to load wishlist.</div>';
      return;
    }

    currentUser.wishlist = user.wishlist || '';
    const savedTitles = user.wishlist ? user.wishlist.split(', ').filter(Boolean) : [];

    if (savedTitles.length === 0) {
      container.innerHTML = '<div class="col-span-3 text-center text-xs text-zinc-400 py-8">Your wishlist is currently empty.</div>';
      return;
    }

    const wishlistGames = GAMES_DATA.filter(g => savedTitles.includes(g.title || g.name));
    container.innerHTML = wishlistGames.map(game => {
      const title = game.title || game.name;
      return `
        <div class="bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 flex flex-col h-fit hover:border-amber-400 transition-colors">
          <div onclick="closeUserWishlistView(); openCheckout('${game.id}');" class="cursor-pointer">
            <img src="${game.image_url}" alt="${title}" class="w-full aspect-square object-cover rounded-lg mb-1.5 bg-zinc-950" />
            <h4 class="text-[10px] font-bold text-amber-400 leading-tight truncate">${title}</h4>
            <p class="text-[8px] text-zinc-400 leading-tight mb-2">${game.price || '$0.00'
