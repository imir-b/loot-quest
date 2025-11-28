const API = {
    async request(endpoint, method = 'GET', body = null) {
        const url = `${Config.API_BASE_URL}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API Request Failed: ${url}`, error);
            throw error;
        }
    },

    // Mock function to simulate backend calls for now
    async mockRequest(data, delay = 500) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(data);
            }, delay);
        });
    }
};
