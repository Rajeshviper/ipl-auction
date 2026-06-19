// IPL-style bid increment slabs.
// As the price climbs, the minimum increment climbs too, just like real IPL auctions.
function getNextBidIncrement(currentAmount) {
  if (currentAmount < 100) return 5; // below 1 Cr -> 5 Lakh steps
  if (currentAmount < 200) return 10; // 1-2 Cr -> 10 Lakh steps
  if (currentAmount < 500) return 20; // 2-5 Cr -> 20 Lakh steps
  if (currentAmount < 1000) return 25; // 5-10 Cr -> 25 Lakh steps
  return 50; // above 10 Cr -> 50 Lakh steps
}

function getNextMinimumBid(currentAmount) {
  return currentAmount + getNextBidIncrement(currentAmount);
}

module.exports = { getNextBidIncrement, getNextMinimumBid };
