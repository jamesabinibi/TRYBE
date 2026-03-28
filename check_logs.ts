
import fetch from 'node-fetch';

async function checkLogs() {
  try {
    const res = await fetch('http://localhost:3000/api/debug/logs', {
      headers: { 'Accept': 'application/json' }
    });
    const data = await res.json() as any;
    const logs = data.logs || [];
    console.log('--- SERVER LOGS ---');
    logs.slice(-50).forEach((log: string) => console.log(log));
    console.log('--- END LOGS ---');
  } catch (err) {
    console.error('Failed to fetch logs:', err);
  }
}

checkLogs();
