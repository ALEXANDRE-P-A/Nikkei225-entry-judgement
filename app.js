const YahooFinance  = require('yahoo-finance2').default;
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const PORT = 3000;

const app = express();

let nikkei225MarketTime = null;
let nikkei225Stocks = [];
let loadingFlag = false;

const stockSymbols = {
  fharmaceutical: [ 4151, 4502, 4503, 4506, 4507, 4519, 4523, 4568, 4578 ], // 医薬品
  consumerCyclical: [ 7201, 7202, 7203, 7205, 7211, 7261, 7267, 7269, 7270, 7272 ], // 消費者循環・耐久財
  gas: [ 9531, 9532 ], // ガス
  service: [ 2413, 2432, 3659, 3697, 4307, 4324, 4385, 4661, 4689, 4704, 4751, 4755, 6098, 6178, 6532, 7974, 9602, 9735, 9766 ], // サービス
  rubber: [ 5101, 5108 ], // ゴム
  otherFinancial: [ 8253, 8591, 8697 ], // その他金融
  otherManufacturing: [ 7832, 7911, 7912, 7951 ], // その他製造
  pulpAndPaper: [ 3861 ], // パルプ・紙
  chemistry: [ 3405, 3407, 4004, 4005, 4021, 4042, 4043, 4061, 4063, 4183, 4188, 4208, 4452, 4901, 4911, 6988 ], // 化学
  marineTransportation: [ 9101, 9104, 9107 ], // 海運
  machinery: [ 5631, 6103, 6113, 6273, 6301, 6302, 6305, 6326, 6361, 6367, 6471, 6472, 6473, 7004, 7011, 7013 ], // 機械
  bank: [ 5831, 7186, 8304, 8306, 8308, 8309, 8316, 8331, 8354, 8411 ], // 銀行
  airTransportation: [ 9201,9202 ], // 空運
  construction: [ 1721, 1801, 1802, 1803, 1808, 1812, 1925, 1928, 1963 ], // 建設
  mining: [ 1605 ], // 鉱業
  tradingCompany: [ 2768, 8001, 8002, 8015, 8031, 8053, 8058 ], // 商社
  retail: [ 3086, 3092, 3099, 3382, 7453, 8233, 8252, 8267, 9843, 9983 ], // 小売業
  securities: [8601, 8604 ], // 証券
  food: [ 2002, 2269, 2282, 2501, 2502, 2503, 2801, 2802, 2871, 2914 ],// 食品
  fisheries: [ 1332 ], // 水産
  equipment: [ 4543, 4902, 6146, 7731, 7733, 7741 ], // 精密機械
  oil: [ 5019, 5020 ], // 石油
  fiber: [ 3401, 3402 ], // 繊維
  shipbuilding: [ 7012 ], // 造船
  communication: [ 9432, 9433, 9434, 9984 ], // 通信
  steel: [ 5401, 5406, 5411 ], // 鉄鋼
  railway: [ 9001, 9005, 9007, 9008, 9009, 9020, 9021, 9022 ], // 鉄道・バス
  electricalEquipment: [ 4062, 6479, 6501, 6503, 6504, 6506, 6526, 6645, 6674, 6701, 6702, 6723, 6724, 6752, 6753, 6758, 6762, 6770, 6841, 6857, 6861, 6902, 6920, 6952, 6954, 6963, 6971, 6976, 6981, 7735, 7751, 7752, 8035 ], // 電気機器
  energy: [ 9501, 9502, 9503 ], // 電力
  nonFerrous: [ 3436, 5706, 5711, 5713, 5714, 5801, 5802, 5803 ], // 非鉄・金属
  realState: [ 3289, 8801, 8802, 8804, 8830 ], // 不動産
  insurance: [ 8630, 8725, 8750, 8766, 8795 ], // 保険
  ceramics: [ 5201, 5214, 5233, 5301, 5332, 5333 ], // 窯業
  landTransportation: [ 9064, 9147 ], // 陸運
}

app.use(cors()); // Enables CORS for all routes and origins
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs'); // EJSを使用設定
app.set('views', './views');   // テンプレートの場所（デフォルトは./views）

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

const getPeriodDate = daysBehind => {
  const date = new Date();

  date.setDate(date.getDate() - daysBehind);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2,'0'); // 月は0-11
  const day = String(date.getDate()).padStart(2,'0');

  const formattedDate = `${year}-${month}-${day}`;

  return formattedDate;
};

const getStockInfo = async ticker => {
  try {
    const queryOptions = { modules: [ "price" ] };
    const result = await yahooFinance.quoteSummary(ticker, queryOptions);
    return result.price;
  } catch(e) {
    console.log(e);
  }
};

const getStockSector = async ticker => {

  try {
    const queryOptions = { modules: ["summaryProfile"] };
    const result = await yahooFinance.quoteSummary(ticker,queryOptions);
    const sector = result.summaryProfile.sector;
    console.log(`${ticker}のセクター：${sector}`);
    return sector;
  } catch(error) {
    console.log("エラー：", error);
  }
};

