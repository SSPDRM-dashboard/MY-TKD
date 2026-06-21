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

  const filtered = rows.slice(1).filter(r => r[eventIdx]?.trim() === 'VIRTUAL2026 D2');
  console.log(`Total VIRTUAL2026 D2 rows: ${filtered.length}`);

  // Group by Ring
  const byRing: Record<string, string[]> = {};
  filtered.forEach(r => {
    const ring = r[ringIdx]?.trim() || 'No Ring';
    const bout = r[boutIdx]?.trim() || 'No Bout';
    if (!byRing[ring]) byRing[ring] = [];
    if (!byRing[ring].includes(bout)) {
      byRing[ring].push(bout);
    }
  });

  for (const [ring, bouts] of Object.entries(byRing)) {
    // Sort bouts
    bouts.sort((a,b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    console.log(`Ring ${ring} has ${bouts.length} unique bouts: ${bouts.join(', ')}`);
  }

  process.exit(0);
}

run();
