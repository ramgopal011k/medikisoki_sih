export interface ConsentState {
  clinicalCare: boolean;
  aiAnalysis: boolean;
  abdmSharing: boolean;
  researchUse: boolean;
}

export const DEFAULT_CONSENT: ConsentState = {
  clinicalCare: true,  // Mandatory
  aiAnalysis: false,
  abdmSharing: false,
  researchUse: false
};
