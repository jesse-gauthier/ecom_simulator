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
  // Add fallback logging methods if context is undefined
  const logger = {
    log: (msg) => context?.log?.(msg) ?? console.log(msg),
    error: (msg) => context?.error?.(msg) ?? console.error(msg),
    warn: (msg) => context?.warn?.(msg) ?? console.warn(msg)
  };

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
    const realWorldStockMarket = await fetchRealWorldStockMarket(databases, config.setup, logger);
    if (!realWorldStockMarket.length) {
      throw new Error("No stock market data available");
    }

    // Step 2: Calculate the average change directly from real world data
    const average = calculateAverageChange(realWorldStockMarket, logger);

    // Step 3: Configure the in-game market manipulation
    const marketManipulator = calculateMarketManipulator(average, logger);

    // Step 4: Update the manipulator collection
    await updateManipulatorCollection(databases, config.setup, marketManipulator, logger);

    // Log success
    logger.log(`Market manipulation process completed successfully. Manipulator: ${marketManipulator.toFixed(2)}, Average change: ${average.toFixed(2)}`);

    // Return success response
    return res.json({
      success: true,
      manipulator: Number(marketManipulator.toFixed(2)),
      average_change: Number(average.toFixed(2))
    }, 200);

  } catch (error) {
    // Use the logger instead of context directly
    logger.error(`Market manipulation process failed: ${error.message}`);

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
function calculateMarketManipulator(averageChange, logger) {
  // Minimum manipulator value to reflect that markets always change
  const minManipulator = 0.1;
  let manipulator = 0;

  // Store the sign before converting to absolute value
  const sign = Math.sign(averageChange);
  const absChange = Math.abs(averageChange);

  // Set thresholds for different levels of market change
  const normalThreshold = 2;  // 2% is considered normal
  const highThreshold = 5;    // 5% is considered significant
  const extremeThreshold = 10; // 10% is considered extreme

  // Calculate the market manipulation percentage with reduced scaling
  if (absChange <= normalThreshold) {
    manipulator = minManipulator + ((absChange / normalThreshold) * (1.5 - minManipulator));
  } else if (absChange <= highThreshold) {
    manipulator = 1.5 + ((absChange - normalThreshold) / (highThreshold - normalThreshold)) * 1.5;
  } else if (absChange <= extremeThreshold) {
    manipulator = 3 + ((absChange - highThreshold) / (extremeThreshold - highThreshold)) * 2;
  } else {
    manipulator = 5;
  }

  // Apply the original sign to the manipulator value
  return manipulator * sign;
}

/**
 * Fetches all documents from the real world stock market collection.
 * Retrieves current market data that will be used to calculate the market manipulator.
 * 
 * @param {Object} databases - The Appwrite Databases instance
 * @param {Object} config - Configuration object containing database and collection IDs
 * @param {Object} logger - Logger object with logging methods
 * @returns {Promise<Array>} - Array of stock market symbols with their data
 */
async function fetchRealWorldStockMarket(databases, config, logger) {
  try {
    const response = await databases.listDocuments(
      config.databaseId,
      config.realWorldCollection
    );
    logger.log(`Successfully fetched ${response.documents.length} stock market records`);
    return response.documents;
  } catch (err) {
    logger.error(`Error fetching real world stock market database: ${err}`);
    throw err; // Re-throw to be caught by main try-catch
  }
}

/**
 * Calculates the average price change across all provided symbols.
 * Validates data before processing and extracts price changes in a single pass.
 * 
 * @param {Array<Object>} symbols - Array of stock symbol objects
 * @param {Object} logger - Logger object with logging methods
 * @returns {number} - The average change across all valid symbols
 */
function calculateAverageChange(symbols, logger) {
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
        logger.warn(`Error processing symbol data: ${JSON.stringify(symbol)}`);
      }
    } else {
      logger.warn(`Skipping invalid symbol data: ${JSON.stringify(symbol)}`);
    }
  }

  if (validSymbols === 0) {
    logger.error("No valid symbols found for calculation");
    throw new Error("No valid symbols found for calculation");
  }

  const average = totalChange / validSymbols;
  logger.log(`Calculated average change: ${average.toFixed(2)}% from ${validSymbols} valid symbols`);
  return average;
}

/**
 * Updates or creates a document in the manipulator collection with the new value.
 * If a document already exists, it updates it; otherwise, it creates a new one.
 * 
 * @param {Object} databases - The Appwrite Databases instance
 * @param {Object} config - Configuration object containing database and collection IDs
 * @param {number} marketManipulator - The calculated market manipulator value
 * @param {Object} logger - Logger object with logging methods
 * @returns {Promise<boolean>} - True if the update was successful, false otherwise
 */
async function updateManipulatorCollection(databases, config, marketManipulator, logger) {
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
      logger.log(`Manipulator document updated with value: ${manipulatorValue}`);
    } else {
      // Create new document if none exists
      await databases.createDocument(
        config.databaseId,
        config.manipulatorCollection,
        'unique()',
        {
          manipulator: manipulatorValue.toString(),
          UpdateTime: timestamp
        }
      );
      logger.log(`New manipulator document created with value: ${manipulatorValue}`);
    }

    return true;
  } catch (err) {
    logger.error(`Error updating manipulator collection: ${err.message}`);
    throw err;
  }
}