fetch('https://ais-pre-maktu7vxpyn2ghysibw2hq-28880934033.europe-west1.run.app/api/landing-config', {
  method: 'OPTIONS',
  headers: {
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
})
  .then(r => {
    console.log('Status:', r.status);
    console.log('Headers:', Object.fromEntries(r.headers.entries()));
    return r.text();
  })
  .then(text => console.log(text.substring(0, 100)))
  .catch(console.error);
