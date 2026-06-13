import express from "express";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing middleware for POST requests
  app.use(express.json());

  // Helper to construct secure Redirect URI
  const getRedirectUri = (req: express.Request) => {
    // In preview environments, APP_URL is provided, so prefer that if set.
    const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    return `${baseUrl}/auth/callback`;
  };

  // 1. Generate auth URL for Google
  app.get("/api/auth/url", (req, res) => {
    const redirectUri = getRedirectUri(req);
    
    const params = new URLSearchParams({
      client_id: process.env.OAUTH_CLIENT_ID || "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive.file email profile openid",
      access_type: "offline",
      prompt: "consent", // Force refresh token retrieval
    });

    const providerAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    const authUrl = `${providerAuthUrl}?${params}`;

    res.json({ url: authUrl });
  });

  // 2. Handle callback and token exchange
  app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
    const { code, error } = req.query;

    if (error) {
       return res.send(`
         <html><body>
         <script>
           if (window.opener) {
             window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${error}' }, '*');
             window.close();
           } else {
             window.location.href = '/';
           }
         </script>
         <p>Authentication rejected. You can close this window.</p>
         </body></html>
       `);
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).send("No code provided.");
    }

    try {
      const redirectUri = getRedirectUri(req);
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.OAUTH_CLIENT_ID || "",
          client_secret: process.env.OAUTH_CLIENT_SECRET || "",
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });

      const data = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error("Token exchange failed:", data);
        res.status(400).send("Failed to exchange token");
        return;
      }

      // We pass the token info back to the client via postMessage
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  payload: ${JSON.stringify(data)} 
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (err) {
      console.error("Error exchanging token:", err);
      res.status(500).send("Internal Server Error");
    }
  });

  // Client requests a refresh via server
  app.post("/api/auth/refresh", async (req, res) => {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: "No refresh token provided" });
    }

    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.OAUTH_CLIENT_ID || "",
          client_secret: process.env.OAUTH_CLIENT_SECRET || "",
          refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const data = await tokenResponse.json();
      if (!tokenResponse.ok) {
         return res.status(tokenResponse.status).json(data);
      }
      res.json(data);
    } catch (err) {
      console.error("Error refreshing token:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
