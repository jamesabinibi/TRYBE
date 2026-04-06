async function run() {
  try {
    const res = await fetch('https://my-app-images-source.s3.us-east-1.amazonaws.com/landing/1c7576c1-ec78-43f0-a006-9f605a3ce721.png');
    console.log("Status:", res.status);
    console.log("Headers:", res.headers);
  } catch (e) {
    console.error(e);
  }
}
run();
