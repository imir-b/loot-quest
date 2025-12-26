/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOOTQUEST DASHBOARD - REVENUE-GENERATING FRONTEND
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * This file handles:
 * 1. User authentication & session management
 * 2. Real-time data hydration (avatar, username, balance)
 * 3. Lootably offerwall integration (MONETIZATION)
 * 4. Withdrawal system
 * 5. Live feed for social proof
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const LOOTABLY_PLACEMENT_ID = 'clq9zy73v'; // TODO: Replace with your actual Placement ID
const LOOTABLY_APP_ID = '12345'; // TODO: Replace with your actual App ID

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════

let currentUser = null;
let userBalance = 0;

// ═══════════════════════════════════════════════════════════════════════════
// 1. AUTH PROTECTION & DATA HYDRATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Main initialization - Called after auth state is confirmed
 */
async function initDashboard(user) {
    console.log('🚀 Initializing dashboard for:', user.email);
    currentUser = user;

    try {
        // Fetch user data from backend
        const response = await fetch('/api/user/me', {
            credentials: 'include' // Include session cookie
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user data');
        }

        const data = await response.json();

        if (data.success) {
            console.log('✅ User data loaded:', data.user);

            // Update UI with real data
            await hydrateUserData(data.user);

            // Initialize Lootably offerwall
            initializeLootably(data.user.id);

            // Start live feed animation
            startLiveFeed();

            // Initialize withdrawal system
            initializeWithdrawals();

        } else {
            console.error('❌ Failed to load user data:', data.error);
            showToast('Erreur de chargement des données', 'error');
        }

    } catch (error) {
        console.error('❌ Dashboard initialization error:', error);
        showToast('Erreur de connexion au serveur', 'error');
    }
}

/**
 * Hydrate UI with real user data
 */
async function hydrateUserData(userData) {
    // Store balance globally
    userBalance = userData.balance || 0;

    // 1. Update Avatar (with fallback)
    const avatarImg = document.querySelector('img[alt="Avatar"]');
    if (avatarImg) {
        if (userData.avatarUrl) {
            avatarImg.src = userData.avatarUrl;
        } else {
            // Generate avatar from email or displayName
            const seed = userData.displayName || userData.email;
            avatarImg.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
        }
    }

    // 2. Update Balance with animation
    const balanceElement = document.querySelector('.text-2xl.text-transparent.bg-clip-text');
    if (balanceElement) {
        await animateBalance(balanceElement, 0, userBalance, 1000);
    }

    // 3. Update Progress Bar (toward next withdrawal goal)
    updateProgressBar(userBalance);

    console.log('✅ UI hydrated with user data');
}

/**
 * Animate balance counting up
 */
function animateBalance(element, start, end, duration) {
    return new Promise(resolve => {
        const startTime = Date.now();
        const range = end - start;

        function update() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(start + range * easeOut);

            element.textContent = formatNumber(current);

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                resolve();
            }
        }

        update();
    });
}

/**
 * Format number with commas
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Update withdrawal progress bar
 */
