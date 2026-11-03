/**
 * Comprehensive integration test for Tenrai Anime API, AnimeDatabase, and NexPlayAnimeApi.
 */

async function runTests() {
  console.log('====================================================');
  console.log('   NEXPLAY TENRAI ANIME INTEGRATION TEST SUITE      ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Test TenraiApiService
    console.log('--- 1. Testing TenraiApiService Client ---');
    const { tenraiApiService } = await import('./src/services/TenraiApiService.js');
    assert(tenraiApiService.baseUrl === 'https://api.tenrai.org/v1', 'Base URL is https://api.tenrai.org/v1');
    assert(tenraiApiService.docsUrl === 'https://api.tenrai.org/documentation', 'Docs URL is configured');

    const topAnime = await tenraiApiService.getTopAnime({ limit: 5 });
    assert(topAnime && Array.isArray(topAnime.data) && topAnime.data.length > 0, `getTopAnime returned ${topAnime?.data?.length} items`);

    const airingAnime = await tenraiApiService.getCurrentSeasonAnime({ limit: 5 });
    assert(airingAnime && Array.isArray(airingAnime.data) && airingAnime.data.length > 0, `getCurrentSeasonAnime returned ${airingAnime?.data?.length} items`);

    const searchRes = await tenraiApiService.searchAnime('Jujutsu Kaisen', { limit: 3 });
    assert(searchRes && Array.isArray(searchRes.data) && searchRes.data.length > 0, `searchAnime returned ${searchRes?.data?.length} results`);

    const sampleMalId = topAnime.data[0].mal_id;
    const animeDetails = await tenraiApiService.getAnimeById(sampleMalId);
    assert(animeDetails && animeDetails.data && animeDetails.data.mal_id === sampleMalId, `getAnimeById(${sampleMalId}) returned ${animeDetails?.data?.title}`);

    const episodesRes = await tenraiApiService.getAnimeEpisodes(sampleMalId, 1);
    assert(episodesRes && Array.isArray(episodesRes.data), `getAnimeEpisodes returned ${episodesRes?.data?.length} episodes`);

    const relationsRes = await tenraiApiService.getAnimeRelations(sampleMalId);
    assert(relationsRes && Array.isArray(relationsRes.data), `getAnimeRelations returned ${relationsRes?.data?.length} relation groups`);

    // 2. Test AnimeDatabase
    console.log('\n--- 2. Testing AnimeDatabase Architecture ---');
    const { animeDatabase } = await import('./src/services/AnimeDatabase.js');
    await animeDatabase.init();

    // Ingest top anime and search results
    const ingestedIds = animeDatabase.ingestAnimeBatch(topAnime.data);
    assert(ingestedIds.length > 0, `Ingested ${ingestedIds.length} anime items into database`);

    const primaryInternalId = ingestedIds[0];
    assert(primaryInternalId.startsWith('np_anime_'), `Internal primary key format correct: ${primaryInternalId}`);

    const retrievedAnime = animeDatabase.getAnimeById(primaryInternalId);
    assert(retrievedAnime && retrievedAnime.id === primaryInternalId, `Retrieved anime record by internal ID (${retrievedAnime?.title})`);
    assert(retrievedAnime.mal_id === sampleMalId, `External identifier MAL ID preserved (${retrievedAnime?.mal_id})`);
    assert(retrievedAnime.media_type === 'anime' && retrievedAnime.isAnime === true, 'Media type correctly identified as anime');
    assert(Array.isArray(retrievedAnime.genres), 'Genres mapped properly');

    // Ingest episodes and relations
    if (episodesRes.data.length > 0) {
      animeDatabase.ingestEpisodes(primaryInternalId, episodesRes.data);
      const dbEps = animeDatabase.getEpisodes(primaryInternalId, 1, 10);
      assert(dbEps.data.length > 0, `Stored & queried ${dbEps.data.length} episodes from local database`);
    }

    if (relationsRes.data.length > 0) {
      animeDatabase.ingestRelations(primaryInternalId, relationsRes.data);
      const dbRels = animeDatabase.getRelations(primaryInternalId);
      assert(dbRels.data.length > 0, `Stored & queried ${dbRels.data.length} relations from local database`);
    }

    // Test Watchlist
    console.log('\n--- 3. Testing Watchlist & Watch Progress ---');
    const wlEntry = animeDatabase.setWatchlistStatus(primaryInternalId, 'watching');
    assert(wlEntry && wlEntry.status === 'watching', 'Successfully added anime to Watchlist');

    const watchlist = animeDatabase.getWatchlist();
    assert(watchlist.some(w => w.anime_id === primaryInternalId), 'Watchlist contains added anime');

    // Test Episode Progress and Next Episode calculation
    animeDatabase.saveEpisodeProgress(primaryInternalId, {
      episodeNumber: 1,
      currentTime: 1400,
      duration: 1440,
      progress: 97,
      completed: true
    });

    const ep1Progress = animeDatabase.getEpisodeProgress(primaryInternalId, 1);
    assert(ep1Progress && ep1Progress.completed === true, 'Episode 1 marked completed in user_anime_progress');

    const nextEpInfo = animeDatabase.getNextEpisode(primaryInternalId);
    assert(nextEpInfo.nextEpisodeNumber === 2, `Next episode calculated accurately: Episode ${nextEpInfo.nextEpisodeNumber}`);

    const cwList = animeDatabase.getContinueWatchingList();
    assert(Array.isArray(cwList), `getContinueWatchingList returned ${cwList.length} items`);

    // Test sync logs
    animeDatabase.logSync('unit_test_sync', 5, 'success', null, 42);
    const hasLog = animeDatabase.tables.sync_logs.some(l => l.sync_type === 'unit_test_sync');
    assert(hasLog, 'Sync log recorded in database sync_logs table');

    // 4. Test NexPlayAnimeApi Endpoints
    console.log('\n--- 4. Testing NexPlayAnimeApi & REST Endpoints ---');
    const { nexPlayAnimeApi } = await import('./src/services/NexPlayAnimeApi.js');

    // 1. GET /api/anime/home
    const homeRes = await nexPlayAnimeApi.handleRequest('GET', '/api/anime/home');
    assert(homeRes.success && homeRes.data, 'GET /api/anime/home succeeded');
    assert(Array.isArray(homeRes.data.trending) && homeRes.data.trending.length > 0, 'Home feed contains trending');
    assert(Array.isArray(homeRes.data.airing), 'Home feed contains airing');
    assert(Array.isArray(homeRes.data.movies), 'Home feed contains anime movies');
    assert(Array.isArray(homeRes.data.actionShonen), 'Home feed contains Shonen category');

    // 2. GET /api/anime
    const listRes = await nexPlayAnimeApi.handleRequest('GET', '/api/anime', { limit: 5 });
    assert(listRes.success && Array.isArray(listRes.data), 'GET /api/anime succeeded');

    // 3. GET /api/anime/search?q=
    const searchApiRes = await nexPlayAnimeApi.handleRequest('GET', '/api/anime/search', { q: 'Titan' });
    assert(searchApiRes.success && Array.isArray(searchApiRes.data), 'GET /api/anime/search?q=Titan succeeded');

    // 4. GET /api/anime/trending
    const trendingApiRes = await nexPlayAnimeApi.handleRequest('GET', '/api/anime/trending');
    assert(trendingApiRes.success && Array.isArray(trendingApiRes.data), 'GET /api/anime/trending succeeded');

    // 5. GET /api/anime/popular
    const popApiRes = await nexPlayAnimeApi.handleRequest('GET', '/api/anime/popular');
    assert(popApiRes.success && Array.isArray(popApiRes.data), 'GET /api/anime/popular succeeded');

    // 6. GET /api/anime/top-rated
    const topRatedApiRes = await nexPlayAnimeApi.handleRequest('GET', '/api/anime/top-rated');
    assert(topRatedApiRes.success && Array.isArray(topRatedApiRes.data), 'GET /api/anime/top-rated succeeded');

    // 7. GET /api/anime/airing
    const airingApiRes = await nexPlayAnimeApi.handleRequest('GET', '/api/anime/airing');
    assert(airingApiRes.success && Array.isArray(airingApiRes.data), 'GET /api/anime/airing succeeded');

    // 8. GET /api/anime/upcoming
    const upcomingApiRes = await nexPlayAnimeApi.handleRequest('GET', '/api/anime/upcoming');
    assert(upcomingApiRes.success && Array.isArray(upcomingApiRes.data), 'GET /api/anime/upcoming succeeded');

    // 9. GET /api/anime/movies
    const moviesApiRes = await nexPlayAnimeApi.handleRequest('GET', '/api/anime/movies');
    assert(moviesApiRes.success && Array.isArray(moviesApiRes.data), 'GET /api/anime/movies succeeded');

    // 10. GET /api/anime/{id}
    const detailsApiRes = await nexPlayAnimeApi.handleRequest('GET', `/api/anime/${primaryInternalId}`);
    assert(detailsApiRes.success && detailsApiRes.data && detailsApiRes.data.id === primaryInternalId, `GET /api/anime/${primaryInternalId} succeeded`);

    // 11. GET /api/anime/{id}/episodes
    const episodesApiRes = await nexPlayAnimeApi.handleRequest('GET', `/api/anime/${primaryInternalId}/episodes`);
    assert(episodesApiRes.success && Array.isArray(episodesApiRes.data), `GET /api/anime/${primaryInternalId}/episodes succeeded`);

    // 12. GET /api/anime/{id}/relations
    const relationsApiRes = await nexPlayAnimeApi.handleRequest('GET', `/api/anime/${primaryInternalId}/relations`);
    assert(relationsApiRes.success && Array.isArray(relationsApiRes.data), `GET /api/anime/${primaryInternalId}/relations succeeded`);

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

