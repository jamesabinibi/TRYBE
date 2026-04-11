fetch('https://pa6brvdnhc.us-east-1.awsapprunner.com/api/landing-config', {
  headers: {
    'Origin': 'capacitor://localhost'
  }
})
  .then(r => {
    console.log('Status:', r.status);
    console.log('Headers:', Object.fromEntries(r.headers.entries()));
    return r.text();
  })
  .then(text => console.log(text.substring(0, 100)))
  .catch(console.error);
