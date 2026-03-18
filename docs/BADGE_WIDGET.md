# Badge Widget Documentation

The Escrow Lite badge widget is an embeddable trust badge that sellers can add to their websites to show verification status and transaction statistics.

## Quick Start

### Basic Embed

```html
<iframe
  src="https://escrow-lite.id/badge/{SELLER_ID}/widget"
  width="200"
  height="80"
  frameborder="0"
  scrolling="no">
</iframe>
```

Replace `{SELLER_ID}` with your actual seller ID.

## Customization Options

The badge widget supports customization via URL query parameters:

### Theme

- `theme=light` (default) - Light background
- `theme=dark` - Dark background

```html
<iframe src=".../widget?theme=dark" ...></iframe>
```

### Size

- `size=small` - 150x60px
- `size=medium` (default) - 200x80px
- `size=large` - 250x100px

```html
<iframe src=".../widget?size=large" width="250" height="100" ...></iframe>
```

### Color Scheme

- `color=blue` (default) - Blue accent
- `color=green` - Green accent
- `color=neutral` - Gray/neutral accent

```html
<iframe src=".../widget?color=green" ...></iframe>
```

### Display Options

- `showRating=true` (default) - Show verification status
- `showRating=false` - Hide verification status
- `showStats=true` (default) - Show transaction statistics
- `showStats=false` - Hide transaction statistics

```html
<iframe src=".../widget?showRating=false" ...></iframe>
```

## Examples

### Small Green Badge (Dark Theme)

```html
<iframe
  src="https://escrow-lite.id/badge/abc123/widget?theme=dark&size=small&color=green"
  width="150"
  height="60"
  frameborder="0"
  scrolling="no">
</iframe>
```

### Large Blue Badge with Minimal Info

```html
<iframe
  src="https://escrow-lite.id/badge/abc123/widget?size=large&color=blue&showStats=false"
  width="250"
  height="100"
  frameborder="0"
  scrolling="no">
</iframe>
```

### Medium Neutral Badge (Light Theme)

```html
<iframe
  src="https://escrow-lite.id/badge/abc123/widget?theme=light&size=medium&color=neutral"
  width="200"
  height="80"
  frameborder="0"
  scrolling="no">
</iframe>
```

## Widget Features

The badge displays:

- **Escrow Lite branding** with shield icon
- **Verification status** - Shows if seller is KYC verified
- **Transaction count** - Total number of transactions
- **Success rate** - Percentage of successful transactions
- **Click-through** - Links to public verification page

## Auto-Refresh

The widget automatically refreshes every 60 seconds to show up-to-date statistics.

## Public Verification Page

When users click on the badge, they're taken to a public verification page at:

```
https://escrow-lite.id/badge/{SELLER_ID}/verify
```

This page displays:
- Seller information and KYC status
- Detailed statistics (transactions, success rate, volume)
- Recent transaction history
- Information about Escrow Lite protection

## API Access

You can also access badge statistics programmatically via API:

```bash
curl https://escrow-lite.id/api/badge/{SELLER_ID}/stats
```

Response:

```json
{
  "seller": {
    "id": "abc123",
    "name": "Example Store",
    "kycTier": "full",
    "kycVerified": true
  },
  "stats": {
    "totalTransactions": 150,
    "successRate": 98,
    "totalAmount": 150000000
  },
  "verification": {
    "level": "Verified",
    "isVerified": true
  }
}
```

## Best Practices

1. **Choose appropriate size** - Match the badge size to your website layout
2. **Select matching theme** - Use dark theme on dark backgrounds, light on light
3. **Prominent placement** - Place the badge near product pages or checkout
4. **Test responsiveness** - Ensure badge displays correctly on mobile devices
5. **Use HTTPS** - Always use HTTPS URLs for the widget

## Troubleshooting

### Widget Not Showing

- Verify your seller ID is correct
- Check browser console for errors
- Ensure your website allows iframes from escrow-lite.id

### Incorrect Statistics

- Statistics update every 60 seconds
- Recent transactions may take a few minutes to appear
- Check your dashboard for real-time statistics

### Styling Issues

- Ensure adequate space for the chosen size
- Check that parent container allows overflow: visible
- Verify no conflicting CSS on your website

## Support

For issues or questions about the badge widget:
- Documentation: https://escrow-lite.id/docs
- Support: support@escrow-lite.id
- Status: https://status.escrow-lite.id
