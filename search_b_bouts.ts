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

  const targets = ["B14", "B15", "B16", "B18", "B19", "B20", "B21", "B22"];

  console.log("Searching for B14-B22 across ALL rows in the sheet:");
  let found =0;
  rows.slice(1).forEach((r, idx) => {
    const b = r[boutIdx]?.trim().toUpperCase();
    if (targets.includes(b)) {
      found++;
      console.log(`Row ${idx+2}: Event: "${r[eventIdx]}" | Ring: "${r[ringIdx]}" | Bout: "${r[boutIdx]}" | Blue: "${r[5]}" vs Red: "${r[7]}" | Winner: "${r[15]}"`);
    }
  });
  console.log(`Found ${found} rows.`);
  process.exit(0);
}

run();
