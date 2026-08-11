const transporter = require('../config/mailer');

const buildLowStockHtml = ({ ownerName, productName, quantity, unit, minStock, category, supplierName, supplierPhone, appUrl, isOutOfStock }) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:32px auto;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#1565c0;padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:28px;">📦</span>
        <div>
          <div style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.3px;">StockPilot</div>
          <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:2px;">Inventory Intelligence Platform</div>
        </div>
      </div>
    </div>

    <!-- Alert Banner -->
    <div style="background:${isOutOfStock ? '#b71c1c' : '#e65100'};padding:18px 32px;">
      <div style="color:white;font-size:16px;font-weight:700;">
        ${isOutOfStock ? '🚨 OUT OF STOCK' : '⚠️ LOW STOCK ALERT'}
      </div>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;padding:32px;">
      <p style="margin:0 0 20px;color:#333;font-size:15px;">Hello <strong>${ownerName}</strong>,</p>
      <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
        ${isOutOfStock
          ? `<strong>${productName}</strong> has completely run out of stock and needs to be restocked immediately.`
          : `<strong>${productName}</strong> has dropped below your minimum stock threshold and needs attention.`
        }
      </p>

      <!-- Product Card -->
      <div style="background:${isOutOfStock ? '#ffebee' : '#fff3e0'};border-left:5px solid ${isOutOfStock ? '#c62828' : '#e65100'};border-radius:0 8px 8px 0;padding:20px 24px;margin-bottom:24px;">
        <div style="font-size:18px;font-weight:700;color:#1a1a1a;margin-bottom:12px;">${productName}</div>
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px;">
          <span style="font-size:36px;font-weight:800;color:${isOutOfStock ? '#c62828' : '#e65100'};">${quantity}</span>
          <span style="font-size:16px;color:#666;">${unit} remaining</span>
        </div>
        <div style="font-size:13px;color:#888;">Minimum threshold: <strong>${minStock} ${unit}</strong></div>
      </div>

      <!-- Details Table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:10px 0;color:#888;font-size:13px;width:130px;">Category</td>
          <td style="padding:10px 0;color:#222;font-size:13px;font-weight:600;">${category}</td>
        </tr>
        ${supplierName ? `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:10px 0;color:#888;font-size:13px;">Supplier</td>
          <td style="padding:10px 0;color:#222;font-size:13px;font-weight:600;">${supplierName}</td>
        </tr>
        ` : ''}
        ${supplierPhone ? `
        <tr>
          <td style="padding:10px 0;color:#888;font-size:13px;">Supplier Phone</td>
          <td style="padding:10px 0;font-size:13px;">
            <a href="tel:${supplierPhone}" style="color:#1565c0;font-weight:600;text-decoration:none;">${supplierPhone}</a>
          </td>
        </tr>
        ` : ''}
      </table>

      <!-- CTA Button -->
      <a href="${appUrl}/products"
         style="display:inline-block;background:#1565c0;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.2px;">
        View Products in StockPilot →
      </a>
    </div>

    <!-- Footer -->
    <div style="background:#f8f9fa;padding:18px 32px;border-top:1px solid #e8e8e8;">
      <p style="margin:0;color:#aaa;font-size:12px;text-align:center;line-height:1.6;">
        You received this alert because stock monitoring is enabled on your StockPilot account.<br>
        © ${new Date().getFullYear()} StockPilot — Smart Inventory & Revenue Intelligence
      </p>
    </div>

  </div>
