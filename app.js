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
            <p class="text-[8px] text-zinc-400 leading-tight mb-2">${game.price || '$0.00'}</p>
          </div>
          <button onclick="event.stopPropagation(); removeFromWishlist('${title}');" class="w-full bg-rose-800 hover:bg-rose-700 text-white font-bold text-[9px] py-1 rounded-lg border border-rose-600 transition-colors">
            Remove
          </button>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Error opening user wishlist:', err);
    container.innerHTML = '<div class="col-span-3 text-center text-xs text-rose-500 py-8">Error loading wishlist.</div>';
  }
}

function closeUserWishlistView() {
  const modal = document.getElementById('modal-wishlist-view');
  if (modal) modal.classList.add('hidden');
}

function openWishlistAuthModal(game = null) {
  if (game) selectedGameForWishlist = game;

  const titleSpan = document.getElementById('wishlist-game-title');
  if (titleSpan) titleSpan.innerText = selectedGameForWishlist?.title || selectedGameForWishlist?.name || '';
  
  document.getElementById('wishlist-email-input').value = '';
  document.getElementById('wishlist-pin-input').value = '';

  const saveBtn = document.getElementById('btn-save-wishlist');
  if (saveBtn) saveBtn.innerText = 'SAVE TO WISHLIST';

  const errorMsg = document.getElementById('wishlist-error-msg');
  if (errorMsg) errorMsg.classList.add('hidden');

  const modal = document.getElementById('modal-wishlist-auth');
  if (modal) modal.classList.remove('hidden');
}

function openLoginModal() {
  selectedGameForWishlist = null;

  const titleSpan = document.getElementById('wishlist-game-title');
  if (titleSpan) titleSpan.innerText = 'Account Login';

  document.getElementById('wishlist-email-input').value = '';
  document.getElementById('wishlist-pin-input').value = '';

  const saveBtn = document.getElementById('btn-save-wishlist');
  if (saveBtn) saveBtn.innerText = 'LOGIN';

  const errorMsg = document.getElementById('wishlist-error-msg');
  if (errorMsg) errorMsg.classList.add('hidden');

  const modal = document.getElementById('modal-wishlist-auth');
  if (modal) modal.classList.remove('hidden');
}

function closeWishlistAuthModal() {
  const modal = document.getElementById('modal-wishlist-auth');
  if (modal) modal.classList.add('hidden');
}

async function handleWishlistSubmission() {
  const emailInput = document.getElementById('wishlist-email-input').value.trim().toLowerCase();
  const pinInput = document.getElementById('wishlist-pin-input').value.trim();
  const errorMsg = document.getElementById('wishlist-error-msg');
  const saveBtn = document.getElementById('btn-save-wishlist');

  if (!emailInput || !/^\d{4}$/.test(pinInput)) {
    if (errorMsg) {
      errorMsg.innerText = 'Does Not Match, try again.';
      errorMsg.classList.remove('hidden');
    }
    return;
  }

  saveBtn.disabled = true;
  saveBtn.innerText = 'PROCESSING...';

  try {
    const { data: user, error: loginError } = await supabaseClient
      .from('users')
      .select('*')
      .eq('email', emailInput)
      .eq('pin', pinInput)
      .eq('account_type', 'gamer')
      .single();

    if (loginError || !user) {
      if (errorMsg) {
        errorMsg.innerText = 'Does Not Match, try again.';
        errorMsg.classList.remove('hidden');
      }
      saveBtn.disabled = false;
      saveBtn.innerText = selectedGameForWishlist ? 'SAVE TO WISHLIST' : 'LOGIN';
      return;
    }

    setCurrentUser(user);

    if (selectedGameForWishlist) {
      await toggleGameWishlistStatus();
      closeWishlistAuthModal();
    } else {
      closeWishlistAuthModal();
    }

  } catch (err) {
    console.error('Wishlist/Login error:', err);
    if (errorMsg) {
      errorMsg.innerText = 'Does Not Match, try again.';
      errorMsg.classList.remove('hidden');
    }
  } finally {
    saveBtn.disabled = false;
  }
}

/* ==================== ROM PRINTING & INVOICE LOGGING ==================== */

async function logPrintToInvoice(game) {
  if (!currentStoreEmail) return;
  const gameTitle = game.title || game.name || 'Unknown Game';

  try {
    const { error } = await supabaseClient
      .from('print_logs')
      .insert([{ 
        store_email: currentStoreEmail, 
        game_title: gameTitle 
      }]);
      
    if (error) console.error('Failed to write invoice log:', error);
    else console.log(`Invoiced print of ${gameTitle} to ${currentStoreEmail}`);
  } catch (err) {
    console.error('Error logging print to Supabase:', err);
  }
}

