async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/images/landing/1c7576c1-ec78-43f0-a006-9f605a3ce721.png');
    console.log("Status:", res.status);
    console.log("Headers:", res.headers);
  } catch (e) {
    console.error(e);
  }
}
run();
