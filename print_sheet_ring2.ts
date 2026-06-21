import Papa from 'papaparse';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/14TrlxR_rk9S7WmdanXGLlE4Y-ry9TqY6_B6HYA0Uuus/export?format=csv';

async function run() {
  const response = await fetch(CSV_URL);
  const text = await response.text();
  const result = Papa.parse(text, { skipEmptyLines: true });
  const rows = result.data as string[][];

  console.log(`Total rows: ${rows.length}`);
  const headers = rows[0];
  const ringIdx = headers.findIndex(h => h.trim().toLowerCase().startsWith('ring'));
  const boutIdx = headers.findIndex(h => h.trim().toLowerCase().startsWith('bout number'));
  const eventIdx = headers.findIndex(h => h.trim().toLowerCase().startsWith('event'));

  const ring2EventRows = rows.slice(1).filter(r => 
    r[ringIdx]?.trim() === '2' && 
    r[eventIdx]?.trim() === 'VIRTUAL2026 D2'
  );
  console.log(`Total Ring 2 rows for VIRTUAL2026 D2: ${ring2EventRows.length}`);

  ring2EventRows.forEach((r, idx) => {
    console.log(`[${idx+1}] Bout: ${r[boutIdx]} | Category: ${r[4]} | Blue: ${r[5]} (${r[6]}) vs Red: ${r[7]} (${r[8]}) | Winner: ${r[15]}`);
  });

  process.exit(0);
}

run();
