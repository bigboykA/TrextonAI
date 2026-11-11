export type HighlightCandidate = {
    start: number;
    end: number;
    score: number;
    reason: string;
    text: string;
  };
  
  export interface HighlightDetector {
    detect(transcriptPath: string): Promise<HighlightCandidate[]>;
  }