const getHistoricalData = async ticker => {

  const queryOptions = {
    period1: getPeriodDate(60), // 開始日 (YYYY-MM-DD または UNIX時間)
    period2: getPeriodDate(0), // 終了日 (必須)
    interval: '1d'// データ間隔 ('1d' = 日次'1wk' = 週次'1mo' = 月次)
  };

  try {
    const results = await yahooFinance.historical(ticker, queryOptions);

    const lastCloseValue = results[results.length-1].close;
    const MA1 = results.slice(-5).reduce((accumulator, currentValue) => accumulator + currentValue.close, 0);
    const MA2 = results.slice(-25).reduce((accumulator, currentValue) => accumulator + currentValue.close, 0);

    // エントリー条件１：５日線が２５日線よりも上（２５日線を含まない)
    const entryCondition1 = MA1 / 5 > MA2 / 25;
    // エントリー条件２：株価の終値が５日線以上（５日線を含む）
    const entryCondition2 = lastCloseValue >= MA1 / 5;

    // エントリー判断
    const entryJudgement = (entryCondition1 === true) && (entryCondition2 === true);

    return entryJudgement;

  } catch (e) {
    console.error(e);
  }
}

const getHistoricalStockDataToServer = async tickers => {

  const queryOptions = {
    period1: getPeriodDate(60), // 開始日 (YYYY-MM-DD または UNIX時間)
    period2: getPeriodDate(0), // 終了日 (必須)
    interval: '1d'// データ間隔 ('1d' = 日次'1wk' = 週次'1mo' = 月次)
  };


};

const getStocksData = async array => {

  let stocksDataArray = [];
  for(const ticker of array){

    const stockInfo = await getStockInfo(`${ticker}.T`);
    const name = stockInfo.longName || stockInfo.shortName; 
    const time = stockInfo.regularMarketTime;
    const open = stockInfo.regularMarketOpen;
    const high = stockInfo.regularMarketDayHigh;
    const low = stockInfo.regularMarketDayLow;
    const price = stockInfo.regularMarketPrice;
    const volume = stockInfo.regularMarketVolume;
    const entryJudgement = await getHistoricalData(`${ticker}.T`);

    const stockData = {
      ticker,
      time,
      name,
      open,
      high,
      low,
      price,
      volume,
      entryJudgement
    }
    stocksDataArray.push(stockData);
  }
  return stocksDataArray;
};

const getStocksToEntryData = async array => {
  let stocksDataArray = [];
  for(const ticker of array){

    const entryJudgement = await getHistoricalData(`${ticker}.T`);

    if(entryJudgement){
      const stockInfo = await getStockInfo(`${ticker}.T`);
      const time = Math.floor(new Date().getTime() / 1000);
      const name = stockInfo.longName || stockInfo.shortName; 
      const sector = await getStockSector(`${ticker}.T`);
      const open = stockInfo.regularMarketOpen;
      const high = stockInfo.regularMarketDayHigh;
      const low = stockInfo.regularMarketDayLow;
      const price = stockInfo.regularMarketPrice;
      const volume = stockInfo.regularMarketVolume;

      const stockData = {
        time,
        ticker,
        name,
        sector,
        open,
        high,
        low,
        price,
        volume,
        entryJudgement
      }
      stocksDataArray.push(stockData);
    }       
  }
  return stocksDataArray;
};

const getMarketUpdateTime = async _ => {
  try {
    const query = "^N225"; // 日経平均のデータを取得
    const result = await yahooFinance.quote(query);

    if(result && result.regularMarketTime)
      return result.regularMarketTime.toLocaleString("en-US", { hour12: false});
    else
      return "Error"

  } catch (error) {
    console.error('エラー:', error);
  }
};

app.get('/marketTime', async (req, res) => {
  const marketTime = await getMarketUpdateTime();
  console.log(marketTime);
  res.json({ "updateTime" : `${marketTime}`});
});

app.get('/', async (req, res) => {
  res.render('index');
});

app.get("/toEntry", async (req, res) => {
  const stocks = await getStocksToEntryData(Object.values(stockSymbols).flat());
  res.render('stocksView', { title: "Entry Judgement : TRUE", stocks: stocks });
});

app.get('/fharmaceutical', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.fharmaceutical);
  res.render('stocksView', { title: "Pharmaceutical", stocks: stocks });
});

app.get('/consumerCyclical', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.consumerCyclical);
  res.render('stocksView', { title: "Consumer Cyclical", stocks: stocks });
});

app.get('/gas', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.gas);
  res.render('stocksView', { title: "Gas", stocks: stocks });
});

app.get('/service', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.service);
  res.render('stocksView', { title: "Service", stocks: stocks });
});

app.get('/rubber', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.rubber);
  res.render('stocksView', { title: "Rubber", stocks: stocks });
});

app.get('/otherFinancial', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.otherFinancial);
  res.render('stocksView', { title: "Other Financial", stocks: stocks });
});

app.get('/otherManufacturing', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.otherManufacturing);
  res.render('stocksView', { title: "Other Manufacturing", stocks: stocks });
});

app.get('/pulpAndPaper', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.pulpAndPaper);
  res.render('stocksView', { title: "Pupl and Paper", stocks: stocks });
});

