import pkg from 'node-appwrite';
const { Client, Databases } = pkg;
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
 * @param {Object} context - Function context with logging methods
 * @returns {Promise<void>}
 */
export default async ({ req, res, context }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  
  // Initialize the database with the configured client
  const databases = new Databases(client);
 
  const config = {
    setup: {
      "databaseId": process.env.APPWRITE_FUNCTION_DATABASE_ID,
      "realWorldCollection": process.env.APPWRITE_FUNCTION_REALWORLD_COLLECTION_ID,
      "inGameMarketCollection": process.env.APPWRITE_FUNCTION_MARKET_COLLECTION_ID,
      "manipulatorCollection": process.env.APPWRITE_FUNCTION_MANIPULATOR_COLLECTION_ID
    }
  }

  // Step 1: Fetch the real world stock market database
  const realWorldStockMarket = await fetchesRealWorldStockMarket(databases, config.setup, context);
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

  await updatesManipulatorCollection(databases, config.setup, marketManipulator, context);
  
  // Return success response
  return res.json({
    success: true,
    marketManipulator: marketManipulator
  });
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
  const minManipulator = 0.1; // Reduced from 5 to 0.1
  let manipulator = 0;
  
  // Convert averageChange to absolute value
  const absChange = Math.abs(averageChange);
  
  // Set thresholds for different levels of market change
  const normalThreshold = 2;  // 2% is considered normal
  const highThreshold = 5;    // 5% is considered significant
  const extremeThreshold = 10; // 10% is considered extreme
  
  // Calculate the market manipulation percentage with reduced scaling
  if (absChange <= normalThreshold) {
    // Within normal range - scale from minimum to 1.5%
    manipulator = minManipulator + ((absChange / normalThreshold) * (1.5 - minManipulator));
  } else if (absChange <= highThreshold) {
    // Above normal but below high threshold - scale from 1.5% to 3%
    manipulator = 1.5 + ((absChange - normalThreshold) / (highThreshold - normalThreshold)) * 1.5;
  } else if (absChange <= extremeThreshold) {
    // Between high and extreme threshold - scale from 3% to 5%
    manipulator = 3 + ((absChange - highThreshold) / (extremeThreshold - highThreshold)) * 2;
  } else {
    // Above extreme threshold - capped at 5% instead of 100%
    manipulator = 5;
  }
  
  return manipulator;
}
  
  // Round to 2 decimal places
  manipulator = Math.round(manipulator * 100) / 100;
  
  return manipulator;
}

/**
 * Fetches all documents from the real world stock market collection.
 * Retrieves current market data that will be used to calculate the market manipulator.
 * 
 * @param {Object} databases - The Appwrite Databases instance
 * @param {Object} config - Configuration object containing database and collection IDs
 * @param {Object} context - Function context with logging methods
 * @returns {Promise<Array>} - Array of stock market symbols with their data
 */
async function fetchesRealWorldStockMarket(databases, config, context) {
  try {
    const response = await databases.listDocuments(
      config.databaseId,
      config.realWorldCollection
    );
    return response.documents;
  } catch (err) {
    context.error(`Error fetching real world stock market database: ${err}`);
    return [];
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
 * @param {Object} databases - The Appwrite Databases instance
 * @param {Object} config - Configuration object containing database and collection IDs
 * @param {number} marketManipulator - The calculated market manipulator value
 * @param {Object} context - Function context with logging methods
 * @returns {Promise<boolean>} - True if the update was successful, false otherwise
 */
async function updatesManipulatorCollection(databases, config, marketManipulator, context) {
  try {
    // Format the manipulator as a string
    const manipulatorValue = marketManipulator.toString();
    // Get current date and time
    const updateTime = new Date().toISOString();
    
    // Query to check if a document already exists
    const existingDocuments = await databases.listDocuments(
      config.databaseId,
      config.manipulatorCollection
    );
    
    if (existingDocuments.documents.length > 0) {
      // Update existing document
      const docId = existingDocuments.documents[0].$id;
      await databases.updateDocument(
        config.databaseId,
        config.manipulatorCollection,
        docId,
        {
          manipulator: manipulatorValue,
          UpdateTime: updateTime
        }
      );
      context.log(`Manipulator document updated with value: ${manipulatorValue}`);
    } else {
      // Create new document if none exists
      await databases.createDocument(
        config.databaseId,
        config.manipulatorCollection,
        'unique()',
        {
          manipulator: manipulatorValue,
          UpdateTime: updateTime
        }
      );
      context.log(`New manipulator document created with value: ${manipulatorValue}`);
    }
    
    return true;
  } catch (err) {
    context.error(`Error updating manipulator collection: ${err.message}`);
    return false;
  }
}