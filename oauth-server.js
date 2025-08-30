const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

/**
 * Simple OAuth Redirect Server for Electron App
 * 
 * This server handles OAuth redirects from Supabase authentication
 * (both magic links and Google OAuth) and serves the oauth-success.html page
 * which then redirects back to the Electron application.
 */

const PORT = 8080;
const HOST = 'localhost';

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`[OAuth Server] ${new Date().toISOString()} - ${req.method} ${req.url}`);

  // Handle OAuth success redirect
  if (pathname === '/oauth-success' || pathname === '/oauth-success/') {
    const filePath = path.join(__dirname, 'oauth-success.html');
    
    fs.readFile(filePath, (err, content) => {
      if (err) {
        console.error('[OAuth Server] Error reading oauth-success.html:', err);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('OAuth success page not found');
        return;
      }

      // Set appropriate headers
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.end(content);
      console.log('[OAuth Server] Served oauth-success.html');
    });
    
    return;
  }

  // Handle health check / status endpoint
  if (pathname === '/health' || pathname === '/status') {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*' 
    });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'OAuth Redirect Server',
      port: PORT,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // Handle 404 for all other requests
  console.log(`[OAuth Server] 404 - Path not found: ${pathname}`);
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>OAuth Server - Not Found</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
          text-align: center; 
          padding: 50px; 
          color: #333;
        }
        .container {
          max-width: 500px;
          margin: 0 auto;
        }
        h1 { color: #e74c3c; }
        .endpoint { 
          background: #f8f9fa; 
          padding: 10px; 
          border-radius: 4px; 
          font-family: monospace;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>404 - Not Found</h1>
        <p>This is the OAuth redirect server for the Overlay Electron app.</p>
        <p>Available endpoints:</p>
        <div class="endpoint">GET /oauth-success - OAuth redirect handler</div>
        <div class="endpoint">GET /health - Server status</div>
        <p>If you're seeing this page, the server is running correctly.</p>
      </div>
    </body>
    </html>
  `);
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[OAuth Server] ERROR: Port ${PORT} is already in use`);
    console.error('[OAuth Server] Please check if another OAuth server is running or use a different port');
    process.exit(1);
  } else {
    console.error('[OAuth Server] Server error:', err);
  }
});

// Start the server
server.listen(PORT, HOST, () => {
  console.log('');
  console.log('🚀 OAuth Redirect Server Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Server URL: http://${HOST}:${PORT}`);
  console.log(`🔗 OAuth Endpoint: http://${HOST}:${PORT}/oauth-success`);
  console.log(`❤️  Health Check: http://${HOST}:${PORT}/health`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Ready to handle OAuth redirects from Supabase');
  console.log('💡 This server works with both Magic Links and Google OAuth');
  console.log('');
  console.log('To stop the server: Press Ctrl+C');
  console.log('');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[OAuth Server] Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('[OAuth Server] Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n[OAuth Server] Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('[OAuth Server] Server closed successfully');
    process.exit(0);
  });
});