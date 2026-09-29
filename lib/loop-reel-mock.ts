// MOCK DATA — Loop Reel prototype only.
// These structures mirror the shape future API responses should have, so the
// page can swap `MOCK_GOLDESEL_ARTICLES` / `MOCK_X_POSTS` for fetched data
// without touching the components.

export type LoopReelArticle = {
  id: string
  category: string
  publishedAt: string
  title: string
  summary: string
  image: string | null
}

export type LoopReelXPost = {
  id: string
  displayName: string
  handle: string
  publishedAt: string
  text: string
  hasMedia: boolean
}

export type LoopReelSelection =
  | { kind: 'article'; item: LoopReelArticle }
  | { kind: 'x-post'; item: LoopReelXPost }

const IMG = {
  markets: '/loop-reel/markets.png',
  gold: '/loop-reel/gold.png',
  tech: '/loop-reel/tech.png',
  macro: '/loop-reel/macro.png',
  energy: '/loop-reel/energy.png',
}

export const MOCK_GOLDESEL_ARTICLES: LoopReelArticle[] = [
  { id: 'a01', category: 'Märkte', publishedAt: '2026-09-29T07:45:00Z', title: 'DAX startet mit Rückenwind in die Woche – 19.800 Punkte im Visier', summary: 'Starke Vorgaben aus Asien und fallende Anleiherenditen stützen den deutschen Leitindex. Autowerte und Chipaktien führen die Gewinnerliste an.', image: IMG.markets },
  { id: 'a02', category: 'Rohstoffe', publishedAt: '2026-09-29T06:30:00Z', title: 'Goldpreis markiert neues Rekordhoch über 2.900 US-Dollar', summary: 'Zinssenkungsfantasie und anhaltende Käufe der Notenbanken treiben das Edelmetall. Analysten sehen weiteres Aufwärtspotenzial bis Jahresende.', image: IMG.gold },
  { id: 'a03', category: 'Tech', publishedAt: '2026-09-28T18:10:00Z', title: 'Nvidia: Neue Blackwell-Generation übertrifft Nachfrageprognosen', summary: 'Hyperscaler bestellen deutlich mehr KI-Beschleuniger als erwartet. Die Aktie legt nachbörslich zu, Zulieferer ziehen mit.', image: IMG.tech },
  { id: 'a04', category: 'Konjunktur', publishedAt: '2026-09-28T15:00:00Z', title: 'EZB signalisiert weitere Zinssenkung im Oktober', summary: 'Die Inflation im Euroraum nähert sich dem Zielwert. Mehrere Ratsmitglieder sprechen sich offen für eine Lockerung aus.', image: IMG.macro },
  { id: 'a05', category: 'Energie', publishedAt: '2026-09-28T12:20:00Z', title: 'Ölpreis fällt deutlich – OPEC+ erhöht Fördermenge', summary: 'Die Produzentenallianz dreht die Förderkürzungen schrittweise zurück. Brent rutscht unter die Marke von 70 US-Dollar.', image: IMG.energy },
  { id: 'a06', category: 'Aktien', publishedAt: '2026-09-28T09:05:00Z', title: 'SAP hebt Cloud-Prognose an – Aktie auf Allzeithoch', summary: 'Der Softwarekonzern profitiert vom KI-Boom im Geschäftskundensegment. Das Cloud-Backlog wächst um mehr als 30 Prozent.', image: IMG.tech },
  { id: 'a07', category: 'Märkte', publishedAt: '2026-09-27T20:30:00Z', title: 'Wall Street schließt uneinheitlich – Nasdaq mit Gewinnen', summary: 'Technologiewerte stützen den Index, während Banken und Versorger nachgeben. Anleger warten auf die Arbeitsmarktdaten.', image: IMG.markets },
  { id: 'a08', category: 'Krypto', publishedAt: '2026-09-27T16:45:00Z', title: 'Bitcoin-ETFs verzeichnen Rekordzuflüsse in einer Woche', summary: 'Institutionelle Investoren stocken massiv auf. Der Bitcoin-Kurs nähert sich wieder seinem Allzeithoch.', image: IMG.tech },
  { id: 'a09', category: 'Konjunktur', publishedAt: '2026-09-27T11:00:00Z', title: 'ifo-Geschäftsklima steigt überraschend deutlich', summary: 'Die Stimmung in der deutschen Wirtschaft hellt sich den dritten Monat in Folge auf. Vor allem die Industrie zeigt sich zuversichtlicher.', image: IMG.macro },
  { id: 'a10', category: 'Aktien', publishedAt: '2026-09-27T08:15:00Z', title: 'Rheinmetall erhält Großauftrag über 3,5 Milliarden Euro', summary: 'Der Rüstungskonzern liefert Munition und Fahrzeuge an mehrere NATO-Staaten. Der Auftragsbestand erreicht ein neues Rekordniveau.', image: IMG.markets },
  { id: 'a11', category: 'Rohstoffe', publishedAt: '2026-09-26T17:40:00Z', title: 'Silber zieht mit – Industrienachfrage aus der Solarbranche wächst', summary: 'Neben der Rolle als Krisenwährung treibt die Photovoltaik den Silberbedarf. Das Angebotsdefizit dürfte sich weiter vergrößern.', image: IMG.gold },
  { id: 'a12', category: 'Tech', publishedAt: '2026-09-26T14:25:00Z', title: 'Apple meldet starke iPhone-Nachfrage in China', summary: 'Nach mehreren schwachen Quartalen kehrt das Wachstum im wichtigen Auslandsmarkt zurück. KI-Funktionen gelten als Kaufargument.', image: IMG.tech },
  { id: 'a13', category: 'Energie', publishedAt: '2026-09-26T10:00:00Z', title: 'Gaspreise in Europa auf Zweijahrestief', summary: 'Volle Speicher und milde Temperaturprognosen drücken die Notierungen am TTF-Hub. Energieintensive Industrien atmen auf.', image: IMG.energy },
  { id: 'a14', category: 'Märkte', publishedAt: '2026-09-25T19:50:00Z', title: 'S&P 500 knackt erstmals die Marke von 6.000 Punkten', summary: 'Der breite US-Index feiert einen historischen Meilenstein. Die Rally wird zunehmend von Nebenwerten getragen.', image: IMG.markets },
  { id: 'a15', category: 'Konjunktur', publishedAt: '2026-09-25T13:30:00Z', title: 'US-Inflation sinkt auf 2,4 Prozent', summary: 'Die Verbraucherpreise steigen langsamer als erwartet. Die Fed dürfte damit ihren Lockerungskurs fortsetzen.', image: IMG.macro },
  { id: 'a16', category: 'Aktien', publishedAt: '2026-09-25T09:40:00Z', title: 'Siemens Energy: Windsparte schreibt wieder schwarze Zahlen', summary: 'Die Sanierung von Siemens Gamesa zeigt Wirkung. Der Konzern bestätigt seine Jahresziele und prüft Aktienrückkäufe.', image: IMG.energy },
  { id: 'a17', category: 'Krypto', publishedAt: '2026-09-24T18:20:00Z', title: 'Ethereum-Upgrade senkt Transaktionskosten deutlich', summary: 'Das Netzwerk-Update verbessert die Skalierbarkeit. Layer-2-Lösungen profitieren besonders stark von den neuen Gebühren.', image: IMG.tech },
  { id: 'a18', category: 'Rohstoffe', publishedAt: '2026-09-24T12:10:00Z', title: 'Kupferpreis steigt auf Achtmonatshoch', summary: 'Konjunkturhilfen aus China und Engpässe in Südamerika verknappen das Angebot. Minenbetreiber legen an der Börse zu.', image: IMG.gold },
  { id: 'a19', category: 'Märkte', publishedAt: '2026-09-24T08:00:00Z', title: 'Nikkei auf Rekordkurs – Yen schwächt sich weiter ab', summary: 'Japanische Exporteure profitieren von der schwachen Währung. Die Bank of Japan hält an ihrer lockeren Geldpolitik fest.', image: IMG.markets },
  { id: 'a20', category: 'Tech', publishedAt: '2026-09-23T16:35:00Z', title: 'Microsoft investiert 20 Milliarden in europäische Rechenzentren', summary: 'Der Softwareriese baut seine KI-Infrastruktur in Deutschland, Frankreich und Skandinavien massiv aus.', image: IMG.tech },
]