async function prepareAndPrintGame(game) {
  if (!game?.rom_url) {
    handleHardwareError({
      error_type: 'NO_ROM',
      message: 'No ROM URL available for this game.'
    });
    return;
  }

  const progressBar = document.getElementById('progress-bar');
  if (progressBar) progressBar.style.width = '10%';

  try {
    console.log(`Sending flash request for ${game.title || game.name}...`);
    if (progressBar) progressBar.style.width = '40%';

    const response = await fetch('http://127.0.0.1:5000/flash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rom_url: game.rom_url })
    });

    if (progressBar) progressBar.style.width = '80%';
    const result = await response.json();

    if (response.ok && result.status === 'success') {
      if (progressBar) progressBar.style.width = '100%';
      console.log('Flash Output:', result.output);
      
      await logPrintToInvoice(game);
      
      setTimeout(() => {
        navigateTo('screen-success');
      }, 1000);

    } else {
      console.error('Flashing failed:', result.message || result.error);
      handleHardwareError(result);
    }

  } catch (err) {
    console.error('Network or hardware error during flash:', err);
    handleHardwareError({
      error_type: 'NO_BRIDGE',
      message: 'Cannot connect to the local hardware bridge service.'
    });
  }
}

function handleHardwareError(errorData) {
  const errorTitleEl = document.querySelector('#screen-error h1');
  const errorMsgEl = document.querySelector('#screen-error p');

  if (errorData.error_type === 'NO_HARDWARE') {
    if (errorTitleEl) errorTitleEl.innerText = 'HARDWARE UNPLUGGED';
    if (errorMsgEl) errorMsgEl.innerText = 'The game flasher is not connected to the system. Please ensure the USB cable is plugged in.';
  } else if (errorData.error_type === 'NO_CARTRIDGE') {
    if (errorTitleEl) errorTitleEl.innerText = 'NO CARTRIDGE DETECTED';
    if (errorMsgEl) errorMsgEl.innerText = 'Please insert a blank cartridge firmly into the slot before printing.';
  } else if (errorData.error_type === 'NO_BRIDGE') {
    if (errorTitleEl) errorTitleEl.innerText = 'BRIDGE SERVICE DOWN';
    if (errorMsgEl) errorMsgEl.innerText = 'Cannot connect to the local bridge background service on the Pi.';
  } else {
    if (errorTitleEl) errorTitleEl.innerText = 'ERROR: PRINTING FAILED';
    if (errorMsgEl) errorMsgEl.innerText = errorData.message || 'Something went wrong while flashing. Please notify a team member.';
  }

  navigateTo('screen-error');
}

/* ==================== INITIALIZATION & EVENT LISTENERS ==================== */

