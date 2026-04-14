# Tournament Placement Guidelines

These guidelines define how placements (1st, 2nd, 3rd, 4th) are determined from the bout chart.

## 1. The Final Match (The Last Bout)
The final match determines the top two spots:
- **1st Place (Gold)**: The Winner of the final bout.
- **2nd Place (Silver)**: The Loser of the final bout.

## 2. The Semi-Final Matches
This is where the 3rd and 4th places are decided. There are two standard ways to do this:

### Option A: Joint 3rd Place (Most Common in WT)
In most Taekwondo tournaments, there is no "3rd place match."
- **3rd Place**: Both players who lost in the Semi-Finals are awarded 3rd place.
- **System Logic**: Look at the two bouts immediately preceding the Final. The losers of those two matches are the 3rd place winners.

### Option B: Third-Place Playoff
If the specific tournament requires a 4th place ranking:
- **3rd Place**: The Winner of the "Bronze Medal Match" (played between the two Semi-Final losers).
- **4th Place**: The Loser of that same "Bronze Medal Match."

## Logic for AI Prompting & Results Processing
- **Identify Final**: Find by category and the match with the highest `bout_number`.
- **Assign 1st/2nd**: Winner = 1st, Loser = 2nd.
- **Identify Semi-Finals**: Find the two matches that fed into the Final.
- **Assign 3rd/4th**:
    - If `third_place_match` exists: Winner = 3rd, Loser = 4th.
    - If not: Both Losers = 3rd.
