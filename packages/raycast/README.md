# Domainstack for Raycast

Look up WHOIS, DNS, SSL certificates, hosting providers, and SEO data for any domain directly from Raycast.

## Features

- **Lookup Domain**: Enter any domain to get a comprehensive report including:
  - WHOIS/RDAP registration data (registrar, dates, nameservers, DNSSEC)
  - DNS records (A, AAAA, CNAME, MX, TXT, NS, etc.)
  - SSL certificate chain and validity
  - Hosting, DNS, and email provider detection
  - HTTP headers and security analysis
  - SEO metadata and robots.txt

- **Inspect Current Tab**: Instantly analyze the domain of your current browser tab
  - Supports Safari, Chrome, Arc, Edge, Brave, Firefox, and other Chromium browsers

## Commands

| Command | Description |
|---------|-------------|
| `Lookup Domain` | Look up information for a specific domain |
| `Inspect Current Tab` | Inspect the domain of the active browser tab |

## Actions

- **Open Full Report**: View the complete report on domainstack.io
- **Visit Domain**: Open the domain in your browser
- **Copy Domain**: Copy the domain name to clipboard
- **Copy Report URL**: Copy the domainstack.io report URL
- **Copy DNS Records**: Copy all DNS records in zone file format

## Rate Limits

The Domainstack API has rate limits to ensure fair usage:
- Registration lookups: 30 requests/minute
- DNS lookups: 60 requests/minute
- Other endpoints: 30 requests/minute

If you hit a rate limit, wait a few seconds before retrying.

## Configuration

### API Base URL

By default, the extension uses `https://domainstack.io`. You can change this in the extension preferences if you're running a self-hosted instance.

## Privacy

This extension sends domain names to the Domainstack API for lookup. No other data is collected or transmitted. See [domainstack.io/privacy](https://domainstack.io/privacy) for the full privacy policy.

## Support

- Report issues: [GitHub Issues](https://github.com/jakejarvis/domainstack.io/issues)
- Website: [domainstack.io](https://domainstack.io)

## License

MIT License - see [LICENSE](LICENSE) for details.
