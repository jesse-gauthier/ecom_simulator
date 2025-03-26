import { Client, databases } from 'node-appwrite';

/**
 * Main function that orchestrates the market manipulation process.
 * This function:
 * 1. Initializes the Appwrite client
 * 2. Fetches real-world stock market data
 * 3. Processes price changes from the market data
 * 4. Calculates the average market change
 * 5. Determines the market manipulation factor
 * 6. Updates the database with the new manipulator value
 * 
 * @param {Object} req - The HTTP request object
 * @param {Object} res - The HTTP response object
 * @param {Function} log - Function for logging messages
 * @param {Function} error - Function for logging errors
 * @returns {Promise<void>}
 */
export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
 
 
    const config = {
    setup: {
      "databaseId": process.env.APPWRITE_FUNCTION_DATABASE_ID,
      "realWorldCollection": process.env.APPWRITE_FUNCTION_REALWORLD_COLLECTION_ID,
      "inGameMarketCollection": process.env.APPWRITE_FUNCTION_MARKET_COLLECTION_ID,
      "manipulatorCollection": process.env.APPWRITE_FUNCTION_MANIPULATOR_COLLECTION_ID
    }
  }

  // Step 1: Fetch the real world stock market database
  const realWorldStockMarket = await fetchesRealWorldStockMarket(config.setup);
  const averageChange = []

  // Step 2: Process the real world stock market database
  for (const symbol of realWorldStockMarket) {
    // Extracts the price difference for each symbol
    const change = extractsPriceChange(symbol)
    // Adds each change difference to the average change array
    averageChange.push(change)
  }
  // Step 3: Calculate the TOTAL average change
  const average = calculatesAverage(averageChange)

  // Step 4: Configure the in game market manipulation
  const marketManipulator = marketManipulatorCalculator(average)
  // Step 5: Update the manipulator collection


  await updatesManipulatorCollection(marketManipulator)

};

/**
 * Calculates the market manipulation percentage based on average market change.
 * Uses a tiered approach with different thresholds to determine manipulation levels:
 * - Normal range (0-2%): Scales from minimum to 20%
 * - High range (2-5%): Scales from 20% to 60%
 * - Extreme range (5-10%): Scales from 60% to 100%
 * - Above 10%: Fixed at 100%
 * 
 * @param {number} averageChange - The average market change percentage
 * @returns {number} - The calculated market manipulator value (5-100%)
 */
function marketManipulatorCalculator(averageChange) {
  // Minimum manipulator value to reflect that markets always change
  const minManipulator = 5; 
  let manipulator = 0;
  
  // Convert averageChange to absolute value
  const absChange = Math.abs(averageChange);
  
  // Set thresholds for different levels of market change
  const normalThreshold = 2;  // 2% is considered normal
  const highThreshold = 5;    // 5% is considered significant
  const extremeThreshold = 10; // 10% is considered extreme
  
  // Calculate the market manipulation percentage
  if (absChange <= normalThreshold) {
    // Within normal range - scale from minimum to 20%
    manipulator = minManipulator + ((absChange / normalThreshold) * (20 - minManipulator));
  } else if (absChange <= highThreshold) {
    // Above normal but below high threshold - scale from 20% to 60%
    manipulator = 20 + ((absChange - normalThreshold) / (highThreshold - normalThreshold)) * 40;
  } else if (absChange <= extremeThreshold) {
    // Between high and extreme threshold - scale from 60% to 100%
    manipulator = 60 + ((absChange - highThreshold) / (extremeThreshold - highThreshold)) * 40;
  } else {
    // Above extreme threshold
    manipulator = 100;
  }
  
  // Round to 2 decimal places
  manipulator = Math.round(manipulator * 100) / 100;
  
  return manipulator;
}

/**
 * Fetches all documents from the real world stock market collection.
 * Retrieves current market data that will be used to calculate the market manipulator.
 * 
 * @param {Object} config - Configuration object containing database and collection IDs
 * @param {string} config.databaseId - The ID of the database
 * @param {string} config.realWorldCollection - The ID of the collection containing real world market data
 * @returns {Promise<Array>} - Array of stock market symbols with their data
 */
async function fetchesRealWorldStockMarket(config) {
  try {
    const realWorldStockMarket = await databases.listDocuments(
      config.databaseId,
      config.realWorldCollection
    );
    return realWorldStockMarket;
  } catch (error) {
    log(`Error fetching real world stock market database: ${error}`)
  }
}

/**
 * Processes price change data for an individual stock symbol.
 * Calculates the absolute change amount by multiplying the price by the change percentage.
 * 
 * @param {Object} symbol - The stock symbol object
 * @param {number} symbol.price - The current price of the stock
 * @param {number} symbol.change_amount - The change percentage as a decimal
 * @returns {number} - The calculated change value
 */
function extractsPriceChange(symbol) {
  const price = symbol.price
  const change_amount = symbol.change_amount 
  const change = price * change_amount
  return change
}

/**
 * Calculates the average price change across all provided symbols.
 * Sums all the changes and divides by the number of symbols to get the average.
 * 
 * @param {Array<number>} symbols - Array of price change values
 * @returns {number} - The average change across all symbols
 */
function calculatesAverage(symbols) {
  let average = 0
  for(const symbol of symbols) {
    average += symbol
  }
  average = average / symbols.length
  return average
}

/**
 * Updates or creates a document in the manipulator collection with the new value.
 * If a document already exists, it updates it; otherwise, it creates a new one.
 * Also records the timestamp of the update.
 * 
 * @param {number} marketManipulator - The calculated market manipulator value
 * @returns {Promise<boolean>} - True if the update was successful, false otherwise
 */
async function updatesManipulatorCollection(marketManipulator) {
  try {
    // Format the manipulator as a string
    const manipulatorValue = marketManipulator.toString();
    // Get current date and time
    const updateTime = new Date().toISOString();
    
    // Query to check if a document already exists
    const existingDocuments = await databases.listDocuments(
      config.setup.databaseId,
      config.setup.manipulatorCollection
    );
    
    if (existingDocuments.documents.length > 0) {
      // Update existing document
      const docId = existingDocuments.documents[0].$id;
      await databases.updateDocument(
        config.setup.databaseId,
        config.setup.manipulatorCollection,
        docId,
        {
          manipulator: manipulatorValue,
          UpdateTime: updateTime
        }
      );
      log(`Manipulator document updated with value: ${manipulatorValue}`);
    } else {
      // Create new document if none exists
      await databases.createDocument(
        config.setup.databaseId,
        config.setup.manipulatorCollection,
        'unique()',
        {
          manipulator: manipulatorValue,
          UpdateTime: updateTime
        }
      );
      log(`New manipulator document created with value: ${manipulatorValue}`);
    }
    
    return true;
  } catch (error) {
    log(`Error updating manipulator collection: ${error.message}`);
    return false;
  }
}