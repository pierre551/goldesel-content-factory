import type {
  CompletedPost,
  DashboardStats,
  NewsCandidate,
  Production,
} from './types'

// --- Mock data source -------------------------------------------------------
// Everything is exported through plain functions so the call sites read like a
// data-access layer. Replace the function bodies with fetch/DB calls later
// without touching the UI.

export const STAGE_LABELS: Record<string, string> = {
  research: 'Research',
  content: 'Content',
  image: 'Image Generation',
  quality: 'Quality Check',
  canva: 'Canva',
  finished: 'Finished',
}

export const STAGE_ORDER = [
  'research',
  'content',
  'image',
  'quality',
  'canva',
  'finished',
] as const

const aktienNews: NewsCandidate[] = [
  {
    id: 'news-tsla',
    category: 'aktien',
    company: 'Tesla',
    ticker: 'TSLA',
    headline: 'Tesla knackt Auslieferungsrekord und schockt die Skeptiker',
    explanation:
      'Tesla hat im letzten Quartal mehr Fahrzeuge ausgeliefert als von Analysten erwartet. Der Robotaxi-Ausblick treibt die Fantasie zusätzlich an.',
    source: 'Bloomberg',
    publishedAt: 'vor 42 Min.',
    relevanceScore: 94,
    viralScore: 88,
    status: 'idle',
  },
  {
    id: 'news-nvda',
    category: 'aktien',
    company: 'Nvidia',
    ticker: 'NVDA',
    headline: 'Nvidia liefert KI-Chips schneller aus als gedacht',
    explanation:
      'Die Nachfrage nach der neuen GPU-Generation übersteigt das Angebot deutlich. Rechenzentren-Umsatz erreicht ein neues Allzeithoch.',
    source: 'Reuters',
    publishedAt: 'vor 1 Std.',
    relevanceScore: 97,
    viralScore: 92,
    status: 'idle',
  },
  {
    id: 'news-aapl',
    category: 'aktien',
    company: 'Apple',
    ticker: 'AAPL',
    headline: 'Apple überrascht mit starkem Services-Wachstum',
    explanation:
      'Trotz schwächelnder iPhone-Verkäufe wächst das margenstarke Services-Segment zweistellig. Anleger reagieren positiv im After-Hours-Handel.',
    source: 'CNBC',
    publishedAt: 'vor 2 Std.',
    relevanceScore: 85,
    viralScore: 74,
    status: 'idle',
  },
  {
    id: 'news-sap',
    category: 'aktien',
    company: 'SAP',
    ticker: 'SAP',
    headline: 'SAP-Cloudgeschäft wächst schneller als der Gesamtmarkt',
    explanation:
      'Der Walldorfer Konzern meldet rekordverdächtige Cloud-Auftragseingänge. Das Management hebt die Jahresprognose an.',
    source: 'Handelsblatt',
    publishedAt: 'vor 3 Std.',
    relevanceScore: 82,
    viralScore: 61,
    status: 'idle',
  },
  {
    id: 'news-lulu',
    category: 'aktien',
    company: 'Lululemon',
    ticker: 'LULU',
    headline: 'Lululemon dreht auf: Neue Kollektion befeuert die Aktie',
    explanation:
      'Nach einer Schwächephase überzeugt Lululemon mit starken Umsätzen in Asien. Die Bruttomarge verbessert sich unerwartet deutlich.',
    source: 'MarketWatch',
    publishedAt: 'vor 4 Std.',
    relevanceScore: 78,
    viralScore: 69,
    status: 'idle',
  },
]

