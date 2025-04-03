import pkg from 'node-appwrite';
const { Client, Databases } = pkg;

/**
 * Main function that orchestrates the market manipulation process.
 * This function:
 * 1. Initializes the Appwrite client
 * 2. Fetches real-world stock market data
 * 3. Processes price changes and calculates the average market change
 * 4. Determines the market manipulation factor
 * 5. Updates the database with the new manipulator value
 * 
 * Database structure: 
 * manipulator: String
 * UpdateTime: datetime
 * 
 * @param {Object} req - The HTTP request object
 * @param {Object} res - The HTTP response object
 * @param {Object} context - Function context with logging methods
 * @returns {Promise<void>}
 */
export default async ({ req, res, context }) => {
  try {
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
    };

    // Step 1: Fetch the real world stock market database
    try {
      const realWorldStockMarket = await fetchRealWorldStockMarket(databases, config.setup, context);
      if (!realWorldStockMarket.length) {
        throw new Error("No stock market data available");
      }
    } catch (error) {
      context.error(`Error fetching real world stock market data: ${error.message}`);
      return res.json({
        success: false,
        error: `Error fetching real world stock market data: ${error.message}`
      }, 500);
    }


    // Step 2: Calculate the average change directly from real world data

    try {
      const average = calculateAverageChange(realWorldStockMarket, context);
    } catch (error) {
      context.error(`Error calculating average change: ${error.message}`);
      return res.json({
        success: false,
        error: `Error calculating average change: ${error.message}`
      }, 500);
    }

    // Step 3: Configure the in-game market manipulation
    try {
      const marketManipulator = calculateMarketManipulator(average);
    } catch (error) {
      context.error(`Error calculating market manipulator: ${error.message}`);
      return res.json({
        success: false,
        error: `Error calculating market manipulator: ${error.message}`
      }, 500);
    }
    // Step 4: Update the manipulator collection
    try {
      await updateManipulatorCollection(databases, config.setup, marketManipulator, context);
    } catch (error) {
      context.error(`Error updating manipulator collection: ${error.message}`);
      return res.json({
        success: false,
        error: `Error updating manipulator collection: ${error.message}`
      }, 500);
    }

  } catch (error) {
    // Check if context exists before calling error method
    if (context && typeof context.error === 'function') {
      context.error(`Market manipulation process failed: ${error.message}`);
    } else {
      console.error(`Market manipulation process failed: ${error.message}`);
    }

    return res.json({
      success: false,
      error: error.message
    }, 500);
  }
};

/**
 * Calculates the market manipulation percentage based on average market change.
 * Uses a tiered approach with different thresholds to determine manipulation levels.
 * 
 * @param {number} averageChange - The average market change percentage
 * @returns {number} - The calculated market manipulator value (0.1-5%)
 */
function calculateMarketManipulator(averageChange) {
  // Minimum manipulator value to reflect that markets always change
  const minManipulator = 0.1;
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
    // Above extreme threshold - capped at 5%
    manipulator = 5;
  }

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
async function fetchRealWorldStockMarket(databases, config, context) {
  try {
    const response = await databases.listDocuments(
      config.databaseId,
      config.realWorldCollection
    );
    return response.documents;
  } catch (err) {
    if (context && typeof context.error === 'function') {
      context.error(`Error fetching real world stock market database: ${err}`);
    } else {
      console.error(`Error fetching real world stock market database: ${err}`);
    }
    return [];
  }
}

/**
 * Calculates the average price change across all provided symbols.
 * Validates data before processing and extracts price changes in a single pass.
 * 
 * @param {Array<Object>} symbols - Array of stock symbol objects
 * @param {Object} context - Function context with logging methods
 * @returns {number} - The average change across all valid symbols
 */
function calculateAverageChange(symbols, context) {
  let totalChange = 0;
  let validSymbols = 0;

  for (const symbol of symbols) {
    // Validate the data - checking for the correct field names in the ETF data
    if (symbol && typeof symbol.price === 'string' && typeof symbol.change_percentage === 'string') {
      try {
        // Convert string values to numbers and handle percentage format
        const price = parseFloat(symbol.price);
        // Extract numeric value from percentage string (e.g., "-1.9929%" → -1.9929)
        const changePercentage = parseFloat(symbol.change_percentage.replace('%', ''));

        if (!isNaN(price) && !isNaN(changePercentage)) {
          totalChange += changePercentage;
          validSymbols++;
        } else {
          throw new Error("Invalid numeric conversion");
        }
      } catch (err) {
        if (context && typeof context.warn === 'function') {
          context.warn(`Error processing symbol data: ${JSON.stringify(symbol)}`);
        } else {
          console.warn(`Error processing symbol data: ${JSON.stringify(symbol)}`);
        }
      }
    } else {
      if (context && typeof context.warn === 'function') {
        context.warn(`Skipping invalid symbol data: ${JSON.stringify(symbol)}`);
      } else {
        console.warn(`Skipping invalid symbol data: ${JSON.stringify(symbol)}`);
      }
    }
  }

  if (validSymbols === 0) {
    if (context && typeof context.error === 'function') {
      context.error("No valid symbols found for calculation");
    } else {
      console.error("No valid symbols found for calculation");
    }
    return 0;
  }

  return totalChange / validSymbols;
}

/**
 * Updates or creates a document in the manipulator collection with the new value.
 * If a document already exists, it updates it; otherwise, it creates a new one.
 * 
 * @param {Object} databases - The Appwrite Databases instance
 * @param {Object} config - Configuration object containing database and collection IDs
 * @param {number} marketManipulator - The calculated market manipulator value
 * @param {Object} context - Function context with logging methods
 * @returns {Promise<boolean>} - True if the update was successful, false otherwise
 */
async function updateManipulatorCollection(databases, config, marketManipulator, context) {
  try {
    // Format the manipulator as a number with 2 decimal precision
    const manipulatorValue = Number(marketManipulator.toFixed(2));
    // Get current date and time
    const timestamp = new Date().toISOString();

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
          manipulator: manipulatorValue.toString(),
          UpdateTime: timestamp
        }
      );
      if (context && typeof context.log === 'function') {
        context.log(`Manipulator document updated with value: ${manipulatorValue}`);
      } else {
        context.log(`Manipulator document updated with value: ${manipulatorValue}`);
      }
    } else {
      // Create new document if none exists
      await databases.createDocument(
        config.databaseId,
        config.manipulatorCollection,
        'unique()',
        {
          manipulator: manipulatorValue,
          last_updated: timestamp  // Using last_updated instead of updateTime
        }
      );
      if (context && typeof context.log === 'function') {
        context.log(`New manipulator document created with value: ${manipulatorValue}`);
      } else {
        context.log(`New manipulator document created with value: ${manipulatorValue}`);
      }
    }

    return true;
  } catch (err) {
    if (context && typeof context.error === 'function') {
      context.error(`Error updating manipulator collection: ${err.message}`);
    } else {
      context.error(`Error updating manipulator collection: ${err.message}`);
    }
    throw err;
  }
}