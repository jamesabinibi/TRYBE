import http from 'http';

const data = JSON.stringify({
  business_name: 'Test',
  currency: 'NGN',
  vat_enabled: false,
  low_stock_threshold: 5,
  logo_url: 'test',
  brand_color: '#000000'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/settings',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => responseData += chunk);
  res.on('end', () => console.log(`Status: ${res.statusCode}\nBody: ${responseData}`));
});

req.on('error', (err) => console.error(err));
req.write(data);
req.end();
