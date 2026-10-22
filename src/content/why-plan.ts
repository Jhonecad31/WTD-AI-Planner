/**
 * Photo behind the trust card in "Why plan with What To Do In Cancun".
 * WhatToDo's own Bokun image (Playa Paraíso), served at two sizes so phones get the small one.
 * To use a local file instead, point `src` to /public and drop `srcSet`.
 */
const img = (w: number, h: number) =>
  `https://imgcdn.bokun.tools/5da3a4da-db71-4b31-9283-9b6ce6049a61.jpeg?w=${w}&h=${h}`;

export const WHY_PLAN_PHOTO = {
  src: img(1024, 768),
  srcSet: `${img(640, 480)} 640w, ${img(1024, 768)} 1024w`,
  width: 1024,
  height: 768,
};
