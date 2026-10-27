import { Product } from './index';

export type MatchTier = 'exact_match' | 'very_similar' | 'alternative_style';

export type CanonicalPatternType =
  | 'plain/solid'
  | 'stripes'
  | 'checks'
  | 'plaid'
  | 'floral'
  | 'polka dots'
  | 'abstract print'
  | 'graphic print'
  | 'geometric'
  | 'animal print'
  | 'embroidered'
  | 'textured';

export interface StylistPreferences {
  gender?: string;
  occasion?: string;
  style?: string;
  colors?: string[];
  clothingTypes?: string[];
  budgetInr?: number;
  preferredSize?: string;
}

export interface VisualGarmentAnalysis {
  isClothingDetected: boolean;
  summary: string;
  garmentType: string;
  garmentSubcategory?: string;
  broadRole: 'top' | 'bottom' | 'one_piece' | 'outerwear' | 'footwear' | 'accessory' | 'other';
  genderFit: string;
  primaryColor: string;
  secondaryColors: string[];
  dominantColors: string[];
  colorCombination: string;
  colorDistributionAndContrast?: string;
  pattern: CanonicalPatternType | string;
  patternScaleAndDetail?: string;
  patternOrPrint: string;
  fabricAppearance: string;
  silhouetteAndFit: string;
  collarAndNeckline?: string;
  sleeves?: string;
  sleeveAndNeckline: string;
  styleCategory: string;
  designDetails: string[];
  outfitPairingIdeas: string[];
}

export interface StylistProductRecommendation {
  product: Product;
  matchTier?: MatchTier;
  matchScore: number;
  matchReason: string;
  inStock: boolean;
  totalStock: number;
  effectivePrice: number;
  availableSizes: string[];
  availableColors: Array<{ name: string; hex?: string }>;
}

export interface VisualMatchGroups {
  hasExactMatch: boolean;
  hasStrongVisualMatch: boolean;
  lowConfidenceMessage?: string | null;
  closestMatches: StylistProductRecommendation[];
  sameCategoryDifferentColor: StylistProductRecommendation[];
  similarPatternOrDesign: StylistProductRecommendation[];
}

export interface StylistOutfitPiece {
  role: string;
  product: Product;
  unitPrice: number;
  inStock: boolean;
  availableSizes: string[];
  stylingNote: string;
}

export interface StylistOutfitSuggestion {
  title: string;
  occasion: string;
  colorCoordination: string;
  stylingSummary: string;
  pieces: StylistOutfitPiece[];
  totalPrice: number;
  regularTotalPrice: number;
  withinBudget: boolean;
  missingCategoryNote?: string;
}

export interface StylistHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
  hadImage?: boolean;
}

export interface StylistImageInput {
  base64Data: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width?: number;
  height?: number;
  fileName?: string;
}

export interface StylistApiRequest {
  message?: string;
  history?: StylistHistoryTurn[];
  preferences?: StylistPreferences;
  image?: StylistImageInput | null;
  mode?: 'chat' | 'visual_search' | 'outfit_builder' | 'load_more_matches';
  offset?: number;
  limit?: number;
  cachedAnalysis?: VisualGarmentAnalysis | null;
}

export interface StylistApiResponse {
  success: boolean;
  reply: string;
  preferences: StylistPreferences;
  followUpSuggestions: string[];
  visualAnalysis?: VisualGarmentAnalysis | null;
  visualMatchGroups?: VisualMatchGroups | null;
  recommendations: StylistProductRecommendation[];
  outfit?: StylistOutfitSuggestion | null;
  pagination?: {
    offset: number;
    limit: number;
    totalEligible: number;
    hasMore: boolean;
  };
  catalogStats?: {
    totalPublished: number;
    inStockCount: number;
  };
  error?: string;
  errorCode?:
    | 'RATE_LIMITED'
    | 'INVALID_IMAGE'
    | 'DATABASE_NOT_CONFIGURED'
    | 'GEMINI_NOT_CONFIGURED'
    | 'GEMINI_QUOTA_OR_AUTH'
    | 'VISION_ANALYSIS_FAILED'
    | 'SERVER_ERROR';
  retryAfterSeconds?: number;
}
