export const VIRAL_PROMPT_IDS = [
  'politik_gesetze',
  'geld_alltag',
  'boerse_unternehmen',
  'tech_zukunft',
] as const

export type ViralPromptId = (typeof VIRAL_PROMPT_IDS)[number]

export interface ViralPromptMeta {
  id: ViralPromptId
  label: string
  description: string
  slideTitles: [string, string, string, string]
}

export const VIRAL_PROMPTS: ViralPromptMeta[] = [
  {
    id: 'politik_gesetze',
    label: 'Politik & Gesetze',
    description: 'Entscheidungen, Gesetzesänderungen und Urteile mit Wirkung auf Geld, Arbeit und Alltag.',
    slideTitles: ['Hook', 'Was ändert sich?', 'Wen betrifft es konkret?', 'Fazit & nächster Schritt'],
  },
  {
    id: 'geld_alltag',
    label: 'Geld & Alltag',
    description: 'Preisänderungen, Kostenfallen und Verbraucherinfos, die den Geldbeutel direkt treffen.',
    slideTitles: ['Hook', 'Was passiert?', 'Was bedeutet das für deinen Geldbeutel?', 'Worauf solltest du achten?'],
  },
  {
    id: 'boerse_unternehmen',
    label: 'Börse & Unternehmen',
    description: 'Unternehmens- und Wirtschaftsnachrichten mit starker Geschichte hinter den Zahlen.',
    slideTitles: ['Hook', 'Was ist passiert?', 'Warum ist das relevant?', 'Fazit: Chancen, Risiken, offene Frage'],
  },
  {
    id: 'tech_zukunft',
    label: 'Tech & Zukunft',
    description: 'Technologien mit konkreten Auswirkungen auf Arbeit, Einkommen, Kosten oder Alltag.',
    slideTitles: ['Hook', 'Was ist wirklich neu?', 'Was verändert sich konkret?', 'Einordnung: Grenzen & Konsequenzen'],
  },
]

export function isViralPromptId(value: unknown): value is ViralPromptId {
  return typeof value === 'string' && (VIRAL_PROMPT_IDS as readonly string[]).includes(value)
}
