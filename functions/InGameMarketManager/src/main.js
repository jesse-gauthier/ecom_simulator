import pkg from 'node-appwrite';

const { Client, Databases } = pkg;

export default async ({ req, res, context }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const config = {
    database: {
      inGameMarketCollection: process.env.INGAME_STOCK_COLLECTION,
      inGameMarketDatabase: process.env.INGAME_STOCK_DATABASE_ID,
    }
  };

  try {
    // Step 1 - Fetch Stocks
    const inGameStocks = await fetchStocks(config, client, context);
    console.log(inGameStocks);

    // TODO: Make this return meaningful data, like the stocks that were added or something similar
    return res.json({
      success: true,
      stocks: inGameStocks
    });
  } catch (err) {
    context.log(`Error fetching stocks: ${err}`);
    return res.json({
      success: false,
      error: err.message
    }, 500);
  }
};

// Function that fetches stocks
async function fetchStocks(config, client, context) {
  try {
    const databases = new Databases(client);

    const response = await databases.listDocuments(
      config.database.inGameMarketDatabase,
      config.database.inGameMarketCollection
    );

    return response.documents;
  } catch (error) {
    context.log(`Database error: ${error}`);
    throw error; // Re-throw to be caught by the main try/catch
  }
}

// Function placeholder for future implementation
// async function fetchDailyManipulator() {
//   // TODO: Implement
// }

// Function placeholder for applying manipulator to stocks
// async function applyManipulatorToStocks(stocks, manipulator) {
//   // TODO: Implement
// }

// Function placeholder for updating stocks
// async function updateStocks(updatedStocks) {
//   // TODO: Implement
// }