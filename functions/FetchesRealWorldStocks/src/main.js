import { Client, Users, Databases, ID, Query } from 'node-appwrite';

// Configuration
const CONFIG = {
  APPWRITE: {
    ENDPOINT: process.env.APPWRITE_FUNCTION_API_ENDPOINT,
    PROJECT_ID: process.env.APPWRITE_FUNCTION_PROJECT_ID,
  },
  DATABASE: {
    ID: process.env.STOCK_DATABASE_ID,
    COLLECTION_ID: process.env.STOCK_COLLECTION_ID,
  },
  ALPHA_VANTAGE: {
    API_KEY: process.env.STOCK_API_KEY,
    BASE_URL: 'https://www.alphavantage.co/query',
    TIMEOUT_MS: 10000, // 10 seconds
  },
  // List of popular ETFs to track
  POPULAR_ETFS: [
    { ticker: 'SPY', description: 'SPDR S&P 500 ETF Trust' },
    { ticker: 'QQQ', description: 'Invesco QQQ Trust (Nasdaq-100 Index)' },
    { ticker: 'IVV', description: 'iShares Core S&P 500 ETF' },
    { ticker: 'VTI', description: 'Vanguard Total Stock Market ETF' },
    { ticker: 'VOO', description: 'Vanguard S&P 500 ETF' },
    { ticker: 'GLD', description: 'SPDR Gold Shares' },
    { ticker: 'EFA', description: 'iShares MSCI EAFE ETF' },
    { ticker: 'VEA', description: 'Vanguard FTSE Developed Markets ETF' },
    { ticker: 'BND', description: 'Vanguard Total Bond Market ETF' },
    { ticker: 'VWO', description: 'Vanguard FTSE Emerging Markets ETF' },
    { ticker: 'XLF', description: 'Financial Select Sector SPDR Fund' },
    { ticker: 'XLK', description: 'Technology Select Sector SPDR Fund' },
    { ticker: 'ARKK', description: 'ARK Innovation ETF' },
    { ticker: 'LQD', description: 'iShares iBoxx $ Investment Grade Corporate Bond ETF' },
    { ticker: 'TLT', description: 'iShares 20+ Year Treasury Bond ETF' }
  ]
};

// Helper: Sleep function for delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize Appwrite client
const initClient = (key) => {
  return new Client()
    .setEndpoint(CONFIG.APPWRITE.ENDPOINT)
    .setProject(CONFIG.APPWRITE.PROJECT_ID)
    .setKey(key || '');
};

