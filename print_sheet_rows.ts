import Papa from 'papaparse';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/14TrlxR_rk9S7WmdanXGLlE4Y-ry9TqY6_B6HYA0Uuus/export?format=csv';

async function run() {
  const response = await fetch(CSV_URL);
  const text = await response.text();
  const result = Papa.parse(text, { skipEmptyLines: true });
  const rows = result.data as string[][];

  console.log(`Printing rows 110 to 135 (1-based index):`);
  for (let i = 109; i < 135; i++) {
    if (i < rows.length) {
      const r = rows[i];
      console.log(`Row ${i+1}: Event: "${r[1]}" | Ring: "${r[2]}" | Bout: "${r[3]}" | Category: "${r[4]}" | Blue: "${r[5]}" vs Red: "${r[7]}" | Winner: "${r[15]}"`);
    }
  }

  process.exit(0);
}

run();
