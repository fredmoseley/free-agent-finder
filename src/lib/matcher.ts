import Fuse from 'fuse.js';
import { ProcessedPlayer } from './csvProcessor';
import { ExtractedPlayer } from '../services/geminiService';

export interface MatchResult extends ProcessedPlayer {
  matchType: 'exact' | 'fuzzy';
  score?: number;
  context?: string;
  bid?: string | null;
  role?: 'SP' | 'RP' | null;
}

export function matchPlayers(
  articlePlayers: ExtractedPlayer[],
  csvPlayers: ProcessedPlayer[]
): { matched: MatchResult[]; possible: MatchResult[] } {
  const matched: MatchResult[] = [];
  const possible: MatchResult[] = [];
  const seenIds = new Set<string>();

  const quickNormalize = (s: string) => 
    s.normalize('NFD')
     .replace(/[\u0300-\u036f]/g, "")
     .toLowerCase()
     .trim();

  // 1. Exact Matching
  articlePlayers.forEach(articlePlayer => {
    const normalizedName = quickNormalize(articlePlayer.name);
    const exactMatches = csvPlayers.filter(p => quickNormalize(p.name) === normalizedName);
    
    exactMatches.forEach(p => {
      if (!seenIds.has(p.id)) {
        matched.push({ 
          ...p, 
          matchType: 'exact', 
          context: articlePlayer.context,
          bid: articlePlayer.bid,
          role: articlePlayer.role
        });
        seenIds.add(p.id);
      }
    });
  });

  // 2. Fuzzy Matching for remaining names
  const fuse = new Fuse(csvPlayers, {
    keys: ['name'],
    includeScore: true,
    threshold: 0.4, // Conservative threshold
  });

  articlePlayers.forEach(articlePlayer => {
    const extractedName = articlePlayer.name.toLowerCase().trim();
    const results = fuse.search(extractedName);
    
    results.forEach(result => {
      const p = result.item;
      const score = result.score || 0;
      const csvName = p.name.toLowerCase().trim();

      if (seenIds.has(p.id)) return;

      // Anti-False Positive Check:
      // When both the extracted name and the CSV name have at least a first and last name, 
      // we insist that both parts match broadly to avoid "Ryan Walker" vs "Taijuan Walker" traps.
      const extractedParts = extractedName.split(/\s+/);
      const csvParts = csvName.split(/\s+/);

      if (extractedParts.length > 1 && csvParts.length > 1) {
        const normalize = (s: string) => 
          s.normalize('NFD')
           .replace(/[\u0300-\u036f]/g, "")
           .toLowerCase()
           .replace(/[^\w]/g, '')
           .trim();
        
        const extractedFirst = normalize(extractedParts[0]);
        const extractedLast = normalize(extractedParts[extractedParts.length - 1]);
        const csvFirst = normalize(csvParts[0]);
        const csvLast = normalize(csvParts[csvParts.length - 1]);

        // First Name Compatibility Check
        // Matches if names are identical OR one is a prefix of the other (for initials/shortened names)
        const firstMatches = extractedFirst === csvFirst || 
                            (extractedFirst.length <= 2 && csvFirst.startsWith(extractedFirst)) ||
                            (csvFirst.length <= 2 && extractedFirst.startsWith(csvFirst));
        
        // Last Name Check
        // Must be identical for high-stakes matching
        const lastMatches = extractedLast === csvLast;

        if (!firstMatches || !lastMatches) {
          // If first and last names are present but don't significantly overlap, reject the match entirely.
          return;
        }
      }

      // High confidence
      if (score < 0.1) {
        matched.push({ 
          ...p, 
          matchType: 'fuzzy', 
          score, 
          context: articlePlayer.context,
          bid: articlePlayer.bid,
          role: articlePlayer.role
        });
        seenIds.add(p.id);
      } 
      // Ambiguous/Possible
      else if (score < 0.35) {
        possible.push({ 
          ...p, 
          matchType: 'fuzzy', 
          score, 
          context: articlePlayer.context,
          bid: articlePlayer.bid,
          role: articlePlayer.role
        });
      }
    });
  });

  // Deduplicate possible matches and remove those already in matched
  const finalPossible = possible.filter(p => !seenIds.has(p.id));
  
  // Unique by ID for possible
  const uniquePossible: MatchResult[] = [];
  const possibleIds = new Set<string>();
  finalPossible.forEach(p => {
    if (!possibleIds.has(p.id)) {
      uniquePossible.push(p);
      possibleIds.add(p.id);
    }
  });

  return { matched, possible: uniquePossible };
}