// Fetch ETF data for a specific symbol
const fetchETFData = async (symbol, log) => {
  const url = new URL(CONFIG.ALPHA_VANTAGE.BASE_URL);
  url.searchParams.append('function', 'GLOBAL_QUOTE');
  url.searchParams.append('symbol', symbol);
  url.searchParams.append('apikey', CONFIG.ALPHA_VANTAGE.API_KEY);
  
  log(`[INFO] Fetching data for ETF: ${symbol}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.ALPHA_VANTAGE.TIMEOUT_MS);
  
  try {
    const response = await fetch(url.toString(), { 
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AlphaVantage API error for ${symbol}: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // Validate data structure
    if (!data || !data['Global Quote']) {
      throw new Error(`Invalid data structure received from AlphaVantage for ${symbol}`);
    }
    
    return data['Global Quote'];
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`AlphaVantage API request for ${symbol} timed out after ${CONFIG.ALPHA_VANTAGE.TIMEOUT_MS}ms`);
    }
    throw error;
  }
};

// Fetch all popular ETFs data with rate limiting
const fetchAllPopularETFs = async (log) => {
  const results = [];
  const errors = [];
  
  // Process one ETF at a time to respect API rate limits
  for (const etf of CONFIG.POPULAR_ETFS) {
    try {
      // Add a delay to avoid hitting rate limits
      if (results.length > 0) {
        log(`[INFO] Waiting before next request to avoid rate limits...`);
        await sleep(1200); // 1.2 seconds between requests (AlphaVantage free tier limit is 5 requests per minute)
      }
      
      const quoteData = await fetchETFData(etf.ticker, log);
      
      // Transform the data
      results.push({
        ticker: etf.ticker,
        name: etf.description,
        price: quoteData['05. price'],
        change_amount: quoteData['09. change'],
        change_percentage: quoteData['10. change percent'],
        volume: quoteData['06. volume'],
        latest_trading_day: quoteData['07. latest trading day'],
        type: 'ETF',
        raw_data: JSON.stringify(quoteData)
      });
      
      log(`[INFO] Successfully fetched data for ${etf.ticker}`);
    } catch (error) {
      log(`[ERROR] Failed to fetch data for ${etf.ticker}: ${error.message}`);
      errors.push({ ticker: etf.ticker, error: error.message });
    }
  }
  
  return { results, errors };
};

// Process ETF data in batches
const processETFs = async (databases, etfs, log) => {
  const currentDate = new Date().toISOString();
  const results = { created: 0, updated: 0, failed: 0 };
  const batchSize = 5; // Process in smaller batches due to ETF data size

  for (let i = 0; i < etfs.length; i += batchSize) {
    const batch = etfs.slice(i, i + batchSize);
    await processBatch(databases, batch, currentDate, results, log);
    if (i + batchSize < etfs.length) {
      await sleep(100);
    }
  }

  return results;
};

const processBatch = async (databases, batch, currentDate, results, log) => {
  await Promise.all(batch.map(etf => processETF(databases, etf, currentDate, results, log)));
};

const processETF = async (databases, etf, currentDate, results, log) => {
  try {
    const documentData = createDocumentData(etf, currentDate);
    const existingDocs = await databases.listDocuments(
      CONFIG.DATABASE.ID,
      CONFIG.DATABASE.COLLECTION_ID,
      [Query.equal('ticker_symbol', etf.ticker)]
    );

    if (existingDocs.documents.length > 0) {
      const docId = existingDocs.documents[0].$id;
      await databases.updateDocument(
        CONFIG.DATABASE.ID,
        CONFIG.DATABASE.COLLECTION_ID,
        docId,
        documentData
      );
      log(`[INFO] Updated ETF: ${etf.ticker}`);
      results.updated++;
    } else {
      await databases.createDocument(
        CONFIG.DATABASE.ID,
        CONFIG.DATABASE.COLLECTION_ID,
        ID.unique(),
        documentData
      );
      log(`[INFO] Created new ETF: ${etf.ticker}`);
      results.created++;
    }
  } catch (error) {
    log(`[ERROR] Failed to process ETF ${etf.ticker}: ${error.message}`);
    results.failed++;
  }
};

const createDocumentData = (etf, currentDate) => {
  return {
    ticker_symbol: etf.ticker,
    etf_name: etf.name,
    category: etf.type || 'ETF',
    last_updated: currentDate,
    price: etf.price,
    change_amount: etf.change_amount,
    change_percentage: etf.change_percentage,
    volume: etf.volume,
    latest_trading_day: etf.latest_trading_day,
    raw_data: etf.raw_data
  };
};

// Main function
export default async ({ req, res, log, error }) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  try {
    // Validate required environment variables
    const requiredEnvVars = [
      'APPWRITE_FUNCTION_API_ENDPOINT',
      'APPWRITE_FUNCTION_PROJECT_ID',
      'STOCK_API_KEY',
      'STOCK_DATABASE_ID',
      'STOCK_COLLECTION_ID',
    ];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }
    
    const client = initClient(req.headers['x-appwrite-key']);
    const databases = new Databases(client);
    
    // Fetch popular ETF data
    log(`[INFO] Starting to fetch data for ${CONFIG.POPULAR_ETFS.length} popular ETFs`);
    const { results: etfs, errors } = await fetchAllPopularETFs(log);
    log(`[INFO] Found ${etfs.length} ETFs to process (${errors.length} failed to fetch)`);
    
    // Process ETFs
    const processResults = await processETFs(databases, etfs, log);
    
    // Return success response
    return res.json({
      success: true,
      message: `Successfully processed ${etfs.length} popular ETFs`,
      details: {
        total_attempted: CONFIG.POPULAR_ETFS.length,
        total_fetched: etfs.length,
        fetch_errors: errors.length,
        created: processResults.created,
        updated: processResults.updated,
        failed: processResults.failed,
      },
      fetch_errors: errors,
      timestamp,
      executionTime: `${Date.now() - startTime}ms`,
    });
  } catch (e) {
    // Log error with consistent format
    log(`[ERROR] ${e.message}`);
    error(e);
    
    // Return error response with appropriate status code
    let statusCode = 500;
    
    if (e.message.includes('AlphaVantage API error') && e.message.includes('429')) {
      statusCode = 429; // Rate limited
    } else if (e.message.includes('Missing required environment variable')) {
      statusCode = 400; // Bad request / configuration error
    }
    
    return res.json({
      success: false,
      error: e.message,
      timestamp,
      executionTime: `${Date.now() - startTime}ms`,
    }, statusCode);
  }
};