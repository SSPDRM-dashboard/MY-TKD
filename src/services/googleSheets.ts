import { MatchData } from '../types';

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
  const numBout = parseInt(bout.toString());
  const suffix = bout.toString().replace(/[0-9]/g, '');
  if (isNaN(numBout)) return bout.toString();
  if (numBout >= ring * 1000) {
    return numBout.toString() + suffix;
  }
  return (ring * 1000 + numBout).toString() + suffix;
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
      event_name: eventName || '-',
      ring: data.ring,
      bout: formatBout(data.ring, data.bout),
      category: data.category || '-',
      blue_name: data.blue_name || '-',
      blue_club: data.blue_club || '-',
      red_name: data.red_name || '-',
      red_club: data.red_club || '-',
      privacy_mode: data.privacy_mode ? 'ON' : 'OFF',
      reason: reason
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
      body: JSON.stringify(payload),
    });

    console.log('>>> GOOGLE SHEETS SYNC REQUEST SENT <<<');
    return true;
  } catch (error) {
    console.error('!!! Google Sheets Transfer Sync Error !!!', error);
    return false;
  }
}

export async function updateWinnerInGoogleSheets(url: string, ring: number, bout: string | number, winner: string, eventName: string = '', winnerSide?: string, blueName?: string, redName?: string) {
  const targetUrl = url?.trim();
  if (!targetUrl) return false;

  try {
    const payload = {
      action: 'updateWinner',
      ring: ring,
      bout: formatBout(ring, bout),
      winner: winner || '-',
      winner_name: winner || '-',
      winner_side: winnerSide || '-',
      blue_name: blueName || '-',
      red_name: redName || '-',
      timestamp: getMalaysiaTimestamp(),
      event_name: eventName || '-'
    };

    console.log('>>> GOOGLE SHEETS SYNC START (Winner) <<<');
    console.log('Target URL:', targetUrl);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    await fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      body: JSON.stringify(payload),
    });

    console.log('>>> GOOGLE SHEETS SYNC REQUEST SENT <<<');
    return true;
  } catch (error) {
    console.error('!!! Google Sheets Winner Sync Error !!!', error);
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
