// --- 1. MOCK DATABASE (Backend Simulation) ---
const DB = {
    user: {
        username: "NeonHunter_99",
        pixels: 1250,
        xp: 450,
        level: 3,
        rank: "CHASSEUR DE PRIMES",
        nextLevelXp: 1000
    },
    activeQuests: [
        { id: 1, title: "Regarder 3 Pubs Vidéo", progress: 1, total: 3, reward: 150, icon: "fa-eye", color: "text-neon-blue" },
        { id: 2, title: "Installer 'Rise of Kingdoms'", progress: 0, total: 1, reward: 2500, icon: "fa-download", color: "text-toxic-green" },
        { id: 3, title: "Parrainer 1 Ami", progress: 0, total: 1, reward: 500, icon: "fa-user-plus", color: "text-neon-purple" }
    ],
    shopItems: [
        { id: 1, name: "1,000 V-Bucks", price: 1800, image: "fa-fort-awesome", type: "Fortnite", color: "text-purple-400" },
        { id: 2, name: "Carte Roblox 10€", price: 2200, image: "fa-cube", type: "Roblox", color: "text-gray-300" },
        { id: 3, name: "Skin Mystère", price: 500, image: "fa-mask", type: "Random", color: "text-alert-red" },
        { id: 4, name: "Paysafecard 20€", price: 4500, image: "fa-credit-card", type: "Cash", color: "text-yellow-400" },
        { id: 5, name: "Nitro Discord 1 Mois", price: 1900, image: "fa-discord", type: "Discord", color: "text-indigo-400" }
    ],
    history: [
        { date: "19 Nov", action: "Quête: Raid Shadow Legends", amount: "+ 1200", status: "Validé", type: "in" },
        { date: "18 Nov", action: "Bonus Connexion", amount: "+ 50", status: "Validé", type: "in" },
        { date: "15 Nov", action: "Retrait: 1000 V-Bucks", amount: "- 1800", status: "En cours (J-2)", type: "out" },
        { date: "10 Nov", action: "Parrainage: KevinDu93", amount: "+ 500", status: "Validé", type: "in" }
    ],
    leaderboard: [
        { rank: 1, name: "SlayerGod", pixels: 154000 },
        { rank: 2, name: "LaraCraft", pixels: 98000 },
        { rank: 3, name: "NoobMaster", pixels: 87500 },
        { rank: 4, name: "NeonHunter_99", pixels: 12500 },
        { rank: 5, name: "EzWin", pixels: 5000 }
    ],
    // New Data for Admin Panel
    adminWithdrawals: [
        { id: 101, user: "Kevdu93", item: "1000 V-Bucks", status: "Pending", risk: "Low" },
        { id: 102, user: "BotMasterX", item: "Paysafecard 50€", status: "Flagged", risk: "High (VPN Detected)" },
        { id: 103, user: "Sophie_Gamer", item: "Carte Roblox", status: "Pending", risk: "Low" }
    ],
    chatHistory: []
};

// --- GEMINI API HELPERS ---
async function callGemini(prompt, systemInstruction = "") {
    if (!Config.GEMINI_API_KEY) {
        alert("API Key manquant. L'IA ne peut pas répondre.");
        return "Désolé, je suis en maintenance technique.";
    }

    const url = `${Config.ENDPOINTS.GEMINI}?key=${Config.GEMINI_API_KEY}`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Je n'ai pas de réponse pour le moment.";
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Erreur de connexion au serveur IA.";
    }
}

// --- 2. VIEW COMPONENTS (HTML Generators) ---

