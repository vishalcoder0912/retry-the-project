// Main HTTP server setup
import { createServer } from 'node:http';
import { validateConfig, printConfigSummary } from '../config/environment.js';
import { setupRoutes } from '../routes/index.js';
import { errorHandler } from '../middleware/error-handler.js';
import { requestLogger } from '../middleware/request-logger.js';
import { corsMiddleware } from '../middleware/cors.js';
import config from '../config/environment.js';

let serverInstance = null;

/**
 * Create and configure the HTTP server
 */
export function createHttpServer() {
  // Validate configuration
  validateConfig();
  
  // Print configuration summary
  if (config.logging.verbose) {
    printConfigSummary();
  }

  // Create HTTP server
  const server = createServer((request, response) => {
    // Request start time for logging
    request.startTime = Date.now();

    try {
      // Apply CORS middleware
      corsMiddleware(request, response);

      // Handle preflight OPTIONS requests
      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          'Access-Control-Allow-Origin': config.cors.origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        });
        response.end();
        return;
      }

      // Parse URL
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      request.pathname = url.pathname;
      request.searchParams = url.searchParams;

      // Apply request logging middleware
      requestLogger(request, response);

      // Setup routes
      setupRoutes(request, response);

    } catch (error) {
      // Handle any unexpected errors
      errorHandler(error, request, response);
    }
  });

  // Store server instance
  serverInstance = server;

  return server;
}

/**
 * Start the HTTP server
 */
export async function startServer(server, port = config.server.port) {
  return new Promise((resolve, reject) => {
    server.listen(port, config.server.host, (error) => {
      if (error) {
        console.error('❌ Failed to start server:', error);
        reject(error);
        return;
      }

      const address = server.address();
      const host = address.address === '::' ? 'localhost' : address.address;
      const port = address.port;

      console.log('\n🚀 ===== InsightFlow API Server =====');
      console.log(`📍 Server running on: http://${host}:${port}`);
      console.log(`📍 Environment: ${config.server.nodeEnv}`);
      console.log(`📍 Node.js version: ${process.version}`);
      console.log(`📍 Process ID: ${process.pid}`);
      console.log('\n📊 Available Endpoints:');
      console.log('   GET  /api/health           - Health check');
      console.log('   GET  /api/ai/status        - AI provider status');
      console.log('   POST /api/ai/test          - Test AI generation');
      console.log('   POST /api/datasets/import  - Import dataset');
      console.log('   GET  /api/datasets/:id     - Get dataset info');
      console.log('   POST /api/datasets/:id/chat - Chat with dataset');
      console.log('\n🎯 Ready to accept connections!\n');

      resolve(server);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
        console.error(`   Try: kill -9 $(lsof -ti:${port})`);
        console.error(`   Or change PORT in .env file`);
      } else {
        console.error('❌ Server error:', error);
      }
      reject(error);
    });

    // Handle graceful shutdown
    server.on('close', () => {
      console.log('📡 Server closed');
    });

    // Handle process signals
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));
    process.on('SIGUSR2', () => gracefulShutdown(server)); // nodemon restart
  });
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(server) {
  console.log('\n🛑 Shutting down gracefully...');

  // Stop accepting new connections
  server.close(async (error) => {
    if (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }

    console.log('✅ Server closed successfully');
    
    // Close database connections, cleanup resources, etc.
    // This would be expanded based on your actual resources
    
    console.log('👋 Goodbye!');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⏰ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

/**
 * Get server instance
 */
export function getServer() {
  return serverInstance;
}

/**
 * Check if server is running
 */
export function isServerRunning() {
  return serverInstance && serverInstance.listening;
}

export default {
  createHttpServer,
  startServer,
  getServer,
  isServerRunning
};
