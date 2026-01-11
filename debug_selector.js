const { chromium } = require('./packages/core/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1536, height: 695 } });

  // Navigate to search page
  await page.goto(
    'https://www.rightdev.co.uk/search/?more_category=none&sector=gyms&location=london&more_category=&sortby=new&noindex=1'
  );

  // Wait for page load
  await page.waitForLoadState('networkidle');

  // Scroll to position where card 3 should be
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(2000);

  // Check what listing cards exist
  const listItems = await page.locator('ul#listings_cn > li').all();
  console.log(`\nTotal listing cards found: ${listItems.length}`);

  for (let i = 0; i < listItems.length; i++) {
    const isVisible = await listItems[i].isVisible();
    console.log(`  Card ${i + 1} (li:nth-child(${i + 1})): ${isVisible ? 'VISIBLE' : 'hidden'}`);
  }

  // Try the exact selector from recording
  const selector =
    'ul#listings_cn > li:nth-child(3) > div.content__body__item-img > div.content__body__item-img__wrapper > span.content__body__item-img-arrow.next > span';
  const count = await page.locator(selector).count();
  console.log(`\nSelector from recording matched: ${count} elements`);

  // Try simpler selectors
  const card3 = await page.locator('ul#listings_cn > li:nth-child(3)').count();
  console.log(`Card 3 container exists: ${card3} elements`);

  const card3Arrows = await page
    .locator('ul#listings_cn > li:nth-child(3) span.content__body__item-img-arrow')
    .count();
  console.log(`Card 3 arrows exist: ${card3Arrows} elements`);

  const allArrows = await page.locator('span.content__body__item-img-arrow').count();
  console.log(`Total carousel arrows on page: ${allArrows} elements`);

  // Analyze card types
  console.log('\n🔬 Card Type Analysis:');
  for (let i = 1; i <= 6; i++) {
    const card = page.locator(`ul#listings_cn > li:nth-child(${i})`);
    const hasAgentBanner = await card.locator('.agent-banner').count();
    const hasGymListing = await card.locator('.content__body__item-img').count();
    const hasCarousel = await card.locator('span.content__body__item-img-arrow').count();

    if (hasAgentBanner > 0) {
      console.log(`  Card ${i}: AGENT BANNER (advertisement)`);
    } else if (hasGymListing > 0) {
      console.log(`  Card ${i}: GYM LISTING (${hasCarousel} carousel arrows)`);
    } else {
      const html = await card.innerHTML();
      console.log(`  Card ${i}: UNKNOWN - ${html.substring(0, 100)}...`);
    }
  }

  // Find which card is actually the first gym listing with carousel
  console.log('\n🎯 Mapping: li position → Gym number:');
  const allCards = await page.locator('ul#listings_cn > li').all();
  let gymIndex = 0;
  for (let i = 0; i < Math.min(allCards.length, 10); i++) {
    const hasGymListing = await allCards[i].locator('.content__body__item-img').count();
    if (hasGymListing > 0) {
      gymIndex++;
      const hasCarousel = await allCards[i].locator('span.content__body__item-img-arrow').count();
      console.log(`  li:nth-child(${i + 1}) = Gym #${gymIndex} (${hasCarousel} arrows)`);
    }
  }
  console.log('\nPress Ctrl+C to exit...');
  await page.waitForTimeout(60000);

  await browser.close();
})();
