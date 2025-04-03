# Market Manipulator Function for Appwrite

## Overview

This Appwrite function calculates a market manipulation factor based on real-world stock market data. It processes stock price changes to determine a weighted market movement factor, which can be used to influence in-game market behavior.

## Function Flow

1. **Initialize Appwrite Client**: Setup connection to Appwrite backend
2. **Fetch Real-World Data**: Retrieve stock market data from a configured collection
3. **Calculate Average Market Change**: Process the market data to get an average percentage change
4. **Determine Manipulation Factor**: Calculate a manipulation factor (0.1% to 5%) based on market volatility
5. **Update Database**: Store the calculated manipulation factor for use by the game

## Configuration

This function requires the following environment variables:

- `APPWRITE_FUNCTION_API_ENDPOINT`: Appwrite endpoint URL
- `APPWRITE_FUNCTION_PROJECT_ID`: Appwrite project ID
- `APPWRITE_FUNCTION_DATABASE_ID`: Database ID containing market collections
- `APPWRITE_FUNCTION_REALWORLD_COLLECTION_ID`: Collection ID for real-world market data
- `APPWRITE_FUNCTION_MARKET_COLLECTION_ID`: Collection ID for in-game market data
- `APPWRITE_FUNCTION_MANIPULATOR_COLLECTION_ID`: Collection ID for storing the manipulation factor

## Database Structure

### Real-World Collection

Expected schema:

- `price`: String - Current price of the stock/ETF
- `change_percentage`: String - Percentage change (e.g., "-1.9929%")

### Manipulator Collection

Generated schema:

- `manipulator`: String - The calculated market manipulation factor (0.1-5.0)
- `UpdateTime`: DateTime - Timestamp of last update

## Manipulation Logic

The function uses a tiered approach to determine market manipulation:

| Market Change   | Manipulation Factor |
| --------------- | ------------------- |
| 0-2% (Normal)   | 0.1-1.5%            |
| 2-5% (High)     | 1.5-3.0%            |
| 5-10% (Extreme) | 3.0-5.0%            |
| >10%            | 5.0% (cap)          |

## Usage

### Function Deployment

1. Deploy this function to your Appwrite project
2. Configure all required environment variables
3. Set appropriate permissions and API key

### Response Format

Success Response:

```json
{
  "success": true,
  "manipulator": 1.75,
  "average_change": -2.34
}
```

Error Response:

```json
{
  "success": false,
  "error": "Error message details"
}
```

## Error Handling

The function includes comprehensive error handling for:

- Missing or invalid market data
- Database connection issues
- Data processing errors

All errors are logged using Appwrite's context logging system for easy debugging.

## Development

### Prerequisites

- Node.js
- Appwrite account and project
- Configured collections with appropriate schema

### Local Testing

Use the Appwrite CLI to test this function locally:

```bash
appwrite functions createExecution \
  --functionId=[FUNCTION_ID] \
  --data='{}'
```

## Maintenance

- Monitor function logs for any processing errors
- Review the calculation logic periodically to ensure it continues to meet your game's requirements
- Consider adding additional market indicators for more sophisticated manipulation
