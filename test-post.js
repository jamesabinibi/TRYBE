import http from 'http';

const data = JSON.stringify({
  username: 'testuser',
  password: 'password123',
  name: 'Test User',
  role: 'manager',
  email: 'test@example.com'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/users',
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