function updateProgressBar(balance) {
    const minWithdrawal = 5000; // 5000 points = $5.00
    const progress = Math.min((balance / minWithdrawal) * 100, 100);
    const remaining = Math.max(minWithdrawal - balance, 0);

    // Update progress bar
    const progressBar = document.querySelector('.h-3 .bg-cyberpunk');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }

    // Update percentage text
    const percentText = document.querySelector('.text-xs.font-mono.text-slate-300');
    if (percentText) {
        percentText.textContent = `${Math.floor(progress)}% Complété`;
    }

    // Update remaining points text
    const remainingText = document.querySelector('.text-xs.text-slate-400 .text-white.font-bold');
    if (remainingText) {
        if (remaining > 0) {
            remainingText.textContent = `${formatNumber(remaining)} pts`;
        } else {
            remainingText.textContent = `Prêt pour le retrait!`;
            remainingText.classList.add('text-green-400');
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. LOOTABLY OFFERWALL INTEGRATION (CRITICAL - REVENUE)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Initialize Lootably offerwall
 * CRITICAL: This is where you make money!
 */
function initializeLootably(userId) {
    console.log('💰 Initializing Lootably offerwall for user:', userId);

    // Get the Lootably card
    const lootablyCard = document.querySelector('.glass-card.rounded-2xl.p-5.group.cursor-pointer');

    if (!lootablyCard) {
        console.error('❌ Lootably card not found in DOM');
        return;
    }

    // Build Lootably URL with user ID for postback tracking
    const lootablyUrl = `https://wall.lootably.com/?placementID=${LOOTABLY_PLACEMENT_ID}&sid=${userId}`;

    console.log('🔗 Lootably URL:', lootablyUrl);

    // Add click handler to open Lootably in new tab/iframe
    lootablyCard.addEventListener('click', () => {
        console.log('🎯 Opening Lootably offerwall');

        // Option 1: Open in new tab (recommended for better UX)
        window.open(lootablyUrl, '_blank', 'noopener,noreferrer');

        // Option 2: Open in modal with iframe (alternative)
        // openLootablyModal(lootablyUrl);
    });

    console.log('✅ Lootably initialized and ready to earn!');
}

/**
 * Optional: Open Lootably in modal with iframe
 */
function openLootablyModal(url) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm';
    modal.innerHTML = `
        <div class="relative w-full max-w-6xl h-[90vh] bg-slate-900 rounded-2xl overflow-hidden border border-white/10">
            <button onclick="this.closest('.fixed').remove()" 
                    class="absolute top-4 right-4 z-10 w-10 h-10 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white font-bold transition-colors">
                ✕
            </button>
            <iframe src="${url}" 
                    class="w-full h-full" 
                    frameborder="0"
                    allow="payment">
            </iframe>
        </div>
    `;
    document.body.appendChild(modal);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. SHOP & WITHDRAWAL SYSTEM (MARKETPLACE)
// ═══════════════════════════════════════════════════════════════════════════

// --- DATA: REWARDS CATALOG ---
// Logo URLs sourced from reliable CDNs/Wikimedia
const SHOP_DATA = [
    // GAMING
    {
        id: 'fortnite-1000',
        name: '1000 V-Bucks',
        category: 'gaming',
        price: 10,
        cost: 10000,
        currency: 'EUR',
        brand: 'Fortnite',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Fortnite_F_lettermark_logo.png',
        gradient: 'from-blue-600 to-purple-600',
        popular: true
    },
    {
        id: 'fortnite-2800',
        name: '2800 V-Bucks',
        category: 'gaming',
        price: 25,
        cost: 25000,
        currency: 'EUR',
        brand: 'Fortnite',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Fortnite_F_lettermark_logo.png',
        gradient: 'from-blue-600 to-purple-600',
        popular: false
    },
    {
        id: 'roblox-400',
        name: '400 Robux',
        category: 'gaming',
        price: 5,
        cost: 5000,
        currency: 'EUR',
        brand: 'Roblox',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Roblox_Logo_2022.png',
        gradient: 'from-slate-700 to-slate-900',
        popular: true
    },
    {
        id: 'roblox-800',
        name: '800 Robux',
        category: 'gaming',
        price: 10,
        cost: 10000,
        currency: 'EUR',
        brand: 'Roblox',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Roblox_Logo_2022.png',
        gradient: 'from-slate-700 to-slate-900',
        popular: true
    },
    {
        id: 'valorant-1000',
        name: '1000 VP',
        category: 'gaming',
        price: 10,
        cost: 10000,
        currency: 'EUR',
        brand: 'Valorant',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Valorant_logo_-_pink_color_version.svg',
        gradient: 'from-rose-500 to-red-600',
        popular: false
    },

    // CASH (PAYPAL)
    {
        id: 'paypal-5',
        name: '5€ Solde PayPal',
        category: 'cash',
        price: 5,
        cost: 5000,
        currency: 'EUR',
        brand: 'PayPal',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
        gradient: 'from-blue-700 to-indigo-800',
        popular: true
    },
    {
        id: 'paypal-10',
        name: '10€ Solde PayPal',
        category: 'cash',
        price: 10,
        cost: 10000,
        currency: 'EUR',
        brand: 'PayPal',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
        gradient: 'from-blue-700 to-indigo-800',
        popular: true
    },
    {
        id: 'paypal-20',
        name: '20€ Solde PayPal',
        category: 'cash',
        price: 20,
        cost: 20000,
        currency: 'EUR',
        brand: 'PayPal',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
        gradient: 'from-blue-700 to-indigo-800',
        popular: false
    },
    {
        id: 'paypal-50',
        name: '50€ Solde PayPal',
        category: 'cash',
        price: 50,
        cost: 50000,
        currency: 'EUR',
        brand: 'PayPal',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
        gradient: 'from-blue-700 to-indigo-800',
        popular: false
    },

    // GIFT CARDS
    {
        id: 'amazon-10',
        name: '10€ Amazon',
        category: 'giftcards',
        price: 10,
        cost: 10000,
        currency: 'EUR',
        brand: 'Amazon',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
        gradient: 'from-amber-500 to-orange-600',
        popular: false
    },
    {
        id: 'steam-10',
        name: '10€ Steam Wallet',
        category: 'giftcards',
        price: 10,
        cost: 10000,
        currency: 'EUR',
        brand: 'Steam',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg',
        gradient: 'from-blue-900 to-slate-900',
        popular: true
    },
    {
        id: 'googleplay-15',
        name: '15€ Google Play',
        category: 'giftcards',
        price: 15,
        cost: 15000,
        currency: 'EUR',
        brand: 'Google Play',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Google_Play_Arrow_logo.svg',
        gradient: 'from-green-500 to-emerald-600',
        popular: false
    }
];

// --- STATE ---
let shopState = {
    category: 'all', // all, popular, cash, gaming, giftcards
    sort: null, // null, price_asc, price_desc
    search: ''
};

/**
 * Initialize Shop System
 */
function initializeWithdrawals() {
    console.log('🛒 Initializing Marketplace...');
    renderShop();

    // Init Search Listener
    const searchInput = document.getElementById('shop-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            shopState.search = e.target.value.toLowerCase();
            renderShop();
        });
    }
}

