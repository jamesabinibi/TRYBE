import fetch from 'node-fetch';
async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/products', {
      headers: {
        'x-user-id': '215' // trybemanager ID
      }
    });
    const data: any = await res.json();
    console.log("Products count:", data.length);
    if (data.length > 0) {
      console.log("First product:", data[0]);
    }
  } catch (e) {
    console.error(e);
  }
}
run();
