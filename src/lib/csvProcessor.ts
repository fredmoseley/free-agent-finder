import Papa from 'papaparse';

export interface RawCSVRow {
  [key: string]: string;
}

export interface ProcessedPlayer {
  id: string;
  name: string;
  injury: string;
  positions: string;
  team: string;
  stats: {
    // Batting
    avg?: string;
    hr?: string;
    rbi?: string;
    r?: string;
    sb?: string;
    // Pitching
    w?: string;
    sv?: string;
    k?: string;
    era?: string;
    whip?: string;
  };
}

export function parseCSV(file: File): Promise<RawCSVRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        if (rows.length === 0) {
          resolve([]);
          return;
        }

        // Common keywords that might indicate a header row
        const headerKeywords = ['players', 'player', 'name', 'pos', 'team', 'id'];
        
        // Find the first row that contains at least one of these keywords
        let headerRowIndex = rows.findIndex(row => 
          row.some(cell => typeof cell === 'string' && headerKeywords.some(kw => cell.toLowerCase().includes(kw)))
        );

        // Fallback to first row if no header-like row found
        if (headerRowIndex === -1) headerRowIndex = 0;

        const headers = rows[headerRowIndex].map(h => h.trim());
        const dataRows = rows.slice(headerRowIndex + 1);

        const formattedData = dataRows.map(row => {
          const obj: RawCSVRow = {};
          headers.forEach((header, index) => {
            if (header) {
              obj[header] = row[index] || '';
            }
          });
          return obj;
        });

        resolve(formattedData);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

export function preprocessCSV(rows: RawCSVRow[]): ProcessedPlayer[] {
  // Helper to find a value by case-insensitive key or common variations
  const findValue = (row: RawCSVRow, possibleKeys: string[]) => {
    const rowKeys = Object.keys(row);
    // Try exact matches first (case-insensitive and trimmed)
    for (const key of possibleKeys) {
      const foundKey = rowKeys.find(rk => rk.trim().toLowerCase() === key.toLowerCase());
      if (foundKey) return row[foundKey] || '';
    }
    return '';
  };

  return rows.map((row) => {
    const rawName = findValue(row, ['Players', 'Name', 'Player', 'Full Name', 'Player Name']);
    let normalizedName = rawName.trim();

    // Handle "Last, First" -> "First Last"
    if (normalizedName.includes(',')) {
      const parts = normalizedName.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        normalizedName = `${parts[1]} ${parts[0]}`;
      }
    }

    return {
      id: findValue(row, ['id', 'ID', 'playerid', 'PlayerID', 'key']),
      name: normalizedName,
      injury: findValue(row, ['Injury', 'Inj', 'Status', 'Injury Status']),
      positions: findValue(row, ['Pos', 'Position', 'Positions', 'Player Position']),
      team: findValue(row, ['Team', 'Club', 'Org', 'Franchise']),
      stats: {
        // Batting
        avg: findValue(row, ['AVG', 'BA', 'Batting Average']),
        hr: findValue(row, ['HR', 'Home Runs']),
        rbi: findValue(row, ['RBI', 'Runs Batted In']),
        r: findValue(row, ['R', 'Runs']),
        sb: findValue(row, ['SB', 'Stolen Bases']),
        // Pitching
        w: findValue(row, ['W', 'Wins']),
        sv: findValue(row, ['SV', 'Saves', 'S']),
        k: findValue(row, ['K', 'SO', 'Strikeouts']),
        era: findValue(row, ['ERA', 'Earned Run Average']),
        whip: findValue(row, ['WHIP', 'Walks plus Hits per IP']),
      }
    };
  }).filter(p => p.name.length > 0);
}
