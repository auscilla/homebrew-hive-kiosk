const SUPABASE_URL = 'https://tskbfytfjsiavwysecuk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_I27CpcilWluOjUSSb6y_pQ_t9ylEjmB';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let GAMES_DATA = [];
let currentUser = null;

async function loadGamesFromSupabase() {
  const { data, error } = await supabaseClient
    .from('games')
    .select('*');

  if (error) {
    console.error('Error fetching games from Supabase:', error);
    return;
  }

  // Attach standard screenshot paths to fetched games
  GAMES_DATA = data.map(game => ({
    ...game,
    screenshots: [
      'assets/brand/snap.png',
      'assets/brand/snap.png',
      'assets/brand/snap.png'
    ]
  }));

  renderGames(GAMES_DATA);
}

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
  if (!grid) return;
  
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
  const selectedGame = GAMES_DATA.find(g => g.id === gameId);
  if (!selectedGame) return;

  selectedGameForWishlist = selectedGame;
  document.getElementById('detail-title').innerText = selectedGame.title;
  document.getElementById('detail-price').innerText = `Price: ${selectedGame.price}`;
  document.getElementById('detail-img').src = selectedGame.image_url;

  const video = document.getElementById('preview-video');
  const videoSrc = document.getElementById('preview-video-src');
  if (selectedGame.video_url && video && videoSrc) {
    videoSrc.src = selectedGame.video_url;
    video.load();
  }

  const container = document.getElementById('screen-grabs-container');
  if (container) {
    container.innerHTML = selectedGame.screenshots.map(src => `
      <img src="${src}" class="bg-zinc-900 rounded-lg h-14 w-full object-cover border border-zinc-700" alt="Grab" />
    `).join('');
  }

  navigateTo('modal-checkout');
}
/* ==================== SESSION & LOGIN LOGIC ==================== */

function setCurrentUser(user) {
  currentUser = user;
  localStorage.setItem('kiosk_user_email', user.email);
  
  const loginText = document.getElementById('login-text');
  if (loginText) {
    loginText.innerText = user.email.split('@')[0];
  }
}

function logoutUser() {
  currentUser = null;
  localStorage.removeItem('kiosk_user_email');
  
  const loginText = document.getElementById('login-text');
  if (loginText) {
    loginText.innerText = 'Login';
  }
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

    if (user) {
      setCurrentUser(user);
    }
  } catch (err) {
    console.error('Session restore failed:', err);
  }
}

async function saveGameToUserWishlist(user, gameTitle) {
  let wishlistArray = user.wishlist ? user.wishlist.split(', ').filter(Boolean) : [];

  if (!wishlistArray.includes(gameTitle)) {
    wishlistArray.push(gameTitle);
  }

  const updatedWishlist = wishlistArray.join(', ');

  const { error: updateError } = await supabaseClient
    .from('users')
    .update({ wishlist: updatedWishlist })
    .eq('id', user.id);

  if (!updateError) {
    user.wishlist = updatedWishlist;
    closeWishlistAuthModal();
    alert(`"${gameTitle}" saved to your wishlist!`);
  } else {
    alert('Failed to save to wishlist. Please try again.');
  }
}
/* ==================== WISHLIST MODAL LOGIC ==================== */

function openWishlistAuthModal(game = null) {
  if (game) selectedGameForWishlist = game;
  if (currentUser && selectedGameForWishlist) {
    saveGameToUserWishlist(currentUser, selectedGameForWishlist.title);
    return;
  }

  const titleSpan = document.getElementById('wishlist-game-title');
  if (titleSpan) titleSpan.innerText = selectedGameForWishlist?.title || '';
  document.getElementById('wishlist-email-input').value = '';
  document.getElementById('wishlist-pin-input').value = '';
  
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
  saveBtn.innerText = 'SAVING...';

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
      saveBtn.innerText = 'SAVE TO WISHLIST';
      return;
    }
    setCurrentUser(user);

    if (selectedGameForWishlist) {
    let wishlistArray = user.wishlist ? user.wishlist.split(', ').filter(Boolean) : [];

    if (!wishlistArray.includes(selectedGameForWishlist.title)) {
      wishlistArray.push(selectedGameForWishlist.title);
    }

    const updatedWishlist = wishlistArray.join(', ');

    const { error: updateError } = await supabaseClient
      .from('users')
      .update({ wishlist: updatedWishlist })
      .eq('id', user.id);

    if (updateError) throw updateError;

    closeWishlistAuthModal();
    alert(`"${selectedGameForWishlist.title}" saved to wishlist!`);
  } else {
    closeWishlistAuthModal();
    alert(`Logged in as ${user.email}!`);
  }

  } catch (err) {
    console.error('Wishlist error:', err);
    if (errorMsg) {
      errorMsg.innerText = 'Does Not Match, try again.';
      errorMsg.classList.remove('hidden');
    }
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = 'SAVE TO WISHLIST';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Fetch dynamic game list directly from Supabase
  loadGamesFromSupabase();
  checkSavedUserSession();

  document.getElementById('screen-landing')?.addEventListener('click', () => {
    navigateTo('screen-browse');
  });

  document.getElementById('btn-cancel')?.addEventListener('click', () => {
    navigateTo('screen-browse');
  });

  document.getElementById('btn-error-reset')?.addEventListener('click', () => {
    navigateTo('screen-landing');
  });
  document.getElementById('btn-wishlist')?.addEventListener('click', openWishlistAuthModal);
  document.getElementById('btn-cancel-wishlist')?.addEventListener('click', closeWishlistAuthModal);
  document.getElementById('btn-save-wishlist')?.addEventListener('click', handleWishlistSubmission);
  document.getElementById('btn-login')?.addEventListener('click', () => {
  if (currentUser) {
    if (confirm(`Logged in as ${currentUser.email}. Do you want to log out?`)) {
      logoutUser();
    }
  } else {
    openLoginModal();
  }
});
});
