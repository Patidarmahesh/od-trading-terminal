import Trade from '../models/tradeModel.js';

export const placePaperOrder = async (req, res) => {
  try {
    const { symbol, side, entryPrice, quantity = 50 } = req.body;

    if (!symbol || !side || !entryPrice) {
      return res.status(400).json({ error: 'Missing required fields: symbol, side, entryPrice' });
    }

    const newTrade = new Trade({
      symbol,
      side,
      entryPrice,
      quantity,
      status: 'OPEN'
    });

    await newTrade.save();

    res.status(201).json({ message: 'Paper order placed successfully', trade: newTrade });
  } catch (error) {
    console.error('Error placing paper order:', error);
    res.status(500).json({ error: 'Failed to place paper order' });
  }
};

export const getOpenPositions = async (req, res) => {
  try {
    const openPositions = await Trade.find({}).sort({ timestamp: -1 });
    res.status(200).json({ positions: openPositions });
  } catch (error) {
    console.error('Error fetching open positions:', error);
    res.status(500).json({ error: 'Failed to fetch open positions' });
  }
};

export const closePaperOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { realizedPnl } = req.body;
    const updatedTrade = await Trade.findByIdAndUpdate(
      id,
      { status: 'CLOSED', pnl: realizedPnl || 0 },
      { new: true }
    );
    if (!updatedTrade) return res.status(404).json({ error: 'Trade not found' });
    res.status(200).json({ message: 'Trade closed', trade: updatedTrade });
  } catch (error) {
    console.error('Error closing paper order:', error);
    res.status(500).json({ error: 'Failed to close paper order' });
  }
};


