import pkg from 'node-appwrite';

const { Client, Databases, ID } = pkg;

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
  }

  // Step 1 - Fetch Stocks
  const inGameStocks = await fetchStocks(config, client, context)

  console.log(inGameStocks)


  // TODO: Make this return meaningful data, like the stocks that were added or something similar
  // For now, we'll just return an empty response
  return res.json({

  });
};


// Function that fetches stocks
async function fetchStocks(config, client) {
  const databases = new Databases(client);
  const inGameStocks = {}

  let promise = databases.listDocuments(
    config.inGameMarketDatabase,
    config.inGameMarketCollection,
  );

  promise.then(function (response) {
    return response
  }, function (error) {
    context.log(error);
  });

}


// Function that fetches dailymanipulator
// Function that loops through each fetched stock and applies the dailymanipulator
// Function that updates each stock in the database collection.
// Function to handle errors