/**
 * Filter Shop by Category
 */
function filterCategory(cat) {
    shopState.category = cat;

    // Update Tabs UI
    document.querySelectorAll('.shop-tab').forEach(btn => {
        if (btn.dataset.cat === cat) {
            btn.classList.add('active', 'text-white', 'bg-white/10');
            btn.classList.remove('text-gray-400', 'hover:text-white', 'hover:bg-white/5');
        } else {
            btn.classList.remove('active', 'text-white', 'bg-white/10');
            btn.classList.add('text-gray-400', 'hover:text-white', 'hover:bg-white/5');
        }
    });

    renderShop();
}

/**
 * Sort Shop
 */
function sortShop(sortType) {
    shopState.sort = sortType;
    renderShop();
}

/**
 * Render the Shop Grid based on current state
 */
function renderShop() {
    const grid = document.getElementById('shop-grid');
    const balanceDisplay = document.getElementById('shop-balance-display');
    const countDisplay = document.getElementById('shop-count');

    if (balanceDisplay) balanceDisplay.innerHTML = formatNumber(userBalance) + ' PTS';

    // 1. FILTER
    let filtered = SHOP_DATA.filter(item => {
        // Category Filter
        if (shopState.category === 'popular' && !item.popular) return false;
        if (shopState.category !== 'all' && shopState.category !== 'popular' && item.category !== shopState.category) return false;

        // Search Filter
        if (shopState.search && !item.name.toLowerCase().includes(shopState.search) && !item.brand.toLowerCase().includes(shopState.search)) return false;

        return true;
    });

    // 2. SORT
    if (shopState.sort === 'price_asc') {
        filtered.sort((a, b) => a.cost - b.cost);
    } else if (shopState.sort === 'price_desc') {
        filtered.sort((a, b) => b.cost - a.cost);
    }

    // Update Count
    if (countDisplay) countDisplay.innerText = filtered.length;

    // 3. GENERATE HTML
    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-20 text-center text-gray-500">
                <p>Aucune récompense trouvée pour cette recherche.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(item => createShopCard(item)).join('');
}