document.addEventListener('DOMContentLoaded', () => {
  checkStoreSession(); 
  loadGamesFromSupabase();
  checkSavedUserSession();

  document.getElementById('btn-store-login')?.addEventListener('click', handleStoreLogin);
  document.getElementById('search-input')?.addEventListener('input', applyFilters);

  document.getElementById('screen-landing')?.addEventListener('click', () => {
    navigateTo('screen-browse');
  });

  document.getElementById('btn-cancel')?.addEventListener('click', () => {
    navigateTo('screen-browse');
  });

  document.getElementById('btn-error-reset')?.addEventListener('click', () => {
    navigateTo('screen-landing');
  });

  document.getElementById('btn-success-home')?.addEventListener('click', () => {
    navigateTo('screen-landing');
  });

  document.getElementById('btn-success-label')?.addEventListener('click', () => {
    alert('Printing label...');
  });

  document.getElementById('btn-user-wishlist')?.addEventListener('click', openUserWishlistView);
  document.getElementById('btn-close-wishlist-view')?.addEventListener('click', closeUserWishlistView);

  document.getElementById('btn-wishlist')?.addEventListener('click', toggleGameWishlistStatus);
  document.getElementById('btn-cancel-wishlist')?.addEventListener('click', closeWishlistAuthModal);
  document.getElementById('btn-save-wishlist')?.addEventListener('click', handleWishlistSubmission);

  document.getElementById('btn-lightbox-close')?.addEventListener('click', closeLightbox);
  document.getElementById('btn-lightbox-next')?.addEventListener('click', lightboxNext);
  document.getElementById('btn-lightbox-prev')?.addEventListener('click', lightboxPrev);

  document.getElementById('btn-login')?.addEventListener('click', () => {
    if (currentUser) {
      if (confirm(`Logged in as ${currentUser.email}. Do you want to log out?`)) {
        logoutUser();
      }
    } else {
      openLoginModal();
    }
  });

  document.getElementById('btn-start-print')?.addEventListener('click', () => {
    navigateTo('screen-insert-cartridge');
  });

  document.getElementById('btn-cartridge-done')?.addEventListener('click', async () => {
    const cartTitle = document.getElementById('printing-cart-title');
    if (cartTitle && selectedGameForWishlist) {
      cartTitle.innerText = selectedGameForWishlist.title || selectedGameForWishlist.name;
    }

    navigateTo('screen-progress');

    if (selectedGameForWishlist) {
      await prepareAndPrintGame(selectedGameForWishlist);
    } else {
      handleHardwareError({
        error_type: 'NO_GAME_SELECTED',
        message: 'No game selected.'
      });
    }

    logoutUser();
  });

  document.getElementById('btn-cartridge-back')?.addEventListener('click', () => {
    navigateTo('modal-checkout');
  });

  /* ==================== PIN RESET LOGIC ==================== */
  document.getElementById('btn-show-reset')?.addEventListener('click', () => {
    document.getElementById('reset-pin-container').classList.remove('hidden');
    document.getElementById('reset-pin-container').classList.add('flex');
    document.getElementById('login-fields-container').classList.add('hidden');
    document.getElementById('reset-msg').classList.add('hidden');
  });

  document.getElementById('btn-cancel-reset')?.addEventListener('click', () => {
    document.getElementById('reset-pin-container').classList.add('hidden');
    document.getElementById('reset-pin-container').classList.remove('flex');
    document.getElementById('login-fields-container').classList.remove('hidden');
  });

  document.getElementById('btn-submit-reset')?.addEventListener('click', async () => {
    const email = document.getElementById('reset-email').value.trim().toLowerCase();
    const newPin = document.getElementById('reset-new-pin').value.trim();
    const msgEl = document.getElementById('reset-msg');

    if (!email || !/^\d{4}$/.test(newPin)) {
      msgEl.innerText = 'Enter a valid email and 4-digit PIN.';
      msgEl.className = 'text-[10px] font-bold text-rose-500';
      msgEl.classList.remove('hidden');
      return;
    }

    msgEl.innerText = 'Verifying account...';
    msgEl.className = 'text-[10px] font-bold text-amber-400';
    msgEl.classList.remove('hidden');

    const { data, error } = await supabaseClient
      .from('users')
      .select('id')
      .eq('email', email)
      .eq('account_type', 'store')
      .single();

    if (error || !data) {
      msgEl.innerText = 'Store email not found in database.';
      msgEl.className = 'text-[10px] font-bold text-rose-500';
      return;
    }

    const { error: updateError } = await supabaseClient
      .from('users')
      .update({ pin: newPin })
      .eq('id', data.id);

    if (updateError) {
      msgEl.innerText = 'System error. Failed to update PIN.';
      msgEl.className = 'text-[10px] font-bold text-rose-500';
    } else {
      msgEl.innerText = 'Success! You can now log in with your new PIN.';
      msgEl.className = 'text-[10px] font-bold text-emerald-400';
      document.getElementById('reset-email').value = '';
      document.getElementById('reset-new-pin').value = '';
      
      setTimeout(() => {
        document.getElementById('reset-pin-container').classList.add('hidden');
        document.getElementById('reset-pin-container').classList.remove('flex');
        document.getElementById('login-fields-container').classList.remove('hidden');
        msgEl.classList.add('hidden');
      }, 3000);
    }
  });

  /* ==================== VIRTUAL KEYBOARD LOGIC ==================== */
  let activeInput = null;
  const Keyboard = window.SimpleKeyboard.default;
  
  function updatePreviewBar(text) {
    const previewBar = document.getElementById("keyboard-preview-bar");
    if (!previewBar || !activeInput) return;

    if (activeInput.type === 'password') {
      previewBar.value = '•'.repeat(text.length);
    } else {
      previewBar.value = text;
    }
  }

  const kioskKeyboard = new Keyboard({
    onChange: input => onChange(input),
    onKeyPress: button => onKeyPress(button),
    theme: "hg-theme-default hg-layout-default dark-theme",
    layout: {
      default: [
        "1 2 3 4 5 6 7 8 9 0 {bksp}",
        "q w e r t y u i o p",
        "a s d f g h j k l @ .com",
        "{shift} z x c v b n m _ .",
        "{space}"
      ],
      shift: [
        "! @ # $ % ^ & * ( ) {bksp}",
        "Q W E R T Y U I O P",
        "A S D F G H J K L",
        "{shift} Z X C V B N M",
        "{space}"
      ]
    },
    display: {
      "{bksp}": "⌫",
      "{shift}": "⇧",
      "{space}": "SPACE"
    }
  });

  function onChange(input) {
    if (activeInput) {
      activeInput.value = input;
      activeInput.dispatchEvent(new Event("input", { bubbles: true }));
      updatePreviewBar(input);
    }
  }

  function onKeyPress(button) {
    if (button === "{shift}") {
      let currentLayout = kioskKeyboard.options.layoutName;
      let shiftToggle = currentLayout === "default" ? "shift" : "default";
      kioskKeyboard.setOptions({ layoutName: shiftToggle });
    }
  }

  document.querySelectorAll("input").forEach(input => {
    if (input.id === "keyboard-preview-bar") return;

    input.addEventListener("input", (e) => {
      if (activeInput && activeInput.id === e.target.id) {
        kioskKeyboard.setInput(e.target.value, activeInput.id);
        updatePreviewBar(e.target.value);
      }
    });

    input.addEventListener("focus", (e) => {
      activeInput = e.target;
      kioskKeyboard.setOptions({
        inputName: activeInput.id
      });
      kioskKeyboard.setInput(activeInput.value, activeInput.id);
      
      updatePreviewBar(activeInput.value);
      
      document.getElementById("keyboard-wrapper").classList.remove("hidden");
    });
  });

  document.getElementById("btn-close-keyboard").addEventListener("click", () => {
    document.getElementById("keyboard-wrapper").classList.add("hidden");
    if (activeInput) activeInput.blur();
  });

});
