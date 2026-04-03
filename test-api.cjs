const axios = require('axios');

async function testApi() {
  const baseUrl = 'http://localhost:3000';
  const endpoints = [
    '/api/admin/stats',
    '/api/settings',
    '/api/admin/users',
    '/api/admin/promo-codes'
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await axios.get(`${baseUrl}${endpoint}`, {
        headers: {
          'x-user-id': '1' // Assume some user ID
        }
      });
      console.log(`[${endpoint}] Status: ${res.status}`);
      console.log(`[${endpoint}] Data keys: ${Object.keys(res.data)}`);
    } catch (err) {
      console.error(`[${endpoint}] Error: ${err.response?.status || err.message}`);
    }
  }
}

testApi();
