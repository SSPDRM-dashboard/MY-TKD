import { MatchData } from '../types';

const getMalaysiaTimestamp = () => {
  return new Date().toLocaleString('en-GB', { 
    timeZone: 'Asia/Kuala_Lumpur',
    hour12: false 
  }).replace(/\//g, '-');
};

const formatBout = (ring: number, bout: string | number) => {
  const numBout = parseInt(bout.toString());
  const suffix = bout.toString().replace(/[0-9]/g, '');
  if (numBout >= ring * 1000) {
    return numBout.toString() + suffix;
  }
  return (ring * 1000 + numBout).toString() + suffix;
};

export async function syncToGoogleSheets(url: string, data: MatchData, reason: string = '') {
  if (!url) return;

  try {
    const payload = {
      action: 'newBout',
      timestamp: getMalaysiaTimestamp(),
      ring: data.ring,
      bout: formatBout(data.ring, data.bout),
      category: data.category,
      blue_name: data.blue_name,
      blue_club: data.blue_club,
      red_name: data.red_name,
      red_club: data.red_club,
      privacy_mode: data.privacy_mode ? 'ON' : 'OFF',
      reason: reason
    };

    // Using fetch with no-cors if it's a simple Apps Script GET/POST
    // or standard fetch if CORS is handled.
    // Most Apps Script Web Apps require a redirect which fetch handles.
    const response = await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // Apps Script often doesn't return CORS headers but still processes the request
      headers: {
        'Content-Type': 'text/plain', // Using text/plain avoids preflight requests which Apps Script doesn't handle well
      },
      body: JSON.stringify(payload),
    });

    return true;
  } catch (error) {
    console.error('Google Sheets Sync Error:', error);
    return false;
  }
}

export async function updateTransferInGoogleSheets(url: string, ring: number, bout: string | number, reason: string) {
  if (!url) return;

  try {
    const payload = {
      action: 'updateTransfer',
      ring: ring,
      bout: formatBout(ring, bout),
      reason: reason,
      timestamp: getMalaysiaTimestamp()
    };

    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(payload),
    });

    return true;
  } catch (error) {
    console.error('Google Sheets Transfer Sync Error:', error);
    return false;
  }
}

export async function updateWinnerInGoogleSheets(url: string, ring: number, bout: string | number, winner: string, winnerSide?: string, blueName?: string, redName?: string) {
  if (!url) return;

  try {
    const payload = {
      action: 'updateWinner',
      ring: ring,
      bout: formatBout(ring, bout),
      winner: winner, // The winner's name
      winner_name: winner, // Redundant but safe for different Apps Script versions
      winner_side: winnerSide, // The winner's side (Blue/Red)
      blue_name: blueName,
      red_name: redName,
      timestamp: getMalaysiaTimestamp()
    };

    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(payload),
    });

    return true;
  } catch (error) {
    console.error('Google Sheets Winner Sync Error:', error);
    return false;
  }
}