/**
 * Create a rich Reward Card
 */
function createShopCard(item) {
    // Calculs Logic
    const progress = Math.min((userBalance / item.cost) * 100, 100);
    const canAfford = userBalance >= item.cost;
    const isAffordable = userBalance >= item.cost;

    // Gradient Background for Header
    const bgClass = `bg-gradient-to-br ${item.gradient}`;

    return `
    <div class="group relative bg-[#151A23] border border-white/5 hover:border-primary/50 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 flex flex-col h-full">
        
        <!-- Header Image -->
        <div class="h-32 ${bgClass} relative p-6 flex items-center justify-center overflow-hidden">
            <!-- Background Pattern -->
            <div class="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            
            <!-- Logo with drop shadow -->
            <img src="${item.logo}" alt="${item.brand}" class="h-16 w-auto object-contain drop-shadow-2xl relative z-10 hover:scale-110 transition-transform duration-300">
            
            <!-- Tag -->
            ${item.popular ? '<span class="absolute top-3 right-3 px-2 py-1 bg-black/40 backdrop-blur text-[10px] font-bold text-yellow-400 uppercase rounded border border-yellow-400/30">Populaire</span>' : ''}
        </div>

        <!-- Body -->
        <div class="p-5 flex-1 flex flex-col">
            <h3 class="font-display font-bold text-lg text-white mb-1 group-hover:text-primary transition-colors line-clamp-1">${item.name}</h3>
            <p class="text-xs text-gray-500 uppercase tracking-wide mb-4">${item.brand}</p>

            <div class="mt-auto">
                <!-- Data Row -->
                <div class="flex items-end justify-between mb-3">
                    <div>
                        <span class="block text-2xl font-bold text-white">${formatNumber(item.cost)} <span class="text-sm font-normal text-gray-500">pts</span></span>
                    </div>
                    <span class="text-sm font-bold text-gray-400 bg-white/5 px-2 py-1 rounded">${item.price} €</span>
                </div>

                <!-- Progress Bar -->
                <div class="w-full h-1.5 bg-gray-800 rounded-full mb-4 overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-1000 ${canAfford ? 'bg-accent' : 'bg-primary'}" 
                         style="width: ${progress}%"></div>
                </div>

                <!-- Action Button -->
                <button onclick="confirmRedeem('${item.id}', '${item.name}', ${item.cost})" 
                    class="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
                    ${canAfford
            ? 'bg-white text-black hover:bg-gray-200 hover:scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.2)]'
            : 'bg-white/5 text-gray-500 cursor-not-allowed hover:bg-white/10'}">
                    ${canAfford
            ? `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> ÉCHANGER`
            : `Manque ${formatNumber(item.cost - userBalance)} pts`}
                </button>
            </div>
        </div>
    </div>
    `;
}

/**
 * Confirm Redemption Modal
 */
