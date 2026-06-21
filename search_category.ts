import Papa from 'papaparse';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/14TrlxR_rk9S7WmdanXGLlE4Y-ry9TqY6_B6HYA0Uuus/export?format=csv';

async function run() {
  const response = await fetch(CSV_URL);
  const text = await response.text();
  const result = Papa.parse(text, { skipEmptyLines: true });
  const rows = result.data as string[][];

  const headers = rows[0];
  const ringIdx = headers.findIndex(h => h.trim().toLowerCase().startsWith('ring'));
  const boutIdx = headers.findIndex(h => h.trim().toLowerCase().startsWith('bout number'));
  const eventIdx = headers.findIndex(h => h.trim().toLowerCase().startsWith('event'));
  const catIdx = 4; // Category column

  const targetCategory = "FEMALE 12YO AMATUER CADET C (12)";
  console.log(`Searching for "${targetCategory}" across ALL rows:`);

  let found = 0;
  rows.slice(1).forEach((r, idx) => {
    const rCat = r[catIdx]?.trim();
    if (rCat === targetCategory) {
      found++;
      console.log(`Row ${idx+2}: Event: "${r[eventIdx]}" | Ring: "${r[ringIdx]}" | Bout: "${r[boutIdx]}" | Blue: "${r[5]}" vs Red: "${r[7]}" | Winner: "${r[15]}"`);
    }
  });

  console.log(`Found ${found} matches.`);
  process.exit(0);
}

run();
