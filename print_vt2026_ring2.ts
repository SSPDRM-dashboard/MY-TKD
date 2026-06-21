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

  const filtered = rows.slice(1).filter(r => 
    r[ringIdx]?.trim() === '2' && 
    r[eventIdx]?.trim() === 'VT 2026'
  );
  console.log(`Total VT 2026 Ring 2 rows in spreadsheet: ${filtered.length}`);

  // Print raw bouts
  const uniqueBouts = Array.from(new Set(filtered.map(r => r[boutIdx]?.trim()))).sort((a,b) => 
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
  console.log("Unique bouts for VT 2026 Ring 2:", uniqueBouts.join(', '));

  filtered.forEach(r => {
    console.log(`Bout: ${r[boutIdx]} | Category: ${r[4]} | Blue: ${r[5]} (${r[6]}) vs Red: ${r[7]} (${r[8]}) | Winner: ${r[15]}`);
  });

  process.exit(0);
}

run();
