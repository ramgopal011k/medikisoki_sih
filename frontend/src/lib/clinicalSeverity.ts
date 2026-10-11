export const ESI_SEVERITY = {
  ESI_1: 95, // resuscitation (e.g. cardiac arrest, severe respiratory distress)
  ESI_2: 75, // emergent (e.g. chest pain with radiation, stroke symptoms)
  ESI_3: 50, // urgent (e.g. abdominal pain with vomiting, fever >39)
  ESI_4: 25, // less urgent (e.g. minor laceration, uncomplicated UTI)
  ESI_5: 10, // non-urgent (e.g. mild URI, minor rash)
} as const;

export const ALLOWED_SEVERITIES = [95, 75, 50, 25, 10] as const;
export type AllowedSeverity = (typeof ALLOWED_SEVERITIES)[number];