const wirtschaftNews: NewsCandidate[] = [
  {
    id: 'news-ezb',
    category: 'wirtschaft',
    company: 'EZB',
    ticker: 'MACRO',
    headline: 'EZB signalisiert weitere Zinssenkung für das Frühjahr',
    explanation:
      'Die Europäische Zentralbank deutet angesichts sinkender Inflation eine Lockerung der Geldpolitik an. Märkte preisen bereits einen Schritt ein.',
    source: 'Financial Times',
    publishedAt: 'vor 30 Min.',
    relevanceScore: 91,
    viralScore: 70,
    status: 'idle',
  },
  {
    id: 'news-oil',
    category: 'wirtschaft',
    company: 'Ölmarkt',
    ticker: 'OIL',
    headline: 'Ölpreis springt nach Förderkürzung der OPEC+ nach oben',
    explanation:
      'Die OPEC+ verlängert ihre Produktionskürzungen. Brent klettert über eine wichtige psychologische Marke.',
    source: 'Reuters',
    publishedAt: 'vor 1 Std.',
    relevanceScore: 86,
    viralScore: 66,
    status: 'idle',
  },
  {
    id: 'news-jobs',
    category: 'wirtschaft',
    company: 'US-Arbeitsmarkt',
    ticker: 'MACRO',
    headline: 'US-Arbeitsmarkt zeigt sich robuster als erwartet',
    explanation:
      'Die neuen Beschäftigungszahlen übertreffen die Prognosen. Das dämpft die Hoffnung auf schnelle Zinssenkungen der Fed.',
    source: 'Bloomberg',
    publishedAt: 'vor 2 Std.',
    relevanceScore: 83,
    viralScore: 58,
    status: 'idle',
  },
  {
    id: 'news-dax',
    category: 'wirtschaft',
    company: 'DAX',
    ticker: 'DAX',
    headline: 'DAX erreicht neues Rekordhoch trotz Konjunktursorgen',
    explanation:
      'Der deutsche Leitindex markiert ein Allzeithoch, getrieben von Tech- und Industriewerten. Anleger ignorieren schwache Frühindikatoren.',
    source: 'Handelsblatt',
    publishedAt: 'vor 3 Std.',
    relevanceScore: 80,
    viralScore: 72,
    status: 'idle',
  },
  {
    id: 'news-gold',
    category: 'wirtschaft',
    company: 'Goldmarkt',
    ticker: 'XAU',
    headline: 'Goldpreis auf Allzeithoch — Anleger flüchten in Sicherheit',
    explanation:
      'Geopolitische Unsicherheit und Zinssenkungsfantasie treiben den Goldpreis auf ein neues Rekordniveau.',
    source: 'MarketWatch',
    publishedAt: 'vor 5 Std.',
    relevanceScore: 79,
    viralScore: 75,
    status: 'idle',
  },
]

