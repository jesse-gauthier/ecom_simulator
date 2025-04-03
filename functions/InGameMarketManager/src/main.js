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

  const inGameStocks = [
    { ticker_symbol: "APPX", stock_name: "Appleton Technologies", category: "Technology", price: "342.87" },
    { ticker_symbol: "NFLZ", stock_name: "NetFlixion Entertainment", category: "Entertainment", price: "498.32" },
    { ticker_symbol: "GOOGZ", stock_name: "Googolplex Search", category: "Technology", price: "1521.64" },
    { ticker_symbol: "AMZQ", stock_name: "Amazonia Global", category: "E-commerce", price: "3256.91" },
    { ticker_symbol: "TSLY", stock_name: "Teslarc Motors", category: "Automotive", price: "784.35" },
    { ticker_symbol: "MSFX", stock_name: "MicroSoft Frontier", category: "Technology", price: "289.76" },
    { ticker_symbol: "FBXK", stock_name: "FaceBook Nexus", category: "Social Media", price: "267.89" },
    { ticker_symbol: "ABNB", stock_name: "AirBnB Lodging", category: "Hospitality", price: "156.23" },
    { ticker_symbol: "INTC", stock_name: "Intellicorp Chips", category: "Semiconductor", price: "53.42" },
    { ticker_symbol: "NVDX", stock_name: "NeoVideo Graphics", category: "Semiconductor", price: "875.64" },
    { ticker_symbol: "AMDQ", stock_name: "Advanced Micro Devices Quest", category: "Semiconductor", price: "132.87" },
    { ticker_symbol: "CSCZ", stock_name: "CiscoTech Networks", category: "Technology", price: "64.19" },
    { ticker_symbol: "JPMZ", stock_name: "JP Morgan Zenith", category: "Finance", price: "153.76" },
    { ticker_symbol: "WFCX", stock_name: "Wells Fargo Capital", category: "Finance", price: "45.32" },
    { ticker_symbol: "BACZ", stock_name: "Bank of America Centrix", category: "Finance", price: "37.89" },
    { ticker_symbol: "DISY", stock_name: "Disneyland Entertainment", category: "Entertainment", price: "187.65" },
    { ticker_symbol: "SBUX", stock_name: "Starbeans Coffee", category: "Food & Beverage", price: "89.43" },
    { ticker_symbol: "MCDY", stock_name: "McDowell's Restaurants", category: "Food & Beverage", price: "267.54" },
    { ticker_symbol: "KOXY", stock_name: "Kola Extreme Beverages", category: "Food & Beverage", price: "58.29" },
    { ticker_symbol: "NIKZ", stock_name: "Niketown Athletics", category: "Apparel", price: "124.35" },
    { ticker_symbol: "ADDY", stock_name: "Adimax Sportswear", category: "Apparel", price: "176.87" },
    { ticker_symbol: "UAZY", stock_name: "Under Armor Zone", category: "Apparel", price: "87.65" },
    { ticker_symbol: "LVMX", stock_name: "Louis Vuitton Matrix", category: "Luxury", price: "456.78" },
    { ticker_symbol: "PFZY", stock_name: "Pfizer Zenith Pharma", category: "Pharmaceutical", price: "42.63" },
    { ticker_symbol: "JNJX", stock_name: "Johnson & Johnson Xcel", category: "Healthcare", price: "167.54" },
    { ticker_symbol: "MRNY", stock_name: "Modern RNA Therapeutics", category: "Biotechnology", price: "187.65" },
    { ticker_symbol: "BNTX", stock_name: "BioNTech Solutions", category: "Biotechnology", price: "132.43" },
    { ticker_symbol: "FZRX", stock_name: "Fazor Pharmaceuticals", category: "Pharmaceutical", price: "78.32" },
    { ticker_symbol: "GMEX", stock_name: "GameXperience", category: "Gaming", price: "312.56" },
    { ticker_symbol: "EAYZ", stock_name: "Electronic Arts Yotta", category: "Gaming", price: "142.87" },
    { ticker_symbol: "ATVY", stock_name: "Activizzle Games", category: "Gaming", price: "89.43" },
    { ticker_symbol: "FORCX", stock_name: "Ford Cortex Automobiles", category: "Automotive", price: "15.67" },
    { ticker_symbol: "GMYC", stock_name: "General Motors Yukon", category: "Automotive", price: "42.38" },
    { ticker_symbol: "HNDY", stock_name: "Honda Yaris Motors", category: "Automotive", price: "35.76" },
    { ticker_symbol: "BOIZ", stock_name: "Boeing Infinity Aerospace", category: "Aviation", price: "178.92" },
    { ticker_symbol: "ARBZ", stock_name: "Airbus Zenithal", category: "Aviation", price: "67.89" },
    { ticker_symbol: "LTFX", stock_name: "Lufthansa Flight X", category: "Aviation", price: "43.21" },
    { ticker_symbol: "EXNY", stock_name: "Exxon Nova Energy", category: "Energy", price: "87.65" },
    { ticker_symbol: "CVXY", stock_name: "Chevron Xylem Oil", category: "Energy", price: "132.45" },
    { ticker_symbol: "BPXZ", stock_name: "British Petroleum Xeon", category: "Energy", price: "45.67" },
    { ticker_symbol: "SLRX", stock_name: "Solar X Dynamics", category: "Renewable Energy", price: "78.32" },
    { ticker_symbol: "WNDZ", stock_name: "WindZone Power", category: "Renewable Energy", price: "54.32" },
    { ticker_symbol: "HYDRX", stock_name: "Hydro X Energy", category: "Renewable Energy", price: "34.56" },
    { ticker_symbol: "TVRZ", stock_name: "Turner Vision Networks", category: "Media", price: "67.89" },
    { ticker_symbol: "VIACX", stock_name: "Viacom Xperience", category: "Media", price: "43.21" },
    { ticker_symbol: "FOXZ", stock_name: "Fox Zenith Media", category: "Media", price: "35.67" },
    { ticker_symbol: "ABCDY", stock_name: "ABConstructionDynamics", category: "Construction", price: "76.54" },
    { ticker_symbol: "HOMDY", stock_name: "Home Depot Yard", category: "Home Improvement", price: "321.54" },
    { ticker_symbol: "LOWX", stock_name: "Lowe's Xpress", category: "Home Improvement", price: "178.92" },
    { ticker_symbol: "WLMTY", stock_name: "Walmart Titan Retail", category: "Retail", price: "142.35" }
  ];



  try {
    await addInGameStocks(inGameStocks, config, client, context);
  } catch (err) {
    context.log('Error adding in-game stocks:', err.message);
  }

  // TODO: Make this return meaningful data, like the stocks that were added or something similar
  // For now, we'll just return an empty response
  return res.json({});
};

// This function will be used to create the in game stock market into the database, will be retired after the first run
// will replace with a function that allows adding new stocks, without duplicating.

async function addInGameStocks(inGameStocks, config, client, context) {

  const databases = new Databases(client);
  const collectionId = config.database.inGameMarketCollection;
  const databaseId = config.database.inGameMarketDatabase;

  try {
    for (const stock of inGameStocks) {
      await databases.createDocument(databaseId, collectionId, ID.unique(), stock);
      context.log('stock added:', stock);
    }
    context.log('In-game stocks added successfully!');
  } catch (err) {
    context.error('Error adding in-game stocks:', err.message);
  }
}