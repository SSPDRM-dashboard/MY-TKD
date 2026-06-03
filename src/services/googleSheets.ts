import { MatchData } from '../types';
import { normalizeBoutNumber } from '../lib/utils';

const getMalaysiaTimestamp = () => {
  try {
    return new Date().toLocaleString('en-GB', { 
      timeZone: 'Asia/Kuala_Lumpur',
      hour12: false 
    }).replace(/\//g, '-');
  } catch (e) {
    // Fallback if timezone is not supported
    return new Date().toISOString().replace('T', ' ').split('.')[0];
  }
};

const formatBout = (ring: number, bout: string | number) => {
  if (bout === undefined || bout === null) return '0';
  const s = bout.toString().trim().toUpperCase();
  if (!s) return '';

  // 1. If it already has a letter prefix (e.g., A01), keep it
  if (/^[A-Z]/.test(s)) return s;

  // Extract digits and any trailing characters
  const match = s.match(/^(\d+)(.*)$/);
  if (!match) return s;

  const num = parseInt(match[1]);
  const suffix = match[2] || '';

  if (isNaN(num)) return s;

  // 2. We determine the bout number within the ring
  // If it's 1001, boutInRing is 1. If it's 1, boutInRing is 1.
  const boutInRing = num >= 1000 ? num % 1000 : num;

  // 3. Format into Alphanumeric (A01) based on the active ring
  // This matches what the user sees in the "active ring" display
  const letter = String.fromCharCode(64 + (ring || 1));
  return `${letter}${boutInRing.toString().padStart(2, '0')}${suffix}`;
};

export async function syncToGoogleSheets(url: string, data: MatchData, eventName: string = '', reason: string = '') {
  const targetUrl = url?.trim();
  if (!targetUrl) {
    console.warn('Sync aborted: No URL provided');
    return false;
  }

  // Basic validation to help users
  if (!targetUrl.includes('script.google.com') || !targetUrl.includes('/exec')) {
    console.warn('Warning: The Google Sheet URL does not look like a Web App URL (/exec). Sync might fail.');
  }

  try {
    const payload = {
      action: 'newBout',
      timestamp: getMalaysiaTimestamp(),
      event_name: (eventName || '-').toUpperCase(),
      ring: data.ring,
      bout: formatBout(data.ring, data.bout).toUpperCase(),
      category: (data.category || '-').toUpperCase(),
      blue_name: (data.blue_name || '-').toUpperCase(),
      blue_club: (data.blue_club || '-').toUpperCase(),
      red_name: (data.red_name || '-').toUpperCase(),
      red_club: (data.red_club || '-').toUpperCase(),
      privacy_mode: data.privacy_mode ? 'ON' : 'OFF',
      reason: (reason || '').toUpperCase(),
      // Include points if present
      r1Blue: data.points?.r1Blue || '',
      r1Red: data.points?.r1Red || '',
      r2Blue: data.points?.r2Blue || '',
      r2Red: data.points?.r2Red || '',
      r3Blue: data.points?.r3Blue || '',
      r3Red: data.points?.r3Red || '',
      r1Winner: data.points?.r1Winner || '',
      r2Winner: data.points?.r2Winner || '',
      r3Winner: data.points?.r3Winner || '',
      points: data.points || null
    };

    console.log('>>> GOOGLE SHEETS SYNC START (New Bout) <<<');
    console.log('Target URL:', targetUrl);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Using fetch with no-cors is the most compatible way to hit Google Apps Script
    // without triggering CORS preflight issues.
    // We remove headers to be as "simple" as possible for the browser's safelist.
    await fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(payload),
    });

    console.log('>>> GOOGLE SHEETS SYNC REQUEST SENT <<<');
    return true;
  } catch (error) {
    console.error('!!! Google Sheets Sync Error !!!', error);
    throw error;
  }
}

export async function updateTransferInGoogleSheets(url: string, ring: number, bout: string | number, reason: string, eventName: string = '') {
  const targetUrl = url?.trim();
  if (!targetUrl) return false;

  try {
    const payload = {
      action: 'updateTransfer',
      ring: ring,
      bout: formatBout(ring, bout),
      reason: reason,
      timestamp: getMalaysiaTimestamp(),
      event_name: eventName || '-'
    };

    console.log('>>> GOOGLE SHEETS SYNC START (Transfer) <<<');
    console.log('Target URL:', targetUrl);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    await fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(payload),
    });

    console.log('>>> GOOGLE SHEETS SYNC REQUEST SENT <<<');
    return true;
  } catch (error) {
    console.error('!!! Google Sheets Transfer Sync Error !!!', error);
    return false;
  }
}

