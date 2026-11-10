const PREVIEW = true;
const PRODUCTION_INDEXABLE = ["/"];

const PRODUCTION_ORIGIN = "https://yg-powerclean.de";
const PREVIEW_ORIGIN = "https://kayroone.github.io/yg.powerclean";
const PUBLIC_ORIGIN = PREVIEW ? PREVIEW_ORIGIN : PRODUCTION_ORIGIN;

module.exports = {
  PREVIEW,
  PRODUCTION_INDEXABLE,
  PRODUCTION_ORIGIN,
  PUBLIC_ORIGIN,
};