app.get('/chemistry', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.chemistry);
  res.render('stocksView', { title: "Chemistry", stocks: stocks });
});

app.get('/marineTransportation', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.marineTransportation);
  res.render('stocksView', { title: "Marine Transportation", stocks: stocks });
});

app.get('/machinery', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.machinery);
  res.render('stocksView', { title: "Machinery", stocks: stocks });
});

app.get('/bank', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.bank);
  res.render('stocksView', { title: "Bank", stocks: stocks });
});

app.get('/airTransportation', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.airTransportation);
  res.render('stocksView', { title: "Air Transportation", stocks: stocks });
});

app.get('/construction', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.construction);
  res.render('stocksView', { title: "Construction", stocks: stocks });
});

app.get('/mining', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.mining);
  res.render('stocksView', { title: "Mining", stocks: stocks });
});

app.get('/tradingCompany', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.tradingCompany);
  res.render('stocksView', { title: "Trading Company", stocks: stocks });
});

app.get('/retail', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.retail);
  res.render('stocksView', { title: "Retail", stocks: stocks });
});

app.get('/securities', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.securities);
  res.render('stocksView', { title: "Securities", stocks: stocks });
});

app.get('/food', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.food);
  res.render('stocksView', { title: "Food", stocks: stocks });
});

app.get('/fisheries', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.fisheries);
  res.render('stocksView', { title: "Fisheries", stocks: stocks });
});

app.get('/equipment', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.equipment);
  res.render('stocksView', { title: "Equipment", stocks: stocks });
});

app.get('/oil', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.oil);
  res.render('stocksView', { title: "Oil", stocks: stocks });
});

app.get('/fiber', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.fiber);
  res.render('stocksView', { title: "Oil", stocks: stocks });
});

app.get('/shipbuilding', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.shipbuilding);
  res.render('stocksView', { title: "Shipbuilding", stocks: stocks });
});

app.get('/communication', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.communication);
  res.render('stocksView', { title: "Communication", stocks: stocks });
});

app.get('/steel', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.steel);
  res.render('stocksView', { title: "Steel", stocks: stocks });
});

app.get('/railway', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.railway);
  res.render('stocksView', { title: "Railway", stocks: stocks });
});

app.get('/electricalEquipment', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.electricalEquipment);
  res.render('stocksView', { title: "Electronical Equipment", stocks: stocks });
});

app.get('/energy', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.energy);
  res.render('stocksView', { title: "Energy", stocks: stocks });
});

app.get('/nonFerrous', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.nonFerrous);
  res.render('stocksView', { title: "Non Ferrous", stocks: stocks });
});

app.get('/realState', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.realState);
  res.render('stocksView', { title: "Real Estate", stocks: stocks });
});

app.get('/insurance', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.insurance);
  res.render('stocksView', { title: "Insurance", stocks: stocks });
});

app.get('/ceramics', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.ceramics);
  res.render('stocksView', { title: "Ceramics", stocks: stocks });
});

app.get('/landTransportation', async (req, res) => {
  const stocks = await getStocksData(stockSymbols.landTransportation);
  res.render('stocksView', { title: "Land Transportation", stocks: stocks });
});

// ===================================================================================================

app.get('/nikkei225', async (req, res) => {
  // console.log(await getNikkei225StockData(Object.values(stockSymbols).flat()));
  if(loadingFlag)
    res.json({ "status" : "loading" });
  else
    res.json(nikkei225Stocks);
});

const switchLoadingFlag = async _ => {
  loadingFlag = false;
  console.log("nikkei225 stocks data is ready");
};

const storeNikkei225StocksData = async data => {
  nikkei225Stocks = data;
  console.log("data is stored successfully...");
};

const fetchNikkei225StocksData = async _ => {
  loadingFlag = true;
  console.log("fetching data ...");
  try {
    const stocks = await getStocksData(Object.values(stockSymbols).flat());
    await storeNikkei225StocksData(stocks);
    await switchLoadingFlag();
  } catch(e) {
    console.log("error in getting nikkei225 stocks data: ", e);
  };
};

const consoleLogMarketTime = async _ => {
  console.log(nikkei225MarketTime);
  console.log("stored market time value");
};

const updateMarketTime = async data => {
  nikkei225MarketTime = data;
  console.log("market time is stored successfully ...");
}; 

const checkAndUpdateMarketTime = async _ => {
  console.log("checking market time ...");
  try {
    const marketTime = await getMarketUpdateTime();
    await updateMarketTime(marketTime);
    await fetchNikkei225StocksData();
  } catch(e) {
    console.log("error in getting market time: ", e);
  }
};

// if(nikkei225Stocks.length === 0){
//   checkAndUpdateMarketTime();
//   fetchNikkei225StocksData();
// } else {
//   console.log(nikkei225Stocks);
// }

const startingServer = async _ => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  console.log(`${currentHour}:${currentMinute}:${currentSecond}`);
};

startingServer();

// cron.schedule("5 45 15 * * 1-5", () => {
//   console.log(new Date().toLocaleString("en-US", { hour12: false}));
// });

app.listen(PORT, _ => {
  console.log(`App listening at port http://127.0.0.1:${PORT}`);
});