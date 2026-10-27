-- Convert SubscriptionTierConfig prices from centimes to whole DZD
-- The seed data and old code mistakenly stored centimes (e.g. 190000 for 1,900 DZD)
-- The new billing system works in whole DZD units.
--
-- Only convert values that look like centimes (divisible by 100 and > typical DZD ranges).
-- Free plans (price=0) are left unchanged.

DO $$
BEGIN
  -- EdTech plans
  UPDATE "SubscriptionTierConfig"
  SET "price" = "price" / 100,
      "yearlyPrice" = "yearlyPrice" / 100
  WHERE "plan" IN ('STUDENT_STARTER', 'STUDENT_PLUS', 'STUDENT_PRO')
    AND "price" > 0
    AND "price" % 100 = 0
    AND "price" >= 100000;

  -- BI plans
  UPDATE "SubscriptionTierConfig"
  SET "price" = "price" / 100,
      "yearlyPrice" = "yearlyPrice" / 100
  WHERE "plan" IN ('BI_GROWTH', 'BI_SCALE', 'BI_ELITE')
    AND "price" > 0
    AND "price" % 100 = 0
    AND "price" >= 100000;

  -- Convert live session priceAmount values that were stored as centimes
  -- (frontend create page multiplied by 100)
  UPDATE "LiveSession"
  SET "priceAmount" = "priceAmount" / 100
  WHERE "priceAmount" > 0
    AND "priceAmount" % 100 = 0
    AND "priceAmount" >= 10000;
END $$;
