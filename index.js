const express = require('express');
const axios = require('axios');
const app = express();

// Set view engine to EJS
app.set('view engine', 'ejs');

// Serve static files from the "public" directory
app.use(express.static('public'));

let marketDataCache = {
    overview: null,
    topGainers: [],
    topLosers: [],
    timestamp: null
};

// Cache duration set to 5 minutes (in milliseconds)
const cacheDuration = 5 * 60 * 1000;

// Main route to render the home page
app.get('/', async (req, res) => {
    let priceData = null;
    let symbol = req.query.symbol ? req.query.symbol.toUpperCase() : null;

    // If a symbol is provided in the query, fetch its price from Blockchain.com
    if (symbol) {
        const apiUrl = `https://api.blockchain.com/v3/exchange/tickers/${symbol}-USD`;

        try {
            const { data } = await axios.get(apiUrl);
            priceData = {
                name: symbol,
                symbol: symbol,
                current_price: data.last_trade_price
            };
        } catch (error) {
            console.error(`Error fetching price for ${symbol}:`, error.message);
        }
    }

    // Check if cached data is still valid (within the set cache duration)
    if (!marketDataCache.overview || Date.now() - marketDataCache.timestamp > cacheDuration) {
        console.log('Fetching fresh market data...');

        try {
            // Fetch market overview from CoinGecko
            const marketOverviewRes = await axios.get('https://api.coingecko.com/api/v3/global');
            marketDataCache.overview = marketOverviewRes.data.data;

            // Fetch coin market data from CoinGecko to get top gainers and losers
            const coinsRes = await axios.get(
                'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false'
            );

            const coins = coinsRes.data;

            // Sort and extract top 5 gainers and losers
            marketDataCache.topGainers = coins
                .filter(coin => coin.price_change_percentage_24h > 0)
                .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
                .slice(0, 5);

            marketDataCache.topLosers = coins
                .filter(coin => coin.price_change_percentage_24h < 0)
                .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
                .slice(0, 5);

            // Update cache timestamp
            marketDataCache.timestamp = Date.now();
        } catch (error) {
            console.error('Error fetching market data from CoinGecko:', error.message);
            marketDataCache.topGainers = [];
            marketDataCache.topLosers = [];
        }
    } else {
        console.log('Serving cached data...');
    }

    // Render the index view with the collected data
    res.render('index', {
        priceData,
        symbol,
        topGainers: marketDataCache.topGainers,
        topLosers: marketDataCache.topLosers,
        marketOverview: marketDataCache.overview
    });
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