</body>
</html>
`;

const sendLowStockAlert = async ({ toEmail, ownerName, productName, quantity, unit, minStock, category, supplierName, supplierPhone, appUrl }) => {
  const isOutOfStock = parseFloat(quantity) === 0;
  const subject = isOutOfStock
    ? `🚨 Out of Stock — ${productName}`
    : `⚠️ Low Stock Alert — ${productName}`;

  await transporter.sendMail({
    from: `"StockPilot Alerts" <${process.env.EMAIL_FROM}>`,
    to: toEmail,
    subject,
    html: buildLowStockHtml({
      ownerName: ownerName || 'there',
      productName,
      quantity,
      unit,
      minStock,
      category: category || '—',
      supplierName,
      supplierPhone,
      appUrl: appUrl || 'http://localhost:4200',
      isOutOfStock,
    }),
  });

  console.log(`[Email] Alert sent → ${toEmail} | Product: ${productName} | Stock: ${quantity} ${unit}`);
};

// ── Purchase Order Delivery Reminder ─────────────────────────────────────────

const buildPoReminderHtml = ({ ownerName, supplierName, orderedAt, items, notes, appUrl }) => {
  const dateStr = new Date(orderedAt).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const itemRows = items.map(item => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:10px 0;color:#222;font-size:13px;font-weight:600;">${item.name}</td>
      <td style="padding:10px 0;color:#555;font-size:13px;text-align:right;">${item.quantity} ${item.unit}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:32px auto;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#1565c0;padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:28px;">📦</span>
        <div>
          <div style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.3px;">StockPilot</div>
          <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:2px;">Inventory Intelligence Platform</div>
        </div>
      </div>
    </div>

    <!-- Alert Banner -->
    <div style="background:#0277bd;padding:18px 32px;">
      <div style="color:white;font-size:16px;font-weight:700;">🚚 Delivery Reminder</div>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;padding:32px;">
      <p style="margin:0 0 20px;color:#333;font-size:15px;">Hello <strong>${ownerName || 'there'}</strong>,</p>
      <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
        This is a friendly reminder about a purchase order you placed with
        <strong>${supplierName}</strong> on <strong>${dateStr}</strong>.
      </p>
      <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
        Have the products physically arrived at your location? If so, please open StockPilot
        and mark the order as <strong>Received</strong> so your stock levels are updated correctly.
      </p>

      <!-- Order Card -->
      <div style="background:#e3f2fd;border-left:5px solid #1565c0;border-radius:0 8px 8px 0;padding:20px 24px;margin-bottom:24px;">
        <div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:4px;">
          Order from ${supplierName}
        </div>
        <div style="font-size:12px;color:#666;margin-bottom:16px;">Placed on ${dateStr}</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid #bbdefb;">
              <th style="text-align:left;font-size:11px;font-weight:700;color:#555;padding:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Product</th>
              <th style="text-align:right;font-size:11px;font-weight:700;color:#555;padding:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Qty Ordered</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        ${notes ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #bbdefb;font-size:12px;color:#666;font-style:italic;">Note: ${notes}</div>` : ''}
      </div>

      <!-- CTA Button -->
      <a href="${appUrl}/suppliers"
         style="display:inline-block;background:#1565c0;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.2px;">
        Go to Suppliers &amp; Confirm Receipt →
      </a>
    </div>

    <!-- Footer -->
    <div style="background:#f8f9fa;padding:18px 32px;border-top:1px solid #e8e8e8;">
      <p style="margin:0;color:#aaa;font-size:12px;text-align:center;line-height:1.6;">
        You received this reminder because a purchase order has been in transit for over 24 hours.<br>
        © ${new Date().getFullYear()} StockPilot — Smart Inventory &amp; Revenue Intelligence
      </p>
    </div>

  </div>
</body>
</html>
`;
};

const sendPoReminderEmail = async ({ toEmail, ownerName, supplierName, orderedAt, items, notes, appUrl }) => {
  const dateStr = new Date(orderedAt).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  await transporter.sendMail({
    from: `"StockPilot Alerts" <${process.env.EMAIL_FROM}>`,
    to: toEmail,
    subject: `🚚 Delivery Reminder — Order from ${supplierName} (${dateStr})`,
    html: buildPoReminderHtml({
      ownerName,
      supplierName,
      orderedAt,
      items,
      notes,
      appUrl: appUrl || 'http://localhost:4200',
    }),
  });

  console.log(`[Email] PO reminder sent → ${toEmail} | Supplier: ${supplierName}`);
};

// ── Email Verification (Registration OTP) ────────────────────────────────────

const buildVerificationHtml = ({ name, code }) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:32px auto;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">

    <div style="background:#1565c0;padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:28px;">📦</span>
        <div>
          <div style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.3px;">StockPilot</div>
          <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:2px;">Inventory Intelligence Platform</div>
        </div>
      </div>
    </div>

    <div style="background:#2e7d32;padding:18px 32px;">
      <div style="color:white;font-size:16px;font-weight:700;">✉️ Verify Your Email Address</div>
    </div>

    <div style="background:#ffffff;padding:32px;">
      <p style="margin:0 0 16px;color:#333;font-size:15px;">Hello <strong>${name}</strong>,</p>
      <p style="margin:0 0 28px;color:#555;font-size:14px;line-height:1.6;">
        Thank you for creating your StockPilot account. Enter the verification code below to activate it.
      </p>

      <div style="background:#f0f7ff;border:2px solid #1565c0;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
        <div style="font-size:12px;color:#666;margin-bottom:12px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Verification Code</div>
        <div style="font-size:46px;font-weight:800;letter-spacing:14px;color:#1565c0;font-family:monospace;">${code}</div>
        <div style="font-size:12px;color:#999;margin-top:14px;">Expires in 10 minutes</div>
      </div>

      <p style="margin:0;color:#aaa;font-size:12px;line-height:1.6;">
        If you did not create a StockPilot account, you can safely ignore this email.
      </p>
    </div>

    <div style="background:#f8f9fa;padding:18px 32px;border-top:1px solid #e8e8e8;">
      <p style="margin:0;color:#aaa;font-size:12px;text-align:center;line-height:1.6;">
        © ${new Date().getFullYear()} StockPilot — Smart Inventory &amp; Revenue Intelligence
      </p>
    </div>

  </div>
</body>
</html>
`;

const sendVerificationEmail = async ({ toEmail, name, code }) => {
  await transporter.sendMail({
    from: `"StockPilot" <${process.env.EMAIL_FROM}>`,
    to: toEmail,
    subject: `${code} is your StockPilot verification code`,
    html: buildVerificationHtml({ name, code }),
  });
  console.log(`[Email] Verification code sent → ${toEmail}`);
};

module.exports = { sendLowStockAlert, sendPoReminderEmail, sendVerificationEmail };