const Views = {
    dashboard: () => `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="glass p-6 rounded-2xl border-l-4 border-neon-purple relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><i class="fa-solid fa-wallet text-6xl"></i></div>
                <h3 class="text-gray-400 text-sm font-gaming mb-1">SOLDE ACTUEL</h3>
                <p class="text-3xl font-bold text-white">${DB.user.pixels} <span class="text-sm text-neon-purple">Px</span></p>
                <button onclick="router('loot')" class="mt-4 text-xs bg-neon-purple/20 text-neon-purple px-3 py-1 rounded hover:bg-neon-purple hover:text-white transition-colors">DÉPENSER</button>
            </div>
            <div class="glass p-6 rounded-2xl border-l-4 border-neon-blue relative overflow-hidden">
                <div class="absolute right-0 top-0 p-4 opacity-10"><i class="fa-solid fa-bolt text-6xl"></i></div>
                <h3 class="text-gray-400 text-sm font-gaming mb-1">NIVEAU ${DB.user.level}</h3>
                <p class="text-3xl font-bold text-white">${DB.user.xp} <span class="text-sm text-gray-500">/ ${DB.user.nextLevelXp} XP</span></p>
                <div class="w-full h-2 bg-gray-700 rounded-full mt-4 overflow-hidden">
                    <div class="h-full bg-neon-blue" style="width: ${(DB.user.xp / DB.user.nextLevelXp) * 100}%"></div>
                </div>
            </div>
            <div class="glass p-6 rounded-2xl border-l-4 border-toxic-green relative overflow-hidden">
                <div class="absolute right-0 top-0 p-4 opacity-10"><i class="fa-solid fa-clock text-6xl"></i></div>
                <h3 class="text-gray-400 text-sm font-gaming mb-1">PROCHAIN RETRAIT</h3>
                <p class="text-3xl font-bold text-white">Speed Run</p>
                <p class="text-xs text-toxic-green mt-2"><i class="fa-solid fa-check-circle"></i> Mode vérifié actif (24h)</p>
            </div>
        </div>

        <h3 class="font-gaming text-xl mb-4 flex items-center gap-2"><i class="fa-solid fa-fire text-orange-500"></i> QUÊTES ACTIVES</h3>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            ${DB.activeQuests.map(quest => `
                <div class="bg-void-light p-4 rounded-xl border border-white/5 flex items-center gap-4 hover:border-white/20 transition-colors">
                    <div class="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center text-2xl ${quest.color}">
                        <i class="fa-solid ${quest.icon}"></i>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between mb-1">
                            <span class="font-bold text-sm">${quest.title}</span>
                            <span class="text-xs text-neon-purple font-gaming">+${quest.reward} Px</span>
                        </div>
                        <div class="w-full h-2 bg-black rounded-full">
                            <div class="h-full bg-gradient-to-r from-neon-purple to-neon-blue" style="width: ${(quest.progress / quest.total) * 100}%"></div>
                        </div>
                        <div class="text-right text-[10px] text-gray-500 mt-1">${quest.progress} / ${quest.total}</div>
                    </div>
                    <button class="bg-white/10 hover:bg-white/20 p-2 rounded-lg text-white transition-colors"><i class="fa-solid fa-play"></i></button>
                </div>
            `).join('')}
        </div>
    `,

    earn: () => `
        <div class="flex flex-col items-center justify-center h-[60vh] text-center">
            <div class="w-24 h-24 bg-neon-blue/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <i class="fa-solid fa-satellite-dish text-4xl text-neon-blue"></i>
            </div>
            <h2 class="font-gaming text-3xl font-bold mb-4">MUR D'OFFRES</h2>
            <p class="text-gray-400 max-w-md mb-8">Connecte-toi aux satellites partenaires pour recevoir des missions. (Simulation: Ici s'afficheraient les iFrames AdGate/OfferToro).</p>
            <button class="bg-neon-blue text-black font-bold font-gaming px-8 py-3 rounded hover:bg-white transition-colors">
                SCANNER LES FRÉQUENCES
            </button>
        </div>
    `,

    loot: () => `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            ${DB.shopItems.map(item => {
        const isLocked = DB.user.pixels < item.price;
        return `
                <div class="bg-void-light rounded-xl overflow-hidden border border-white/5 group relative ${isLocked ? 'locked-item' : 'hover:border-neon-purple transition-all hover:-translate-y-1'}">
                    <div class="h-32 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative">
                        <i class="fa-brands ${item.image} text-5xl ${item.color}"></i>
                        ${isLocked ? '<div class="absolute inset-0 bg-black/60 flex items-center justify-center"><i class="fa-solid fa-lock text-3xl text-gray-400"></i></div>' : ''}
                    </div>
                    <div class="p-4">
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="font-bold font-gaming text-white">${item.name}</h4>
                            <span class="text-[10px] bg-white/10 px-2 py-1 rounded uppercase text-gray-400">${item.type}</span>
                        </div>
                        <div class="flex items-center justify-between mt-4">
                            <span class="text-yellow-400 font-bold font-gaming text-lg">${item.price} Px</span>
                            <button class="${isLocked ? 'bg-gray-700 cursor-not-allowed' : 'bg-neon-purple hover:bg-neon-blue'} text-white px-4 py-2 rounded font-bold text-xs transition-colors">
                                ${isLocked ? 'MANQUE XP' : 'ACHETER'}
                            </button>
                        </div>
                    </div>
                </div>
                `
    }).join('')}
        </div>
    `,

    inventory: () => `
        <div class="glass rounded-xl overflow-hidden">
            <table class="w-full text-left">
                <thead class="bg-white/5 text-xs font-gaming text-gray-400 uppercase">
                    <tr>
                        <th class="p-4">Date</th>
                        <th class="p-4">Action</th>
                        <th class="p-4 text-right">Montant</th>
                        <th class="p-4 text-center">Statut</th>
                    </tr>
                </thead>
                <tbody class="text-sm text-gray-300 divide-y divide-white/5">
                    ${DB.history.map(row => `
                        <tr class="hover:bg-white/5 transition-colors">
                            <td class="p-4">${row.date}</td>
                            <td class="p-4 font-medium text-white">${row.action}</td>
                            <td class="p-4 text-right font-bold ${row.type === 'in' ? 'text-toxic-green' : 'text-alert-red'}">
                                ${row.amount}
                            </td>
                            <td class="p-4 text-center">
                                <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${row.status.includes('Validé') ? 'bg-toxic-green/20 text-toxic-green' : 'bg-yellow-500/20 text-yellow-500'}">
                                    ${row.status}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `,

    leaderboard: () => `
        <div class="glass rounded-xl p-1">
            <div class="grid grid-cols-12 gap-4 p-4 text-xs font-gaming text-gray-500 border-b border-white/5 uppercase">
                <div class="col-span-2 text-center">Rang</div>
                <div class="col-span-7">Joueur</div>
                <div class="col-span-3 text-right">Score (XP)</div>
            </div>
            <div class="space-y-1 mt-1">
                ${DB.leaderboard.map(user => `
                    <div class="grid grid-cols-12 gap-4 p-4 items-center rounded hover:bg-white/5 transition-colors ${user.name === DB.user.username ? 'bg-neon-purple/20 border border-neon-purple/50' : ''}">
                        <div class="col-span-2 text-center font-bold text-lg ${user.rank <= 3 ? 'text-yellow-400' : 'text-gray-400'}">#${user.rank}</div>
                        <div class="col-span-7 flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                                <i class="fa-solid fa-user"></i>
                            </div>
                            <span class="font-bold text-white">${user.name}</span>
                            ${user.rank === 1 ? '<i class="fa-solid fa-crown text-yellow-400"></i>' : ''}
                        </div>
                        <div class="col-span-3 text-right font-gaming text-neon-blue">${user.pixels.toLocaleString()}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `,

    // --- NEW: TRUST ZONE CHATBOT ---
    aiSupport: () => `
        <div class="max-w-4xl mx-auto flex flex-col h-[calc(100vh-180px)] lg:h-[calc(100vh-140px)] bg-panel rounded-2xl overflow-hidden border border-gray-700 font-sans shadow-xl">
            <!-- Header -->
            <div class="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                        <i class="fa-solid fa-headset text-white text-lg"></i>
                    </div>
                    <div>
                        <h3 class="text-white font-bold">Assistant Support</h3>
                        <p class="text-xs text-gray-400">Intelligence Artificielle • <span class="text-green-400">En ligne</span></p>
                    </div>
                </div>
                <button onclick="DB.chatHistory = []; router('aiSupport')" class="text-xs text-gray-500 hover:text-white transition-colors bg-gray-700 px-3 py-1 rounded">Effacer la conversation</button>
            </div>

            <!-- Chat Area -->
            <div id="chat-messages" class="flex-1 overflow-y-auto p-6 space-y-6 custom-scroll bg-void-light">
                <!-- Welcome Msg -->
                <div class="flex gap-4">
                    <div class="w-8 h-8 bg-blue-600/20 text-blue-500 rounded-full flex-shrink-0 flex items-center justify-center mt-1 border border-blue-600/30"><i class="fa-solid fa-robot"></i></div>
                    <div class="chat-trust-bot p-4 text-sm max-w-[85%] leading-relaxed">
                        <p>Bonjour <strong>${DB.user.username}</strong>. Je suis l'assistant virtuel de LootQuest. Je peux vous aider concernant :</p>
                        <ul class="list-disc list-inside mt-2 text-gray-400">
                            <li>Les délais de paiement</li>
                            <li>Les problèmes avec une offre</li>
                            <li>La sécurisation de votre compte</li>
                        </ul>
                        <p class="mt-2">Comment puis-je vous aider aujourd'hui ?</p>
                    </div>
                </div>

                 <!-- History Injection -->
                ${DB.chatHistory.map(msg => `
                    <div class="flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}">
                        <div class="w-8 h-8 ${msg.role === 'user' ? 'bg-gray-600 text-white' : 'bg-blue-600/20 text-blue-500 border border-blue-600/30'} rounded-full flex-shrink-0 flex items-center justify-center mt-1">
                            <i class="fa-solid ${msg.role === 'user' ? 'fa-user' : 'fa-robot'}"></i>
                        </div>
                        <div class="${msg.role === 'user' ? 'chat-trust-user' : 'chat-trust-bot'} p-4 text-sm max-w-[85%] leading-relaxed">
                            ${marked.parse(msg.text)}
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Input -->
            <div class="p-4 bg-gray-800 border-t border-gray-700">
                <form id="chat-form" class="flex gap-2" onsubmit="handleChatSubmit(event, 'trust')">
                    <input id="chat-input" type="text" placeholder="Posez votre question ici..." class="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" autocomplete="off">
                    <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 rounded-lg transition-colors shadow-lg">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                </form>
            </div>
        </div>
    `,

    support: () => `
        <div class="max-w-3xl mx-auto font-sans">
            <h2 class="text-2xl font-bold mb-2 text-white">Centre d'Aide</h2>
            <p class="text-gray-400 mb-8 text-sm">Une question ? Notre équipe de modération répond sous 24h.</p>

            <div class="bg-panel rounded-lg p-6 mb-8 border border-gray-700">
                <h3 class="font-bold text-lg mb-4 text-white">Questions Fréquentes</h3>
                <div class="space-y-4">
                    <details class="group">
                        <summary class="flex justify-between items-center cursor-pointer list-none p-3 bg-black/30 rounded text-sm font-medium text-gray-200 hover:bg-black/50">
                            <span>Combien de temps pour recevoir mon code ?</span>
                            <span class="transition group-open:rotate-180"><i class="fa-solid fa-chevron-down"></i></span>
                        </summary>
                        <div class="text-gray-400 text-sm p-3 mt-1 leading-relaxed">
                            Pour des raisons de sécurité, votre <strong>premier retrait</strong> prend 7 jours (vérification manuelle). Une fois votre compte validé, les retraits suivants sont traités en 24h à 48h ouvrées.
                        </div>
                    </details>
                    <details class="group">
                        <summary class="flex justify-between items-center cursor-pointer list-none p-3 bg-black/30 rounded text-sm font-medium text-gray-200 hover:bg-black/50">
                            <span>Pourquoi mon offre n'a pas validé mes Pixels ?</span>
                            <span class="transition group-open:rotate-180"><i class="fa-solid fa-chevron-down"></i></span>
                        </summary>
                        <div class="text-gray-400 text-sm p-3 mt-1 leading-relaxed">
                            Cela arrive parfois. Assurez-vous de : 1) Ne pas avoir utilisé de VPN, 2) Ne pas avoir installé l'app auparavant, 3) Avoir attendu 24h. Si le problème persiste, contactez le support de l'Offerwall (Tapjoy/AdGate) directement.
                        </div>
                    </details>
                </div>
            </div>

            <form class="bg-panel rounded-lg p-6 border border-gray-700" onsubmit="event.preventDefault(); alert('Message envoyé au support !');">
                <h3 class="font-bold text-lg mb-4 text-white">Contact Direct</h3>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <input type="text" placeholder="Sujet" class="col-span-2 bg-black/50 border border-gray-600 rounded p-3 text-sm focus:border-gray-400 outline-none text-white">
                    <textarea placeholder="Description du problème..." class="col-span-2 h-32 bg-black/50 border border-gray-600 rounded p-3 text-sm focus:border-gray-400 outline-none text-white"></textarea>
                </div>
                <button class="bg-white text-black font-bold py-2 px-6 rounded text-sm hover:bg-gray-200 transition-colors">Envoyer le ticket</button>
            </form>
        </div>
    `,

    legal: () => `
        <div class="max-w-4xl mx-auto font-sans text-gray-300 bg-panel p-8 rounded-lg border border-gray-700">
            <h1 class="text-3xl font-bold text-white mb-2 border-b border-gray-600 pb-4">Conditions Générales d'Utilisation (CGU)</h1>
            <p class="text-xs text-gray-500 mb-6">Dernière mise à jour : 28 Novembre 2025</p>
            
            <div class="space-y-6 text-sm leading-relaxed">
                <section>
                    <h3 class="text-white font-bold text-lg mb-2">PRÉAMBULE</h3>
                    <p>Les présentes Conditions Générales d'Utilisation (ci-après "CGU") régissent l'utilisation de la plateforme "LootQuest" (ci-après le "Site"), éditée par [NOM DE TA SOCIÉTÉ OU TON NOM], (ci-après "l'Éditeur"). En accédant au Site, en créant un compte ou en utilisant les services offerts, l'Utilisateur accepte sans réserve les présentes CGU.</p>
                </section>

                <section>
                    <h3 class="text-white font-bold text-lg mb-2">ARTICLE 1 : OBJET ET SERVICES</h3>
                    <p>LootQuest est une plateforme de récompenses publicitaires agissant en tant qu'intermédiaire entre des régies publicitaires tierces (Offerwalls) et des utilisateurs finaux. Le service permet aux Utilisateurs de réaliser des actions numériques (sondages, visionnage de vidéos, tests d'applications) en échange d'une monnaie virtuelle interne dénommée "Pixels", échangeable contre des biens numériques.</p>
                </section>

                <section>
                    <h3 class="text-white font-bold text-lg mb-2">ARTICLE 2 : ÉLIGIBILITÉ ET ACCÈS</h3>
                    <p class="mb-2"><strong>2.1. Âge requis.</strong> L'utilisation du Site est réservée aux personnes âgées d'au moins 13 ans. Les mineurs de moins de 18 ans doivent obtenir l'autorisation préalable de leurs représentants légaux pour utiliser le Site. L'Éditeur se réserve le droit de demander toute preuve de cette autorisation.</p>
                    <p><strong>2.2. Unicité du compte.</strong> L'accès est strictement limité à un (1) compte par personne physique et par foyer (adresse IP). La création de comptes multiples (multi-accounting) pour cumuler des récompenses est strictement interdite et entraînera la suspension immédiate et définitive de tous les comptes associés.</p>
                </section>

                <section>
                    <h3 class="text-white font-bold text-lg mb-2">ARTICLE 3 : LA MONNAIE VIRTUELLE "PIXELS"</h3>
                    <p class="mb-2"><strong>3.1. Nature juridique.</strong> Les "Pixels" constituent une unité de compte virtuelle propre au Site. Ils ne possèdent aucune valeur monétaire réelle, ne sont ni une monnaie électronique ni un instrument financier, et ne peuvent jamais être échangés contre de l'argent fiduciaire (Euros, Dollars, etc.).</p>
                    <p class="mb-2"><strong>3.2. Propriété.</strong> L'Utilisateur ne possède aucun droit de propriété sur les Pixels. Ils représentent une licence limitée, révocable et non transférable d'accès à des récompenses. L'Éditeur se réserve le droit de modifier la valeur d'échange des Pixels à tout moment sans préavis.</p>
                    <p><strong>3.3. Expiration.</strong> Les comptes inactifs pendant une période de six (6) mois consécutifs pourront voir leur solde de Pixels remis à zéro.</p>
                </section>

                <section>
                    <h3 class="text-white font-bold text-lg mb-2">ARTICLE 4 : OBTENTION DES RÉCOMPENSES (OFFERWALLS)</h3>
                    <p class="mb-2"><strong>4.1. Rôle d'intermédiaire.</strong> Les missions (quêtes) sont fournies par des partenaires tiers (AdGate, TapJoy, etc.). LootQuest n'a aucun contrôle sur la validation de ces offres. Si un partenaire refuse de valider une action (non-respect des critères, tracking défaillant), LootQuest ne pourra être tenu de créditer les Pixels.</p>
                    <p class="mb-2"><strong>4.2. Dispositifs Anti-Fraude.</strong> Il est formellement interdit d'utiliser les méthodes suivantes pour compléter des offres :</p>
                    <ul class="list-disc list-inside ml-4 mb-2 text-gray-400">
                        <li>VPN, Proxy ou VPS pour masquer son adresse IP ou sa géolocalisation.</li>
                        <li>Émulateurs Android/iOS (type Bluestacks, Nox) pour simuler un appareil mobile.</li>
                        <li>Scripts d'automatisation ou bots.</li>
                        <li>Bloqueurs de publicités (AdBlock) empêchant le tracking.</li>
                    </ul>
                    <p>Toute détection de ces outils par nos systèmes de sécurité entraînera un bannissement automatique ("Ban Hammer") et la perte irrévocable du solde.</p>
                </section>

                <section>
                    <h3 class="text-white font-bold text-lg mb-2">ARTICLE 5 : BOUTIQUE ET RETRAITS</h3>
                    <p class="mb-2"><strong>5.1. Délais de traitement.</strong> Afin de garantir la sécurité des transactions et de lutter contre la fraude :</p>
                    <ul class="list-disc list-inside ml-4 mb-2 text-gray-400">
                        <li>Le premier retrait effectué par un nouvel Utilisateur est soumis à une période de vérification manuelle de sept (7) jours calendaires.</li>
                        <li>Les retraits suivants sont généralement traités sous 24 à 48 heures ouvrées, sous réserve de disponibilité des stocks.</li>
                    </ul>
                    <p class="mb-2"><strong>5.2. Livraison.</strong> Les récompenses sont livrées sous forme de codes numériques envoyés à l'adresse email associée au compte ou via la messagerie interne du Site. LootQuest ne saurait être tenu responsable en cas d'erreur de saisie de l'adresse email par l'Utilisateur.</p>
                    <p><strong>5.3. Politique de remboursement.</strong> Compte tenu de la nature numérique des récompenses (cartes cadeaux, codes de jeux), aucun remboursement ni échange ne sera effectué une fois le code révélé ou envoyé à l'Utilisateur.</p>
                </section>

                <section>
                    <h3 class="text-white font-bold text-lg mb-2">ARTICLE 6 : PROPRIÉTÉ INTELLECTUELLE</h3>
                    <p class="mb-2"><strong>6.1. Contenu du Site.</strong> Tous les éléments du Site (charte graphique, code source, logos LootQuest) sont la propriété exclusive de l'Éditeur.</p>
                    <p><strong>6.2. Marques Tierces.</strong> Les marques citées (Roblox, Fortnite, PlayStation, etc.) appartiennent à leurs propriétaires respectifs. LootQuest n'est ni affilié, ni sponsorisé, ni soutenu par ces entités. L'utilisation de ces marques sert uniquement à décrire les récompenses disponibles, conformément aux pratiques d'usage loyal.</p>
                </section>

                <section>
                    <h3 class="text-white font-bold text-lg mb-2">ARTICLE 7 : RESPONSABILITÉ</h3>
                    <p class="mb-2">L'Éditeur est tenu à une obligation de moyens. Sa responsabilité ne saurait être engagée en cas de :</p>
                    <ul class="list-disc list-inside ml-4 text-gray-400">
                        <li>Dysfonctionnement des réseaux internet ou des serveurs partenaires.</li>
                        <li>Interruption temporaire du service pour maintenance.</li>
                        <li>Pertes de données résultant d'une intrusion frauduleuse (piratage) malgré les mesures de sécurité mises en place.</li>
                    </ul>
                </section>

                <section>
                    <h3 class="text-white font-bold text-lg mb-2">ARTICLE 8 : PROTECTION DES DONNÉES (RGPD)</h3>
                    <p>Conformément au Règlement Général sur la Protection des Données, l'Utilisateur dispose d'un droit d'accès, de modification et de suppression de ses données. Les données collectées (Email, IP) sont strictement nécessaires à l'exécution du service (lutte anti-fraude et livraison des commandes) et ne sont pas revendues à des tiers commerciaux.</p>
                </section>

                <section>
                    <h3 class="text-white font-bold text-lg mb-2">ARTICLE 9 : LOI APPLICABLE ET JURIDICTION</h3>
                    <p>Les présentes CGU sont soumises au droit français. En cas de litige, et à défaut d'accord amiable, compétence exclusive est attribuée aux tribunaux compétents du ressort du siège social de l'Éditeur.</p>
                </section>
            </div>
        </div>
    `,

    // --- NEW: ADMIN PANEL ---
    admin: () => `
        <div class="max-w-6xl mx-auto font-sans">
            <h2 class="text-3xl font-bold mb-6 text-red-500 font-gaming flex items-center gap-2"><i class="fa-solid fa-lock"></i> ADMIN PANEL</h2>
            
            <!-- KPI Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div class="bg-panel p-4 rounded-lg border border-gray-700">
                    <p class="text-gray-400 text-xs uppercase">Utilisateurs Totaux</p>
                    <p class="text-2xl font-bold text-white">12,450</p>
                </div>
                <div class="bg-panel p-4 rounded-lg border border-gray-700">
                    <p class="text-gray-400 text-xs uppercase">En attente de retrait</p>
                    <p class="text-2xl font-bold text-yellow-500">${DB.adminWithdrawals.length}</p>
                </div>
                <div class="bg-panel p-4 rounded-lg border border-gray-700">
                    <p class="text-gray-400 text-xs uppercase">Revenus Pubs (24h)</p>
                    <p class="text-2xl font-bold text-green-500">$142.50</p>
                </div>
                 <div class="bg-panel p-4 rounded-lg border border-gray-700">
                    <p class="text-gray-400 text-xs uppercase">Marge Nette</p>
                    <p class="text-2xl font-bold text-blue-500">42%</p>
                </div>
            </div>

            <!-- Withdrawal Queue Table -->
            <div class="bg-panel rounded-lg border border-gray-700 overflow-hidden">
                <div class="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 class="font-bold text-white">File d'attente : Paiements</h3>
                    <button class="text-xs bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600"><i class="fa-solid fa-rotate"></i> Actualiser</button>
                </div>
                <table class="w-full text-left text-sm text-gray-300">
                    <thead class="bg-gray-800 text-xs uppercase font-bold text-gray-400">
                        <tr>
                            <th class="p-4">ID</th>
                            <th class="p-4">Utilisateur</th>
                            <th class="p-4">Récompense</th>
                            <th class="p-4">Risque Fraude</th>
                            <th class="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-700">
                        ${DB.adminWithdrawals.map(item => `
                            <tr class="hover:bg-gray-700/50 transition-colors">
                                <td class="p-4 font-mono text-xs text-gray-500">#${item.id}</td>
                                <td class="p-4 font-bold text-white">${item.user}</td>
                                <td class="p-4 text-neon-purple">${item.item}</td>
                                <td class="p-4">
                                    <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${item.risk.includes('High') ? 'bg-red-900/30 text-red-500' : 'bg-green-900/30 text-green-500'}">
                                        ${item.risk}
                                    </span>
                                </td>
                                <td class="p-4 text-right space-x-2">
                                    <button onclick="alert('Paiement #${item.id} Approuvé ! Email envoyé.')" class="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs font-bold transition-colors"><i class="fa-solid fa-check"></i> Payer</button>
                                    <button onclick="alert('Paiement #${item.id} Refusé. Points remboursés.')" class="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-bold transition-colors"><i class="fa-solid fa-xmark"></i> Rejeter</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <!-- Logs -->
            <div class="mt-8 bg-panel rounded-lg border border-gray-700 p-6">
                 <h3 class="font-bold text-white mb-4">Logs Système (Sécurité)</h3>
                 <div class="font-mono text-xs text-gray-400 space-y-2">
                    <p><span class="text-blue-400">[10:42:12]</span> User 'BotMasterX' flagged for Multi-Account (IP: 192.168.1.1).</p>
                    <p><span class="text-blue-400">[10:38:05]</span> Postback received from AdGateMedia ($2.40).</p>
                    <p><span class="text-blue-400">[10:15:00]</span> System Backup completed.</p>
                 </div>
            </div>
        </div>
    `
};

// --- 3. ROUTER & LOGIC ---

function router(viewName) {
    const appViews = document.getElementById('app-views');
    const mainContent = document.getElementById('main-content');
    const pageTitle = document.getElementById('page-title');

    // 1. Inject HTML
    if (Views[viewName]) {
        appViews.innerHTML = Views[viewName]();
    }

    // 2. Update Navigation State
    document.querySelectorAll('nav button').forEach(btn => {
        // Reset all specific classes
        btn.classList.remove('active-nav', 'active-nav-trust', 'active-nav-admin');
        btn.classList.add('inactive-nav');
    });

    const activeBtn = document.getElementById(`nav-${viewName}`);
    if (activeBtn) {
        activeBtn.classList.remove('inactive-nav');

        // Apply specific style based on zone
        if (['aiSupport', 'support', 'legal'].includes(viewName)) {
            activeBtn.classList.add('active-nav-trust');
        } else if (viewName === 'admin') {
            activeBtn.classList.add('active-nav-admin');
        } else {
            activeBtn.classList.add('active-nav');
        }
    }

    // 3. Update Titles & Ambience
    const titles = {
        dashboard: "BASE PRINCIPALE",
        earn: "CENTRE DE COMMANDEMENT (OFFRES)",
        loot: "LOOT SHOP",
        inventory: "COFFRE FORT",
        leaderboard: "HALL OF FAME",
        support: "CENTRE D'AIDE",
        aiSupport: "ASSISTANT VIRTUEL (IA)",
        legal: "DOCUMENTATION LÉGALE",
        admin: "ADMINISTRATION SYSTÈME"
    };
    pageTitle.innerText = titles[viewName] || "LOOTQUEST";

    // 4. Scroll to top
    mainContent.scrollTo(0, 0);

    // 5. Scroll chat to bottom if aiSupport
    if (viewName === 'aiSupport') {
        setTimeout(() => {
            const chatContainer = document.getElementById('chat-messages');
            if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 100);
    }
}

// --- 4. AI CHAT LOGIC ---

async function handleChatSubmit(e, mode) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    const chatContainer = document.getElementById('chat-messages');

    // 1. Add User Message
    DB.chatHistory.push({ role: 'user', text: message });
    chatContainer.innerHTML += `
        <div class="flex gap-4 flex-row-reverse">
            <div class="w-8 h-8 bg-gray-600 text-white rounded-full flex-shrink-0 flex items-center justify-center mt-1"><i class="fa-solid fa-user"></i></div>
            <div class="chat-trust-user p-4 text-sm max-w-[85%] leading-relaxed">${message}</div>
        </div>
    `;
    input.value = '';
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 2. Add Loading State
    const loadingId = 'loading-' + Date.now();
    chatContainer.innerHTML += `
        <div id="${loadingId}" class="flex gap-4">
            <div class="w-8 h-8 bg-blue-600/20 text-blue-500 border border-blue-600/30 rounded-full flex-shrink-0 flex items-center justify-center mt-1"><i class="fa-solid fa-robot"></i></div>
            <div class="chat-trust-bot p-4 text-sm flex gap-1 items-center">
                <div class="typing-dot w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                <div class="typing-dot w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                <div class="typing-dot w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
            </div>
        </div>
    `;
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 3. Call AI
    const systemPrompt = `Tu es l'Assistant Support de LootQuest. Ton rôle est de rassurer les utilisateurs (souvent des parents ou des jeunes joueurs) avec un ton professionnel, poli et calme.
    Contexte : LootQuest est un site de GPT (Get-Paid-To). Les utilisateurs gagnent des "Pixels" en regardant des pubs et les échangent contre des cartes cadeaux (Roblox, Fortnite).
    Règles importantes à connaître :
    1. Le premier retrait prend TOUJOURS 7 jours pour vérification anti-fraude.
    2. Les retraits suivants prennent 24-48h.
    3. L'usage de VPN est interdit et cause des blocages.
    Sois concis et clair. Ne parle pas en "Gamer Slang" ici, reste formel.`;

    const responseText = await callGemini(message, systemPrompt);

    // Remove loading
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();

    // Add Bot Response
    DB.chatHistory.push({ role: 'model', text: responseText });
    chatContainer.innerHTML += `
        <div class="flex gap-4">
            <div class="w-8 h-8 bg-blue-600/20 text-blue-500 border border-blue-600/30 rounded-full flex-shrink-0 flex items-center justify-center mt-1"><i class="fa-solid fa-robot"></i></div>
            <div class="chat-trust-bot p-4 text-sm max-w-[85%] leading-relaxed">
                ${marked.parse(responseText)}
            </div>
        </div>
    `;
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function updateHeaderData() {
    const userNameEl = document.getElementById('user-name');
    const userBalanceEl = document.getElementById('user-balance');
    const userRankEl = document.getElementById('user-rank');
    const headerXpBar = document.getElementById('header-xp-bar');

    if (userNameEl) userNameEl.innerText = DB.user.username;
    if (userBalanceEl) userBalanceEl.innerText = DB.user.pixels;
    if (userRankEl) userRankEl.innerText = `RANG: ${DB.user.rank}`;
    if (headerXpBar) headerXpBar.style.width = `${(DB.user.xp / DB.user.nextLevelXp) * 100}%`;
}

function logout() {
    if (confirm("Voulez-vous vraiment vous déconnecter ?")) {
        window.location.href = 'index.html';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateHeaderData();
    // Default route
    router('dashboard');
});
