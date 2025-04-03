import pkg from 'node-appwrite';
const { Client, Databases, Functions, Storage, Users } = pkg;

/**
 * Appwrite Cloud Function
 * 
 * This function serves as a template for creating Appwrite cloud functions.
 * Modify the code below to implement your specific functionality.
 * 
 * @param {Object} req - The HTTP request object
 * @param {Object} res - The HTTP response object
 * @param {Object} context - Function context with logging methods
 * @returns {Promise<void>}
 */
export default async ({ req, res, context }) => {
  // Log the function execution start
  context.log('Executing Appwrite Cloud Function');

  try {
    // Initialize the Appwrite client
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_FUNCTION_API_KEY || req.headers['x-appwrite-key'] || '');

    // Initialize Appwrite services
    const databases = new Databases(client);
    const functions = new Functions(client);
    const storage = new Storage(client);
    const users = new Users(client);

    // Get request data (if any)
    const requestData = req.body || {};

    // TODO: Add your function logic here
    // Example: Fetch data from a database
    // const data = await databases.listDocuments('databaseId', 'collectionId');

    // Log progress
    context.log('Function processing completed successfully');

    // Return a response
    return res.json({
      success: true,
      message: 'Function executed successfully',
      data: {
        // Add your response data here
        timestamp: new Date().toISOString()
      }
    }, 200);

  } catch (error) {
    // Log any errors
    context.error(`Function execution failed: ${error.message}`);
    context.error(error.stack);

    // Return an error response
    return res.json({
      success: false,
      message: 'Function execution failed',
      error: error.message
    }, 500);
  }
};