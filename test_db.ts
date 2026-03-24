import fetch from 'node-fetch';
async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/debug/inventory/mails@trybeoriginals.com');
    console.log(await res.text());
  } catch (e) {
    console.error(e);
  }
}
run();