type XSource = { handle: string; displayName: string }

export const MOCK_X_SOURCES: XSource[] = [
  { handle: '@wallstengine', displayName: 'Wall St Engine' },
  { handle: '@KobeissiLetter', displayName: 'The Kobeissi Letter' },
  { handle: '@DeItaone', displayName: 'Walter Bloomberg' },
  { handle: '@SawyerMerritt', displayName: 'Sawyer Merritt' },
  { handle: '@charliebilello', displayName: 'Charlie Bilello' },
]

const src = (handle: string) => MOCK_X_SOURCES.find((s) => s.handle === handle)!

export const MOCK_X_POSTS: LoopReelXPost[] = [
  { id: 'x01', ...src('@wallstengine'), publishedAt: '2026-09-29T08:12:00Z', text: 'NVIDIA $NVDA shares rise 3% premarket after reports hyperscalers boosted 2027 AI capex plans by over 25%.', hasMedia: true },
  { id: 'x02', ...src('@wallstengine'), publishedAt: '2026-09-28T21:40:00Z', text: 'Microsoft $MSFT Azure growth reaccelerates to 35% YoY, beating estimates. Cloud backlog now at record levels.', hasMedia: false },
  { id: 'x03', ...src('@KobeissiLetter'), publishedAt: '2026-09-29T07:30:00Z', text: 'BREAKING: Gold hits a new all-time high above $2,900/oz. Gold is now up 38% year-to-date, its best year since 1979. Central banks keep buying.', hasMedia: true },
  { id: 'x04', ...src('@KobeissiLetter'), publishedAt: '2026-09-28T16:05:00Z', text: 'US national debt just crossed $37 trillion. Interest expense is now larger than the entire defense budget. This is not sustainable.', hasMedia: true },
  { id: 'x05', ...src('@DeItaone'), publishedAt: '2026-09-29T09:01:00Z', text: 'ECB’S LAGARDE: INFLATION CONVERGING TOWARDS TARGET FASTER THAN EXPECTED; FURTHER EASING APPROPRIATE IF DATA CONFIRMS', hasMedia: false },
  { id: 'x06', ...src('@DeItaone'), publishedAt: '2026-09-28T19:22:00Z', text: 'OPEC+ AGREES TO RAISE OUTPUT BY 400K BPD STARTING NOVEMBER – DELEGATES', hasMedia: false },
  { id: 'x07', ...src('@SawyerMerritt'), publishedAt: '2026-09-28T23:15:00Z', text: 'Tesla delivered a record 510,000 vehicles in Q3, beating Wall Street estimates of 470,000. Energy storage deployments also hit an all-time high.', hasMedia: true },
  { id: 'x08', ...src('@SawyerMerritt'), publishedAt: '2026-09-27T17:48:00Z', text: 'SpaceX Starship completes its first full orbital flight and successful booster catch. Next step: first commercial payload.', hasMedia: true },
  { id: 'x09', ...src('@charliebilello'), publishedAt: '2026-09-28T13:30:00Z', text: 'The S&P 500 has now hit 52 all-time highs this year. Only 1995 and 2021 had more. Total return YTD: +24%.', hasMedia: true },
  { id: 'x10', ...src('@charliebilello'), publishedAt: '2026-09-27T12:00:00Z', text: 'US CPI fell to 2.4% in August, the lowest inflation rate since February 2021. Core CPI remains stickier at 3.1%.', hasMedia: false },
]
