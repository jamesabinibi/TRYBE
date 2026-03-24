
async function call() {
  try {
    const res = await fetch('http://localhost:3000/api/debug/env');
    const data = await res.text();
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}

call();