const productions: Production[] = [
  {
    id: 'prod-nvda-01',
    company: 'Nvidia',
    ticker: 'NVDA',
    headline: 'Nvidia liefert KI-Chips schneller aus als gedacht',
    category: 'aktien',
    currentStage: 'quality',
    createdAt: '07.09.2026 · 09:14',
    steps: [
      { stage: 'research', label: 'Research', status: 'done', detail: 'Quellen verifiziert, 4 Belege gesammelt.' },
      { stage: 'content', label: 'Content', status: 'done', detail: 'Deutsche Caption & Hook generiert.' },
      { stage: 'image', label: 'Image Generation', status: 'done', detail: '2 Varianten erzeugt.' },
      { stage: 'quality', label: 'Quality Check', status: 'in_progress', detail: 'Automatische QA läuft…' },
      { stage: 'canva', label: 'Canva', status: 'idle', detail: 'Wartet auf Freigabe.' },
      { stage: 'finished', label: 'Finished', status: 'idle', detail: 'Noch nicht abgeschlossen.' },
    ],
    images: [
      { id: 'img-nvda-v1', version: 'V1', url: '/posts/nvidia.png', status: 'approved', qaScore: 91 },
      { id: 'img-nvda-v2', version: 'V2', url: '/posts/nvidia.png', status: 'pending', qaScore: 84 },
    ],
  },
  {
    id: 'prod-tsla-01',
    company: 'Tesla',
    ticker: 'TSLA',
    headline: 'Tesla knackt Auslieferungsrekord und schockt die Skeptiker',
    category: 'aktien',
    currentStage: 'content',
    createdAt: '07.09.2026 · 08:52',
    steps: [
      { stage: 'research', label: 'Research', status: 'done', detail: 'Quellen verifiziert, 3 Belege gesammelt.' },
      { stage: 'content', label: 'Content', status: 'in_progress', detail: 'Caption wird verfeinert…' },
      { stage: 'image', label: 'Image Generation', status: 'idle', detail: 'Wartet auf Content.' },
      { stage: 'quality', label: 'Quality Check', status: 'idle', detail: 'Ausstehend.' },
      { stage: 'canva', label: 'Canva', status: 'idle', detail: 'Ausstehend.' },
      { stage: 'finished', label: 'Finished', status: 'idle', detail: 'Noch nicht abgeschlossen.' },
    ],
    images: [
      { id: 'img-tsla-v1', version: 'V1', url: '/posts/tesla.png', status: 'pending', qaScore: 79 },
    ],
  },
  {
    id: 'prod-sap-01',
    company: 'SAP',
    ticker: 'SAP',
    headline: 'SAP-Cloudgeschäft wächst schneller als der Gesamtmarkt',
    category: 'aktien',
    currentStage: 'finished',
    createdAt: '06.09.2026 · 16:20',
    steps: [
      { stage: 'research', label: 'Research', status: 'done', detail: 'Quellen verifiziert.' },
      { stage: 'content', label: 'Content', status: 'done', detail: 'Caption freigegeben.' },
      { stage: 'image', label: 'Image Generation', status: 'done', detail: 'V2 ausgewählt.' },
      { stage: 'quality', label: 'Quality Check', status: 'approved', detail: 'QA bestanden (93).' },
      { stage: 'canva', label: 'Canva', status: 'done', detail: 'Template gerendert.' },
      { stage: 'finished', label: 'Finished', status: 'done', detail: 'Bereit zur Veröffentlichung.' },
    ],
    images: [
      { id: 'img-sap-v1', version: 'V1', url: '/posts/sap.png', status: 'rejected', qaScore: 71 },
      { id: 'img-sap-v2', version: 'V2', url: '/posts/sap.png', status: 'approved', qaScore: 93 },
    ],
    canvaPreview: '/posts/sap.png',
  },
]

const completedPosts: CompletedPost[] = [
  {
    id: 'post-sap-01',
    company: 'SAP',
    ticker: 'SAP',
    headline: 'SAP-Cloudgeschäft wächst schneller als der Gesamtmarkt',
    canvaPreview: '/posts/sap.png',
    createdAt: '06.09.2026',
  },
  {
    id: 'post-aapl-01',
    company: 'Apple',
    ticker: 'AAPL',
    headline: 'Apple überrascht mit starkem Services-Wachstum',
    canvaPreview: '/posts/apple.png',
    createdAt: '05.09.2026',
  },
  {
    id: 'post-lulu-01',
    company: 'Lululemon',
    ticker: 'LULU',
    headline: 'Lululemon dreht auf: Neue Kollektion befeuert die Aktie',
    canvaPreview: '/posts/lululemon.png',
    createdAt: '04.09.2026',
  },
]

export function getAktienNews(): NewsCandidate[] {
  return aktienNews
}

export function getWirtschaftNews(): NewsCandidate[] {
  return wirtschaftNews
}

export function getProductions(): Production[] {
  return productions
}

export function getProduction(id: string): Production | undefined {
  return productions.find((p) => p.id === id)
}

export function getCompletedPosts(): CompletedPost[] {
  return completedPosts
}

export function getDashboardStats(): DashboardStats {
  return {
    researched: aktienNews.length + wirtschaftNews.length,
    selected: 2,
    inProgress: productions.filter((p) => p.currentStage !== 'finished').length,
    completed: completedPosts.length,
  }
}
