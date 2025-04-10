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
      dailyManipulatorCollection: process.env.DAILY_MANIPULATOR_COLLECTION
    }
  };

  try {
    // Step 1 - Fetch Stocks
    const inGameStocks = await fetchStocks(config, client, context);
    // Step 2 - fetchDailyManipulator
    const dailyManipulator = await fetchDailyManipulator(config, client, context)
    // Step 3 - applyManipulatorToStocks
    const manipulatedStocks = applyManipulatorToStocks(inGameStocks, dailyManipulator, context)
    // Step 4 - Update stocks in database
    const updateResults = await updateStocks(manipulatedStocks, config, client, context)

    return res.json({
      success: true,
      stocks: manipulatedStocks,
      updateResults: updateResults
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

async function fetchDailyManipulator(config, client, context) {
  try {
    const databases = new Databases(client);

    const response = await databases.listDocuments(
      config.database.inGameMarketDatabase,
      config.database.dailyManipulatorCollection
    );
    return response.documents.manipulator;
  } catch (error) {
    context.log(`Database error: ${error}`);
    throw error;
  }
}

function applyManipulatorToStocks(stocks, manipulator) {
  if (!Array.isArray(stocks) || typeof manipulator !== 'number') {
    throw new Error('Invalid input: stocks must be an array and manipulator must be a number');
  }

  return stocks.map(stock => {
    if (!stock.price || typeof stock.price !== 'number') {
      return stock; // Skip invalid stocks
    }

    const changeAmount = (stock.price * (manipulator / 100));

    return {
      ...stock,
      price: Number((stock.price + changeAmount).toFixed(2)),
      last_change: Number(manipulator.toFixed(2))
    };
  });
}

async function updateStocks(updatedStocks, config, client, context) {
  try {
    const databases = new Databases(client);
    const results = [];

    for (const stock of updatedStocks) {
      try {
        const response = await databases.updateDocument(
          config.database.inGameMarketDatabase,
          config.database.inGameMarketCollection,
          stock.$id,
          {
            price: stock.price.toString(),
            change_amount: stock.last_change.toString(),
            last_updated: new Date().toISOString()
          }
        );
        results.push({ id: stock.$id, success: true });
      } catch (stockError) {
        context?.log(`Failed to update stock ${stock.$id}: ${stockError.message}`);
        results.push({ id: stock.$id, success: false, error: stockError.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    context?.log(`Updated ${successCount} of ${updatedStocks.length} stocks`);

    return {
      success: successCount > 0,
      results: results
    };
  } catch (error) {
    context?.error(`Failed to update stocks: ${error.message}`);
    throw error;
  }
}