export async function updateBoutDetailsInGoogleSheets(url: string, ring: number, bout: string | number, blueName: string, blueClub: string, redName: string, redClub: string, eventName: string = '') {
  const targetUrl = url?.trim();
  if (!targetUrl) return false;

  try {
    const payload = {
      action: 'updateBoutDetails',
      ring: ring,
      bout: formatBout(ring, bout).toUpperCase(),
      blue_name: (blueName || '-').toUpperCase(),
      blue_club: (blueClub || '-').toUpperCase(),
      red_name: (redName || '-').toUpperCase(),
      red_club: (redClub || '-').toUpperCase(),
      timestamp: getMalaysiaTimestamp(),
      event_name: (eventName || '-').toUpperCase()
    };

    console.log('>>> GOOGLE SHEETS SYNC START (Edit Details) <<<');
    console.log('Target URL:', targetUrl);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    await fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(payload),
    });

    console.log('>>> GOOGLE SHEETS SYNC REQUEST SENT <<<');
    return true;
  } catch (error) {
    console.error('Google Sheets Sync Error (Edit Details):', error);
    return false;
  }
}

export async function updateWinnerInGoogleSheets(url: string, ring: number, bout: string | number, winner: string, eventName: string = '', winnerSide?: string, blueName?: string, redName?: string, points?: any) {
  const targetUrl = url?.trim();
  if (!targetUrl) return false;

  try {
    const payload = {
      action: 'updateWinner',
      ring: ring,
      bout: formatBout(ring, bout).toUpperCase(),
      winner: (winner || '-').toUpperCase(),
      winner_name: (winner || '-').toUpperCase(),
      winner_side: (winnerSide || '-').toUpperCase(),
      blue_name: (blueName || '-').toUpperCase(),
      red_name: (redName || '-').toUpperCase(),
      timestamp: getMalaysiaTimestamp(),
      event_name: (eventName || '-').toUpperCase(),
      // Include points in winner update too
      r1Blue: points?.r1Blue || '',
      r1Red: points?.r1Red || '',
      r2Blue: points?.r2Blue || '',
      r2Red: points?.r2Red || '',
      r3Blue: points?.r3Blue || '',
      r3Red: points?.r3Red || '',
      r1Winner: points?.r1Winner || '',
      r2Winner: points?.r2Winner || '',
      r3Winner: points?.r3Winner || '',
      points: points || null
    };

    console.log('>>> GOOGLE SHEETS SYNC START (Winner) <<<');
    console.log('Target URL:', targetUrl);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    await fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(payload),
    });

    console.log('>>> GOOGLE SHEETS SYNC REQUEST SENT <<<');
    return true;
  } catch (error) {
    console.error('!!! Google Sheets Winner Sync Error !!!', error);
    return false;
  }
}

export async function updatePointsInGoogleSheets(url: string, ring: number, bout: string | number, points: any, eventName: string = '') {
  const targetUrl = url?.trim();
  if (!targetUrl) return false;

  try {
    const payload = {
      action: 'updatePoints',
      ring: ring,
      bout: formatBout(ring, bout).toUpperCase(),
      timestamp: getMalaysiaTimestamp(),
      event_name: (eventName || '-').toUpperCase(),
      // Send points both flat and nested for compatibility
      r1Blue: points?.r1Blue || '',
      r1Red: points?.r1Red || '',
      r2Blue: points?.r2Blue || '',
      r2Red: points?.r2Red || '',
      r3Blue: points?.r3Blue || '',
      r3Red: points?.r3Red || '',
      r1Winner: points?.r1Winner || '',
      r2Winner: points?.r2Winner || '',
      r3Winner: points?.r3Winner || '',
      points: points || null
    };

    console.log('>>> GOOGLE SHEETS SYNC START (Update Points) <<<');
    console.log('Target URL:', targetUrl);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    await fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(payload),
    });

    return true;
  } catch (error) {
    console.error('Points sync error:', error);
    return false;
  }
}

export async function testSync(url: string) {
  const targetUrl = url?.trim();
  if (!targetUrl) return { success: false, message: 'No URL provided' };

  try {
    // We try with 'cors' first to see if we can get a real response
    // If it fails with CORS, we'll try 'no-cors' as a fallback
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({ action: 'ping' }),
    });

    if (response.ok) {
      return { success: true, message: 'Connection successful!' };
    }
    return { success: false, message: `Server returned status ${response.status}` };
  } catch (error) {
    // If it's a CORS error, we can't be 100% sure, but we can try no-cors
    try {
      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({ action: 'ping' }),
      });
      return { success: true, message: 'Request sent (Status unknown due to CORS)' };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : 'Network error' };
    }
  }
}
