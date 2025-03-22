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

// Fetch ETF data from AlphaVantage
const fetchETFData = async (log) => {
  const url = new URL(CONFIG.ALPHA_VANTAGE.BASE_URL);
  url.searchParams.append('function', 'TOP_GAINERS_LOSERS');
  url.searchParams.append('apikey', CONFIG.ALPHA_VANTAGE.API_KEY);
  
  log(`[INFO] Fetching ETF data`);
  
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
      throw new Error(`AlphaVantage API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // Validate data structure
    if (!data || !Array.isArray(data.most_actively_traded)) {
      throw new Error('Invalid data structure received from AlphaVantage');
    }
    
    return data.most_actively_traded.filter(item => item.type === 'ETF');
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`AlphaVantage API request timed out after ${CONFIG.ALPHA_VANTAGE.TIMEOUT_MS}ms`);
    }
    throw error;
  }
};

// Process ETF data in batches
const processETFs = async (databases, etfs, log) => {
  const currentDate = new Date().toISOString();
  const results = { created: 0, updated: 0, failed: 0 };
  const batchSize = 10; // Process in batches of 10
  
  for (let i = 0; i < etfs.length; i += batchSize) {
    const batch = etfs.slice(i, i + batchSize);
    
    // Process batch in parallel
    await Promise.all(batch.map(async (etf) => {
      try {
        // Create document data with proper parsing
        const documentData = {
          ticker_symbol: etf.ticker,
          etf_name: etf.name,
          category: etf.type || 'ETF',
          last_updated: currentDate,
          price: parseFloat(etf.price) || 0,
          change_amount: parseFloat(etf.change_amount) || 0,
          change_percentage: parseFloat(etf.change_percentage?.replace('%', '')) || 0,
          volume: parseInt(etf.volume?.replace(/,/g, ''), 10) || 0,
          raw_data: JSON.stringify(etf), // Store raw data for reference
        };
        
        // Check if ETF already exists
        const existingDocs = await databases.listDocuments(
          CONFIG.DATABASE.ID,
          CONFIG.DATABASE.COLLECTION_ID,
          [Query.equal('ticker_symbol', etf.ticker)]
        );
        
        if (existingDocs.documents.length > 0) {
          // Update existing document
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
          // Create new document
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
    }));
    
    // Small delay between batches to prevent overwhelming the database
    if (i + batchSize < etfs.length) {
      await sleep(100);
    }
  }
  
  return results;
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
    
    // Fetch ETF data
    const etfs = await fetchETFData(log);
    log(`[INFO] Found ${etfs.length} ETFs to process`);
    
    // Process ETFs
    const results = await processETFs(databases, etfs, log);
    
    // Return success response
    return res.json({
      success: true,
      message: `Successfully processed ${etfs.length} ETFs`,
      details: {
        total: etfs.length,
        created: results.created,
        updated: results.updated,
        failed: results.failed,
      },
      timestamp,
      executionTime: `${Date.now() - startTime}ms`,
    });
  } catch (e) {
    // Log error with consistent format
    log(`[ERROR] ${e.message}`);
    error(e);
    
    // Return error response with appropriate status code
    let statusCode = 500;
    
    if (e.message.includes('AlphaVantage API error: 429')) {
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