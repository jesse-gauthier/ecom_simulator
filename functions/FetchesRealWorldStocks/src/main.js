import { Client, Users, Databases, ID, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  // Initialize Appwrite client
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const apiKey = process.env.STOCK_API_KEY
  const databaseId = process.env.STOCK_DATABASE_ID
  const collectionId = process.env.STOCK_COLLECTION_ID

  try {
    // Initialize Databases SDK
    const databases = new Databases(client);
    
    // Fetch most active ETFs from AlphaVantage
    const url = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${apiKey}`;
    log.info(`Fetching ETF data from: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`AlphaVantage API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    const etfs = data.most_actively_traded.filter(item => item.type === 'ETF');
    
    log.info(`Found ${etfs.length} ETFs to process`);
    
    // Update collection with ETF data
    const currentDate = new Date().toISOString();
    
    for (const etf of etfs) {
      // Extract relevant data
      const documentData = {
        ticker_symbol: etf.ticker,
        etf_name: etf.name,
        category: etf.type, 
        last_updated: currentDate
      };
      
      // Check if ETF already exists in database
      const existingDocs = await databases.listDocuments(
        databaseId,
        collectionId,
        [Query.equal('ticker_symbol', etf.ticker)]
      );
      
      if (existingDocs.documents.length > 0) {
        // Update existing document
        const docId = existingDocs.documents[0].$id;
        await databases.updateDocument(
          databaseId,
          collectionId,
          docId,
          documentData
        );
        log.info(`Updated ETF: ${etf.ticker}`);
      } else {
        // Create new document
        await databases.createDocument(
          databaseId,
          collectionId,
          ID.unique(),
          documentData
        );
        log.info(`Created new ETF: ${etf.ticker}`);
      }
    }
    
    return res.json({
      success: true,
      message: `Successfully processed ${etfs.length} ETFs`,
      timestamp: currentDate
    });
    
  } catch (e) {
    log.info(`ERROR: Error processing ETFs: ${e.message}`);
    return res.json({
      success: false,
      error: e.message
    }, 500);
  }
};
