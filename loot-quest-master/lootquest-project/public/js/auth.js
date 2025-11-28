const Auth = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        const discordBtn = document.querySelector('button[data-provider="discord"]');
        const googleBtn = document.querySelector('button[data-provider="google"]');
        const loginForm = document.querySelector('form[action="/api/login"]');

        if (discordBtn) {
            discordBtn.addEventListener('click', () => this.loginWithDiscord());
        }

        if (googleBtn) {
            googleBtn.addEventListener('click', () => this.loginWithGoogle());
        }

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const emailInput = loginForm.querySelector('input[name="email"]');
                this.loginWithEmail(emailInput.value);
            });
        }
    },

    loginWithDiscord() {
        console.log('Initiating Discord Login...');
        // In a real app, this would redirect to the backend auth endpoint
        // window.location.href = Config.ENDPOINTS.AUTH_DISCORD;
        alert('Redirection vers Discord OAuth...');
    },

    loginWithGoogle() {
        console.log('Initiating Google Login...');
        // In a real app, this would redirect to the backend auth endpoint
        // window.location.href = Config.ENDPOINTS.AUTH_GOOGLE;
        alert('Redirection vers Google OAuth...');
    },

    async loginWithEmail(email) {
        console.log(`Attempting login for: ${email}`);
        try {
            // Simulate API call
            // const response = await API.request(Config.ENDPOINTS.LOGIN, 'POST', { email });
            alert(`Login simulé pour ${email}. Redirection vers l'app...`);
            window.location.href = 'app.html';
        } catch (error) {
            alert('Erreur de connexion.');
        }
    }
};

// Modal Logic
const Modal = {
    init() {
        this.modal = document.getElementById('login-modal');
        this.modalContent = document.getElementById('modal-content');
        this.navLoginBtn = document.getElementById('nav-login-btn');
        this.heroJoinBtn = document.getElementById('hero-join-btn');
        this.closeModalBtn = document.getElementById('close-modal-btn');

        this.bindEvents();
    },

    bindEvents() {
        if (this.navLoginBtn) this.navLoginBtn.addEventListener('click', () => this.open());
        if (this.heroJoinBtn) this.heroJoinBtn.addEventListener('click', () => this.open());
        if (this.closeModalBtn) this.closeModalBtn.addEventListener('click', () => this.close());

        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.close();
            });
        }
    },

    open() {
        if (!this.modal) return;
        this.modal.classList.remove('hidden');
        setTimeout(() => {
            this.modal.classList.remove('opacity-0');
            this.modalContent.classList.remove('scale-95');
            this.modalContent.classList.add('scale-100');
        }, 10);
    },

    close() {
        if (!this.modal) return;
        this.modal.classList.add('opacity-0');
        this.modalContent.classList.remove('scale-100');
        this.modalContent.classList.add('scale-95');
        setTimeout(() => {
            this.modal.classList.add('hidden');
        }, 300);
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
    Modal.init();
});
