import fs from 'fs';

const serverFile = 'server.ts';
let content = fs.readFileSync(serverFile, 'utf8');

// 1. Replace the /api/chat/messages endpoint
const oldChatEndpoint = `  app.get('/api/chat/messages', requireAuth, async (req, res) => {
    const userId = (req as any).userId;
    const accountId = (req as any).accountId;
    const role = (req as any).role;

    try {
      if (process.env.AWS_DB_PASSWORD) {
        let query = 'SELECT * FROM chat_messages WHERE account_id = $1 ORDER BY created_at ASC';
        let params = [accountId];
        
        if (role === 'super_admin') {
          // Super admin can see all messages for a specific account if they are chatting with them
          // For now, let's just return messages for the current account
        }

        const { rows } = await pool.query(query, params);
        res.json(rows);
      } else {
        res.json([]);
      }
    } catch (err) {
      console.error('Failed to fetch chat messages:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });`;

const newChatEndpoints = `  // Chat Endpoints
  app.get('/api/chat/messages', requireAuth, async (req, res) => {
    const userId = (req as any).userId;
    const accountId = (req as any).accountId;
    try {
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('SELECT * FROM chat_messages WHERE account_id = $1 OR user_id = $2 ORDER BY created_at ASC', [accountId, userId]);
        res.json(rows);
      } else {
        res.json([]);
      }
    } catch (err) {
      console.error('Failed to fetch chat messages:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/chat/guest/messages', async (req, res) => {
    const guestId = req.query.guestId;
    if (!guestId) return res.status(400).json({ error: 'guestId required' });
    try {
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('SELECT * FROM chat_messages WHERE guest_id = $1 ORDER BY created_at ASC', [guestId]);
        res.json(rows);
      } else {
        res.json([]);
      }
    } catch (err) {
      console.error('Failed to fetch guest chat messages:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/chat/admin/sessions', requireAuth, async (req, res) => {
    const role = (req as any).role;
    if (role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      if (process.env.AWS_DB_PASSWORD) {
        // Get unique users and guests who have sent messages
        const { rows } = await pool.query(\`
          SELECT DISTINCT ON (COALESCE(user_id, guest_id))
            user_id, guest_id, account_id, created_at, message
          FROM chat_messages
          ORDER BY COALESCE(user_id, guest_id), created_at DESC
        \`);
        
        // Sort by latest message overall
        rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        res.json(rows);
      } else {
        res.json([]);
      }
    } catch (err) {
      console.error('Failed to fetch chat sessions:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/chat/admin/messages/:id', requireAuth, async (req, res) => {
    const role = (req as any).role;
    if (role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
    const id = req.params.id;
    try {
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('SELECT * FROM chat_messages WHERE user_id = $1 OR guest_id = $1 ORDER BY created_at ASC', [id]);
        res.json(rows);
      } else {
        res.json([]);
      }
    } catch (err) {
      console.error('Failed to fetch admin chat messages:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });`;

content = content.replace(oldChatEndpoint, newChatEndpoints);

// 2. Replace WebSocket logic
const oldWsLogic = `  const server = createHttpServer(app);
  const wss = new WebSocketServer({ server });
  const clients = new Map<string, WebSocket>();

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', \`http://\${req.headers.host}\`);
    const userId = url.searchParams.get('userId');
    const accountId = url.searchParams.get('accountId');

    if (userId) {
      clients.set(userId, ws);
    }

    ws.on('message', async (data) => {
      try {
        const payload = JSON.parse(data.toString());
        const { type, message, targetUserId, isFromAdmin } = payload;

        if (type === 'chat_message') {
          if (process.env.AWS_DB_PASSWORD) {
            await pool.query(
              'INSERT INTO chat_messages (account_id, user_id, message, is_from_admin) VALUES ($1, $2, $3, $4)',
              [accountId, userId, message, isFromAdmin]
            );
          }

          if (targetUserId && clients.has(targetUserId)) {
            clients.get(targetUserId)?.send(JSON.stringify({
              type: 'chat_message',
              message,
              fromUserId: userId,
              isFromAdmin
            }));
          }
          
          if (!isFromAdmin) {
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'chat_message',
                  message,
                  fromUserId: userId,
                  accountId,
                  isFromAdmin: false
                }));
              }
            });
          }
        }
      } catch (e) {
        console.error('WS Message Error:', e);
      }
    });

    ws.on('close', () => {
      if (userId) clients.delete(userId);
    });
  });`;

const newWsLogic = `  const server = createHttpServer(app);
  const wss = new WebSocketServer({ server });
  const clients = new Map<string, WebSocket>();
  const lastEmailSent = new Map<string, number>();

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', \`http://\${req.headers.host}\`);
    const userId = url.searchParams.get('userId');
    const accountId = url.searchParams.get('accountId');
    const guestId = url.searchParams.get('guestId');
    
    const clientId = userId || guestId;

    if (clientId) {
      clients.set(clientId, ws);
    }

    ws.on('message', async (data) => {
      try {
        const payload = JSON.parse(data.toString());
        const { type, message, targetUserId, isFromAdmin } = payload;

        if (type === 'chat_message') {
          if (process.env.AWS_DB_PASSWORD) {
            await pool.query(
              'INSERT INTO chat_messages (account_id, user_id, guest_id, message, is_from_admin) VALUES ($1, $2, $3, $4, $5)',
              [accountId, userId, guestId, message, isFromAdmin]
            );
          }

          if (targetUserId && clients.has(targetUserId)) {
            clients.get(targetUserId)?.send(JSON.stringify({
              type: 'chat_message',
              message,
              fromUserId: clientId,
              isFromAdmin
            }));
          }
          
          if (!isFromAdmin) {
            // Broadcast to all connected superadmins (they might be connected without a specific targetUserId)
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'chat_message',
                  message,
                  fromUserId: clientId,
                  accountId,
                  guestId,
                  isFromAdmin: false
                }));
              }
            });

            // Send email notification to superadmin
            const now = Date.now();
            const lastSent = lastEmailSent.get(clientId || 'unknown') || 0;
            if (now - lastSent > 5 * 60 * 1000) { // 5 minutes throttle
              lastEmailSent.set(clientId || 'unknown', now);
              try {
                await sendEmail(
                  'abinibimultimedia@yahoo.com',
                  'New Chat Message on Gryndee',
                  \`You have received a new chat message from \${userId ? 'User ' + userId : 'Guest ' + guestId}:\\n\\n"\${message}"\\n\\nLogin to the admin dashboard to reply.\`
                );
              } catch (emailErr) {
                console.error('Failed to send chat notification email:', emailErr);
              }
            }
          }
        }
      } catch (e) {
        console.error('WS Message Error:', e);
      }
    });

    ws.on('close', () => {
      if (clientId) clients.delete(clientId);
    });
  });`;

content = content.replace(oldWsLogic, newWsLogic);

fs.writeFileSync(serverFile, content);
console.log('Successfully updated server.ts');
