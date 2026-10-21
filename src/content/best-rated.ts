/**
 * "Best rated activities" cards on the landing. Titles live in messages/{en,es}.json
 * under `landing.bestRated.items.<id>`.
 *
 * - `image`: path of a file in /public (e.g. "/activities/atv.webp"). Empty = gray placeholder.
 * - `priceUsd`: "From" price per person in USD, as on whattodoincancun.com. null = price hidden.
 */
/** "See all tours" button above the cards. */
export const BEST_RATED_ALL_URL = "https://whattodoincancun.com/get-my-experience/";

export const BEST_RATED = [
  { id: "atv", image: "/cards-home/atv.webp", priceUsd: 49 },
  { id: "chichen", image: "/cards-home/chichen.webp", priceUsd: 79 },
  { id: "snorkel", image: "/cards-home/snorkel.webp", priceUsd: 39 },
  { id: "cenotes", image: "/cards-home/cenotes.webp", priceUsd: 59 },
  { id: "cocoBongo", image: "/cards-home/coco-bongo.webp", priceUsd: 129 },
] as const satisfies readonly { id: string; image: string; priceUsd: number | null }[];
