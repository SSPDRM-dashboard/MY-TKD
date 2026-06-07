async function run() {
  const url = 'https://script.google.com/macros/s/AKfycbykWTnkJwZ649ntvetGSL793ZNFPJE9yhjnNpTWpoS8NmVPjMDGp2PAb12dWK8KWLfm/exec';
  const response = await fetch(url);
  const text = await response.text();
  console.log("Response starts with:", text.substring(0, 500));
  process.exit(0);
}
run();