function confirmRedeem(id, name, cost) {
    if (userBalance < cost) return;

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4';

    modal.innerHTML = `
        <div class="bg-[#151A23] border border-white/10 rounded-3xl max-w-sm w-full p-8 relative overflow-hidden shadow-2xl">
            <!-- Glow Effect -->
            <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

            <div class="text-center mb-8">
                <div class="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl animate-bounce">
                    🎁
                </div>
                <h3 class="font-display font-bold text-2xl text-white mb-2">Confirmer l'échange ?</h3>
                <p class="text-gray-400 text-sm leading-relaxed">
                    Vous allez échanger <strong class="text-accent">${formatNumber(cost)} pts</strong> contre :<br>
                    <strong class="text-white text-lg mt-2 block">${name}</strong>
                </p>
            </div>

            <div class="flex flex-col gap-3">
                <button onclick="processRedemption('${id}', ${cost})" 
                    class="w-full py-3.5 bg-accent text-black font-bold rounded-xl hover:bg-emerald-400 hover:scale-[1.02] transition-all shadow-lg shadow-accent/20">
                    Confirmer ( -${formatNumber(cost)} pts )
                </button>
                <button onclick="this.closest('.fixed').remove()" 
                    class="w-full py-3.5 bg-transparent text-gray-500 font-semibold hover:text-white transition-colors">
                    Annuler
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

/**
 * Process Redemption (Backend Call)
 */
async function processRedemption(rewardId, cost) {
    // Close modals
    document.querySelectorAll('.fixed.z-\\[60\\]').forEach(m => m.remove());

    // Show loading toast
    showToast('⏳ Traitement en cours...', 'info');

    try {
        const response = await fetch('/api/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rewardId }) // Use standard rewardId param
        });

        const data = await response.json();

        if (data.success) {
            // Success!
            userBalance -= cost;
            updateUIInvterface({ ...currentUser, balance: userBalance });
            renderShop(); // Re-render to update buttons states

            // Celebration
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });

            showToast('✅ Récompense envoyée ! Vérifiez vos emails.', 'success');
        } else {
            showToast('❌ ' + (data.error || 'Erreur inconnue'), 'error');
        }

    } catch (e) {
        console.error(e);
        showToast('❌ Erreur de connexion', 'error');
    }
}


// ═══════════════════════════════════════════════════════════════════════════
// 4. LIVE FEED (SOCIAL PROOF)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Start live feed animation
 */
function startLiveFeed() {
    // The CSS animation already handles the scrolling
    // We can dynamically update the feed with real data later
    console.log('📢 Live feed started (using CSS animation)');

    // TODO: Connect to WebSocket for real-time updates
    // For now, the static HTML feed is sufficient
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-yellow-500'
    };

    const toast = document.createElement('div');
    toast.className = `fixed top-6 right-6 z-[100] ${colors[type]} text-white px-6 py-4 rounded-xl shadow-2xl font-semibold animate-[slideInRight_0.3s_ease-out] max-w-md`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. INITIALIZE ON AUTH STATE CHANGE
// ═══════════════════════════════════════════════════════════════════════════

// The auth check is already in dashboard.html
// We need to hook into it to call initDashboard

firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        // User is authenticated
        const provider = user.providerData[0]?.providerId;

        // Check email verification for password users
        if (provider === 'password' && !user.emailVerified) {
            console.log('⚠️ Email not verified -> redirect to login');
            window.location.href = '/';
            return;
        }

        // Initialize dashboard with user data
        await initDashboard(user);

    } else {
        // No Firebase user - check server session (Discord)
        try {
            const res = await fetch('/api/user/me', { credentials: 'include' });

            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    // Server session valid (Discord user)
                    await initDashboard({
                        uid: data.user.id,
                        email: data.user.email,
                        displayName: data.user.displayName,
                        photoURL: data.user.avatarUrl
                    });
                    return;
                }
            }
        } catch (error) {
            console.error('❌ Session check error:', error);
        }

        // No valid session - redirect to login
        console.log('⛔ No auth found. Redirecting to login...');
        window.location.href = '/';
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. EXPORT CONFIG FOR EASY CUSTOMIZATION
// ═══════════════════════════════════════════════════════════════════════════

console.log('💡 To change Lootably configuration, update these values at the top of dashboard.js:');
console.log('   LOOTABLY_PLACEMENT_ID:', LOOTABLY_PLACEMENT_ID);
console.log('   LOOTABLY_APP_ID:', LOOTABLY_APP_ID);
