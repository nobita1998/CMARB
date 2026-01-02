/**
 * Market configuration file
 *
 * Add your market mappings here. Each market entry maps the same event
 * across Opinion and Polymarket platforms.
 *
 * How to find IDs:
 * - Opinion: Use API to get market list, find token_id for each outcome
 * - Polymarket: Just use the slug from URL (e.g., "will-trump-win-2024")
 *               Token IDs will be fetched automatically
 */

export const config = {
  // List of monitored markets
  markets: [
    {
      id: 'okbet-arena',
      name: 'OKBet Arena AI Trading Competition Winner',
      type: 'AI',
      outcomes: ['Claude', 'Grok', 'GPT', 'Gemini', 'DeepSeek'],
      opinion: {
        type: 'multi',
        topicId: 200,
        // Token IDs from opinionhud.xyz subMarkets (YES and NO)
        tokenIds: {
          'Claude': {
            yes: '99353051721477177522248927887685280403582727125089473449457683027956209420233',
            no: '498173313833333658408014606670126702148839247487238581369918122354744805527'
          },
          'Grok': {
            yes: '84050668144771462745725102411563575263355837446216186466529103827844959435083',
            no: '24558569876224631606533686112546365365987311573982132420492104862671596454999'
          },
          'GPT': {
            yes: '42319541515664828250446614637825290909906598838156266529607327427802190443014',
            no: '68830162966383483707530436468772993129325665492635111262195370209698824893026'
          },
          'Gemini': {
            yes: '23531842956787102371605943484234618811255982077472632998524817288703118131297',
            no: '88465730185411082082239142264490271451192709305786100998502230745675173003633'
          },
          'DeepSeek': {
            yes: '45588982941816461887283742884334221333930523611571629666106584018853318729607',
            no: '74388317922554303785687591284679844487054920826515233811898442618252614663148'
          }
        }
      },
      poly: {
        slug: 'okbet-arena-ai-trading-competition-winner'
      }
    },
    {
      id: 'australian-open-2026',
      name: '2026 Men\'s Australian Open Winner',
      type: 'Sports',
      outcomes: ['Jannik Sinner', 'Carlos Alcaraz', 'Novak Djokovic', 'Alexander Zverev', 'Daniil Medvedev', 'Taylor Fritz'],
      opinion: {
        type: 'multi',
        topicId: 222,
        tokenIds: {
          'Jannik Sinner': {
            yes: '10990025055030864033644049099969609211995219283299762856830315040027923312418',
            no: '9367871925738449846078853826569477761807876828205924594558468092754591369630'
          },
          'Carlos Alcaraz': {
            yes: '5841777524912799911686489680621025231260681953989292512757327612553713369228',
            no: '64344099329391618910350584391575213797350489347270647407750665766451908245116'
          },
          'Novak Djokovic': {
            yes: '23646221477390387795126578723913806756902942126650124014757240718947705505120',
            no: '96391605491330066176973561786039441743608974332726930433034784561032580738233'
          },
          'Alexander Zverev': {
            yes: '102944805128937061565106041749150538528526332505331418730313552171138925371294',
            no: '10758724656172236720247750193227389076596673874562063124279063295961252874901'
          },
          'Daniil Medvedev': {
            yes: '68087172610554274638226732235885933041593128691934221197568495110385465635635',
            no: '64577943242976889766632440991206514906722876271028100915910622389812397307553'
          },
          'Taylor Fritz': {
            yes: '79794759853759991111197957504358946094000142489182558476200833177929494073128',
            no: '3298240858201198940176111916310036195292828712910777880061261707214680080668'
          }
        }
      },
      poly: {
        slug: '2026-mens-australian-open-winner'
      }
    },
  ],

  // Global settings
  settings: {
    // Polling settings
    pollingInterval: 2000,     // Interval between batches in ms
    maxRequestsPerBatch: 10,   // Max 10 requests per batch (safe limit)
    requestsPerMarket: 4,      // 4 requests per market (Opinion YES/NO + Poly YES/NO)

    // Opinion points system
    pointCost: 20,       // 20U = 1 point
    pointValue: 10,      // 1 point = 10U

    // Signal thresholds (in decimal, e.g., 0.02 = 2%)
    minSpreadAlert: 0.02,      // GO signal threshold (>2%)
    hotSpreadThreshold: 0.05   // HOT signal threshold (>5%)
  }
};

/**
 * Get Opinion markets config
 */
export function getOpinionMarkets() {
  return config.markets
    .filter(m => m.opinion?.topicId || m.opinion?.tokenIds)
    .map(m => ({
      eventId: m.id,
      topicId: m.opinion.topicId,
      type: m.opinion.type,
      outcomeIds: m.opinion.tokenIds
    }));
}

/**
 * Get Polymarket markets config
 */
export function getPolyMarkets() {
  return config.markets
    .filter(m => m.poly?.slug)
    .map(m => ({
      eventId: m.id,
      slug: m.poly.slug
    }));
}

/**
 * Get market by ID
 */
export function getMarketById(id) {
  return config.markets.find(m => m.id === id);
}

/**
 * Get all market types for filtering
 */
export function getMarketTypes() {
  const types = new Set(config.markets.map(m => m.type));
  return ['ALL', ...Array.from(types)];
}

export default config;
