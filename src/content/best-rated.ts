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
  {
    id: "atv",
    image: "/cards-home/atv.webp",
    priceUsd: 49,
    url: "https://whattodoincancun.com/tour/atv-and-zipline-in-cancun/",
  },
  {
    id: "chichen",
    image: "/cards-home/chichen.webp",
    priceUsd: 79,
    url: "https://whattodoincancun.com/tour/chichen-itza-tour/",
  },
  {
    id: "snorkel",
    image: "/cards-home/snorkel.webp",
    priceUsd: 39,
    url: "https://whattodoincancun.com/tour/puerto-morelos-reef-snorkel-adventure/",
  },
  {
    id: "cenotes",
    image: "/cards-home/cenotes.webp",
    priceUsd: 59,
    url: "https://whattodoincancun.com/tour/cenotes-adventuring-tour/",
  },
  {
    id: "cocoBongo",
    image: "/cards-home/coco-bongo.webp",
    priceUsd: 129,
    url: "https://whattodoincancun.com/party/coco-bongo-cancun-admission/",
  },
] as const satisfies readonly {
  id: string;
  image: string;
  priceUsd: number | null;
  url?: string;
}[];
