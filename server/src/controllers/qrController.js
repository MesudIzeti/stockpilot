const QRCode = require('qrcode');

const getMobileQR = async (req, res) => {
  try {
    const { baseUrl } = req.query;
    if (!baseUrl) {
      return res.status(400).json({ message: 'baseUrl query parameter is required' });
    }

    const mobileUrl = `${baseUrl}/mobile`;

    const buffer = await QRCode.toBuffer(mobileUrl, {
      type: 'png',
      width: 400,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(buffer);
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({ message: 'Failed to generate QR code' });
  }
};

module.exports = { getMobileQR };
