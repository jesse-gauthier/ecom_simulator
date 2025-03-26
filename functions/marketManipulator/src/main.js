import { Client, databases } from 'node-appwrite';


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
  // Step 5: Update the in game market


};

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

//This function fetches all documents within the real world stock market collection
async function fetchesRealWorldStockMarket (config) {
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

// This function takes in each symbol and processes change amount vs price 
function extractsPriceChange (symbol) {
  const price = symbol.price
  const change_amount = symbol.change_amount 
  const change = price * change_amount
  return change
}

// This function will procces the prices changes as a whole
function calculatesAverage (symbols) {
  const average = 0
  for(const symbol of symbols) {
    const change = processesEachSymbol(symbol)
    average += change
  }
  average = average / symbols.length
  return average

}

function updatesManipulatorCollection() {
  // This function will accept the modifier as a parameter and update the manipulator collection
  // with the new value

  // Collection attributes 
  // manipulator: String
  // UpdateTime: Date
}