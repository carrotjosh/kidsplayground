-- 进化链。同一条链上的宝可梦共享 evolutionChainId，靠 evolvesFromId 串出先后顺序。
ALTER TABLE "PokemonSpecies" ADD COLUMN "evolvesFromId" INTEGER;
ALTER TABLE "PokemonSpecies" ADD COLUMN "evolutionChainId" INTEGER;
CREATE INDEX "PokemonSpecies_evolutionChainId_idx" ON "PokemonSpecies"("evolutionChainId");
