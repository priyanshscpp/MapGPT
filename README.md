# MapGPT MCP 

A high-performance mapping application built with modern web technologies, providing real-time geospatial visualization and interaction capabilities.

## 🚀 Features

- 🗺️ Live Location Sharing with real-time updates.
- ⚡ Real-time chatting with Maps
- 📱 Responsive design for all devices
- 🔒 Secure and scalable architecture
- 🐳 Docker container support
- 🔄 Built with Vite for fast development and optimized production builds

## 🛠️ Prerequisites

- Node.js 18+
- npm 9+ or yarn 1.22+
- Docker 20.10+ (optional)
- Google Maps API key
- Gemini API Key

## 🛠️ Screenshots

![MapGPT Dashboard](docs/screenshot1.png)
![Real-time Location Sharing](docs/screenshot2.png)


## 🚀 Quick Start

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/mapgpt.git
   cd mapgpt
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your configuration:
   ```env
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) to view it in your browser.

### Docker Setup

1. Build the Docker image:
   ```bash
   docker build -t MapGPT .
   ```

2. Run the container:
   ```bash
   docker run -p 3000:3000 --env-file .env.local MapGPT
   ```
   The application will be available at [http://localhost:3000](http://localhost:3000)

## 📂 Project Structure

```
mapgpt/
├── src/                    # Source files
│   ├── components/         # Reusable UI components
│   ├── services/           # API and service integrations
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── public/                 # Static assets
├── .env.local              # Environment variables (not versioned)
├── index.html              # Main HTML file
├── vite.config.ts          # Vite configuration
└── tsconfig.json           # TypeScript configuration
```

## 🧪 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run linter
- `npm run type-check` - Run TypeScript type checking

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps JavaScript API key | Yes |
| `VITE_API_BASE_URL` | Base URL for API requests | No |

## 🐳 Docker Deployment

### Production Build

```bash
docker build -t mapgpt:latest .
```

### Run with Environment Variables

```bash
docker run -d \
  --name mapgpt \
  -p 3000:3000 \
  --env-file .env.production \
  mapgpt:latest
```

### Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  mcp-maps:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    restart: unless-stopped
```

Then run:
```bash
docker-compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📬 Contact

For questions or feedback, please open an issue or contact the maintainers.

---

<div align="center">
  Made with ❤️ by Your Team Name
</div>
