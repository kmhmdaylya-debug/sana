// Docker health check script for backend
// Checks the /api/v1/health/ready endpoint which verifies DB and migrations

const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 4114,
  path: '/api/v1/health/ready',
  method: 'GET',
  timeout: 5000,
  headers: {
    'Accept': 'application/json',
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (res.statusCode === 200 && parsed.success === true) {
        console.log('Health check passed');
        process.exit(0);
      } else {
        console.error('Health check failed:', parsed);
        process.exit(1);
      }
    } catch (e) {
      console.error('Health check parse error:', e.message);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('Health check request error:', e.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Health check timeout');
  req.destroy();
  process.exit(1);
});

req.end();