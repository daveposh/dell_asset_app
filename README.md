# Dell Asset Management Freshservice Application

A Freshservice application that integrates with Dell TechDirect API to automatically fetch warranty information and hardware specifications for Dell computers using their service tags.

## Features

- **Service Tag Lookup**: Enter Dell service tags to retrieve warranty and hardware information
- **Automatic Data Population**: Automatically populate asset records with warranty expiration dates
- **Hardware Specifications**: Retrieve detailed hardware specs including CPU, RAM, storage, and model information
- **Warranty Status**: Check warranty status (active, expired, expiring soon)
- **Bulk Operations**: Process multiple service tags at once
- **Real-time Updates**: Live integration with Dell's TechDirect API

## Prerequisites

Before setting up this application, ensure you have:

1. **Node.js v18.13.0 or later** - Download from [nodejs.org](https://nodejs.org/)
2. **Freshworks FDK** - Will be installed during setup
3. **Dell TechDirect API Access**:
   - Register at [Dell TechDirect](https://tdm.dell.com/)
   - Apply for API access
   - Obtain API key and secret

## Installation

### 1. Install Node.js
Download and install Node.js v18.13.0 or later from [nodejs.org](https://nodejs.org/)

### 2. Install Freshworks FDK
```bash
npm install -g @freshworks/cli
```

### 3. Clone and Setup Project
```bash
git clone <repository-url>
cd dell_asset_app
npm install
```

### 4. Configure Dell API Credentials
1. Copy `config/iparams.example.json` to `config/iparams.json`
2. Update the Dell API credentials in the installation parameters

### 5. Test the Application
```bash
fdk run
```

## Configuration

### Dell TechDirect API Setup

1. **Register for API Access**:
   - Go to [Dell TechDirect Portal](https://tdm.dell.com/)
   - Create an account and apply for API access
   - Wait for approval (typically 2-3 business days)

2. **Get API Credentials**:
   - Once approved, navigate to API Management
   - Create a new application to get your Client ID and Secret
   - Note down your credentials

3. **Configure in Freshservice**:
   - Install the app in your Freshservice instance
   - Enter your Dell API credentials during installation
   - Test the connection

## Usage

### Single Service Tag Lookup
1. Navigate to an asset record in Freshservice
2. Enter the Dell service tag in the designated field
3. Click "Fetch Dell Information"
4. The app will automatically populate warranty and hardware details

### Bulk Service Tag Processing
1. Go to the Dell Asset Management app page
2. Upload a CSV file with service tags or enter them manually
3. Click "Process All"
4. Review the results and apply updates to asset records

### Supported Information
- **Warranty Details**: Start date, end date, service level, warranty status
- **Hardware Specs**: Model, CPU, RAM, storage, graphics
- **Product Info**: Product family, system description, ship date
- **Service Entitlements**: All active and expired warranties/services

## API Endpoints

The application uses Dell TechDirect API v5:
- **Base URL**: `https://apigtwb2c.us.dell.com/PROD/sbil/eapi/v5/`
- **Authentication**: OAuth 2.0 Bearer Token
- **Primary Endpoint**: `/asset-entitlements?servicetags={service_tag}`

## File Structure

```
dell_asset_app/
├── app/
│   ├── index.html              # Main app interface
│   ├── scripts/
│   │   ├── app.js             # Main application logic
│   │   ├── dell-api.js        # Dell API integration
│   │   └── freshservice-api.js # Freshservice API helpers
│   └── styles/
│       ├── styles.css         # Application styles
│       └── images/
│           └── icon.svg       # App icon
├── config/
│   ├── iparams.json          # Installation parameters
│   └── oauth_config.json     # OAuth configuration
├── server/
│   └── server.js             # Serverless functions
├── manifest.json             # App manifest
├── package.json              # Dependencies
└── README.md                 # This file
```

## Troubleshooting

### Common Issues

1. **API Authentication Errors**:
   - Verify your Dell API credentials are correct
   - Ensure your API key hasn't expired
   - Check that your IP address is whitelisted (if required)

2. **Service Tag Not Found**:
   - Verify the service tag is correct (7 characters, alphanumeric)
   - Ensure the device is registered with Dell
   - Some older devices may not be in Dell's database

3. **Rate Limiting**:
   - Dell API has rate limits (typically 100 requests per minute)
   - The app includes automatic retry logic with exponential backoff

### Debug Mode
To enable debug logging:
1. Set `DEBUG=true` in your environment
2. Check browser console and app logs for detailed information

## Support

For issues related to:
- **Dell API**: Contact Dell TechDirect Support
- **Freshservice Platform**: Contact Freshworks Support  
- **This Application**: Create an issue in this repository

## License

This application is provided as-is for educational and business use. Dell TechDirect API usage is subject to Dell's terms of service.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Changelog

### v1.0.0
- Initial release
- Dell TechDirect API v5 integration
- Single and bulk service tag lookup
- Warranty and hardware specification retrieval
- Freshservice asset integration 