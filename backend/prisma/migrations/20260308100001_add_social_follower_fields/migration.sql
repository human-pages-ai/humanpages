-- Add social follower count fields and tiktok URL to Human
ALTER TABLE "Human" ADD COLUMN "twitterFollowers" INTEGER;
ALTER TABLE "Human" ADD COLUMN "instagramFollowers" INTEGER;
ALTER TABLE "Human" ADD COLUMN "youtubeFollowers" INTEGER;
ALTER TABLE "Human" ADD COLUMN "tiktokUrl" TEXT;
ALTER TABLE "Human" ADD COLUMN "tiktokFollowers" INTEGER;
ALTER TABLE "Human" ADD COLUMN "linkedinFollowers" INTEGER;
ALTER TABLE "Human" ADD COLUMN "facebookFollowers" INTEGER;
