const https = require('https');

const options = {
  hostname: 'ais-pre-maktu7vxpyn2ghysibw2hq-28880934033.europe-west1.run.app',
  port: 443,
  path: '/api/logs',
  method: 'GET',
  headers: {
    'Cookie': 'GAESA=CgQIg8SYBw; __SECURE-aistudio_auth_flow_may_set_cookies=true'
  }
};

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const logs = JSON.parse(data);
        console.log('Logs:');
        logs.forEach(log => console.log(log));
      } catch (e) {
        console.log('Raw data:', data);
      }
    } else {
      console.log('Response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
