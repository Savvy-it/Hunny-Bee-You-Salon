import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to convert HH:mm to minutes from midnight
const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const format12h = (time24: string) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
};

// Helper to convert minutes from midnight to HH:mm
const fromMinutes = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const db = new Database("honeybeeyou.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    duration TEXT,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    client_phone TEXT,
    service_id INTEGER,
    services TEXT, -- JSON array of service names
    duration INTEGER, -- Total duration in minutes
    total_price REAL, -- Total price of selected services
    consent INTEGER DEFAULT 0, -- Consent to receive text messages or emails
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    image_url TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    FOREIGN KEY (service_id) REFERENCES services(id)
  );

  CREATE TABLE IF NOT EXISTS gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    caption TEXT
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    description TEXT,
    capacity INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS event_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS business_hours (
    day TEXT PRIMARY KEY,
    open_time TEXT,
    close_time TEXT,
    is_closed INTEGER DEFAULT 0
  );
`);

// Migration: Add missing columns if they don't exist
const tableInfo = db.prepare("PRAGMA table_info(appointments)").all() as any[];
const columns = tableInfo.map(c => c.name);
if (!columns.includes('services')) {
  try {
    db.exec("ALTER TABLE appointments ADD COLUMN services TEXT");
    console.log("Added 'services' column to appointments table");
  } catch (e) {
    console.error("Error adding 'services' column:", e);
  }
}
if (!columns.includes('duration')) {
  try {
    db.exec("ALTER TABLE appointments ADD COLUMN duration INTEGER");
    console.log("Added 'duration' column to appointments table");
  } catch (e) {
    console.error("Error adding 'duration' column:", e);
  }
}
if (!columns.includes('total_price')) {
  try {
    db.exec("ALTER TABLE appointments ADD COLUMN total_price REAL");
    console.log("Added 'total_price' column to appointments table");
  } catch (e) {
    console.error("Error adding 'total_price' column:", e);
  }
}
if (!columns.includes('consent')) {
  try {
    db.exec("ALTER TABLE appointments ADD COLUMN consent INTEGER DEFAULT 0");
    console.log("Added 'consent' column to appointments table");
  } catch (e) {
    console.error("Error adding 'consent' column:", e);
  }
}

// Seed initial data if empty
const serviceCount = db.prepare("SELECT COUNT(*) as count FROM services").get() as { count: number };
if (serviceCount.count === 0) {
  // No demo services
}

const hoursCount = db.prepare("SELECT COUNT(*) as count FROM business_hours").get() as { count: number };
if (hoursCount.count === 0) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const insertHours = db.prepare("INSERT INTO business_hours (day, open_time, close_time, is_closed) VALUES (?, ?, ?, ?)");
  days.forEach(day => {
    if (day === "Sunday" || day === "Monday") {
      insertHours.run(day, "00:00", "00:00", 1);
    } else if (day === "Saturday") {
      insertHours.run(day, "10:00", "16:00", 0);
    } else {
      insertHours.run(day, "09:00", "18:00", 0);
    }
  });
}

const galleryCount = db.prepare("SELECT COUNT(*) as count FROM gallery").get() as { count: number };
if (galleryCount.count === 0) {
  // No demo gallery images
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const broadcast = (data: any) => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // API Routes
  app.get("/api/services", (req, res) => {
    const services = db.prepare("SELECT * FROM services").all();
    res.json(services);
  });

  app.post("/api/services", (req, res) => {
    const { name, price, duration, description } = req.body;
    const info = db.prepare("INSERT INTO services (name, price, duration, description) VALUES (?, ?, ?, ?)").run(name, price, duration, description);
    broadcast({ type: 'DATA_UPDATED' });
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/services/:id", (req, res) => {
    const { name, price, duration, description } = req.body;
    db.prepare("UPDATE services SET name = ?, price = ?, duration = ?, description = ? WHERE id = ?").run(name, price, duration, description, req.params.id);
    broadcast({ type: 'DATA_UPDATED' });
    res.json({ success: true });
  });

  app.delete("/api/services/:id", (req, res) => {
    db.prepare("DELETE FROM services WHERE id = ?").run(req.params.id);
    broadcast({ type: 'DATA_UPDATED' });
    res.json({ success: true });
  });

  app.get("/api/appointments", (req, res) => {
    const appointments = db.prepare(`
      SELECT a.*, s.name as service_name 
      FROM appointments a 
      LEFT JOIN services s ON a.service_id = s.id
      ORDER BY date, time
    `).all();
    
    // Parse services JSON if it exists
    const parsedAppointments = appointments.map((apt: any) => ({
      ...apt,
      services: apt.services ? JSON.parse(apt.services) : []
    }));
    
    res.json(parsedAppointments);
  });

  app.post("/api/appointments", (req, res) => {
    const { client_name, client_email, client_phone, services, duration, totalPrice, consent, date, time, image_url, notes } = req.body;
    
    // Check for existing appointment at the same time (more robust check needed with variable durations)
    // For now, we'll rely on the available-slots logic, but a basic overlap check here is good.
    const buffer = 15;
    const startMins = toMinutes(time);
    const endMins = startMins + (duration || 60);

    const existingApts = db.prepare("SELECT time, duration FROM appointments WHERE date = ? AND status != 'cancelled'").all(date) as { time: string, duration: number }[];
    
    const isOverlapping = existingApts.some(a => {
      const eStart = toMinutes(a.time);
      const eEnd = eStart + (a.duration || 60);
      // Check if [startMins, endMins + buffer) overlaps with [eStart, eEnd + buffer)
      return (startMins < eEnd + buffer) && (endMins + buffer > eStart);
    });

    if (isOverlapping) {
      return res.status(400).json({ error: "This time slot is no longer available." });
    }

    const info = db.prepare(`
      INSERT INTO appointments (client_name, client_email, client_phone, services, duration, total_price, consent, date, time, image_url, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(client_name, client_email, client_phone, JSON.stringify(services), duration, totalPrice, consent ? 1 : 0, date, time, image_url, notes);

    // Real Email Sending
    const sendEmail = async () => {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const ownerEmails = "ikemirerenee@gmail.com, alexistucker220@gmail.com";
      const mailOptions = {
        from: `"HoneyBeeYou Salon" <${process.env.SMTP_USER}>`,
        to: `${ownerEmails}, ${client_email}`,
        subject: `Booking Confirmation: ${client_name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #6d28d9; border-bottom: 2px solid #6d28d9; padding-bottom: 10px;">Appointment Confirmation</h2>
            <p>Hello ${client_name},</p>
            <p>Thank you for booking with HoneyBeeYou Salon! Here are your appointment details:</p>
            
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Date:</strong> ${date}</p>
              <p><strong>Time:</strong> ${format12h(time)}</p>
              <p><strong>Services:</strong> ${services.join(', ')}</p>
              <p><strong>Total Price:</strong> $${totalPrice}</p>
              <p><strong>Duration:</strong> ${duration} mins</p>
              <p><strong>Phone:</strong> ${client_phone || 'Not provided'}</p>
              <p><strong>Consent to Contact:</strong> ${consent ? 'Yes' : 'No'}</p>
            </div>

            <p><strong>Notes:</strong> ${notes || 'None'}</p>
            
            <p style="margin-top: 20px;">We look forward to seeing you!</p>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
              This is an automated notification. If you need to reschedule, please contact us directly.
            </div>
          </div>
        `,
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully. Message ID: ${info.messageId}`);
        console.log(`Recipients: ${ownerEmails}, ${client_email}`);
      } catch (error) {
        console.error("CRITICAL: Error sending email via SMTP:", error);
        console.error("Ensure your SMTP_USER, SMTP_PASS, SMTP_HOST, and SMTP_PORT are correct in the Secrets panel.");
      }
    };

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      sendEmail();
    } else {
      console.warn("SMTP credentials not configured. Skipping email sending.");
      console.log(`Mock Email Sending:
        Client: ${client_name}
        Email: ${client_email}
        Phone: ${client_phone}
        Services: ${services.join(', ')}
        Date: ${date}
        Time: ${time}
        Duration: ${duration} mins
        Notes: ${notes}
      `);
    }

    broadcast({ type: 'DATA_UPDATED' });
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/appointments/:id", (req, res) => {
    db.prepare("DELETE FROM appointments WHERE id = ?").run(req.params.id);
    broadcast({ type: 'DATA_UPDATED' });
    res.json({ success: true });
  });

  app.patch("/api/appointments/:id/notes", (req, res) => {
    const { notes } = req.body;
    db.prepare("UPDATE appointments SET notes = ? WHERE id = ?").run(notes, req.params.id);
    broadcast({ type: 'DATA_UPDATED' });
    res.json({ success: true });
  });

  app.get("/api/events", (req, res) => {
    const events = db.prepare(`
      SELECT e.*, (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) as registration_count 
      FROM events e
      ORDER BY date, time
    `).all();
    res.json(events);
  });

  app.post("/api/events", (req, res) => {
    const { title, date, time, description, capacity } = req.body;
    const info = db.prepare("INSERT INTO events (title, date, time, description, capacity) VALUES (?, ?, ?, ?, ?)").run(title, date, time, description, capacity);
    broadcast({ type: 'DATA_UPDATED' });
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/events/:id", (req, res) => {
    const { title, date, time, description, capacity } = req.body;
    db.prepare("UPDATE events SET title = ?, date = ?, time = ?, description = ?, capacity = ? WHERE id = ?").run(title, date, time, description, capacity, req.params.id);
    broadcast({ type: 'DATA_UPDATED' });
    res.json({ success: true });
  });

  app.delete("/api/events/:id", (req, res) => {
    db.prepare("DELETE FROM event_registrations WHERE event_id = ?").run(req.params.id);
    db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
    broadcast({ type: 'DATA_UPDATED' });
    res.json({ success: true });
  });

  app.post("/api/events/:id/register", (req, res) => {
    const { name, email } = req.body;
    const event = db.prepare("SELECT capacity, (SELECT COUNT(*) FROM event_registrations WHERE event_id = ?) as count FROM events WHERE id = ?").get(req.params.id, req.params.id) as { capacity: number, count: number };
    
    if (event.count >= event.capacity) {
      return res.status(400).json({ error: "Event is full" });
    }

    db.prepare("INSERT INTO event_registrations (event_id, name, email) VALUES (?, ?, ?)").run(req.params.id, name, email);
    broadcast({ type: 'DATA_UPDATED' });
    res.json({ success: true });
  });

  app.get("/api/hours", (req, res) => {
    const hours = db.prepare("SELECT * FROM business_hours").all();
    res.json(hours);
  });

  app.put("/api/hours", (req, res) => {
    const { hours } = req.body;
    const update = db.prepare("UPDATE business_hours SET open_time = ?, close_time = ?, is_closed = ? WHERE day = ?");
    const transaction = db.transaction((hoursList) => {
      for (const h of hoursList) {
        update.run(h.open_time, h.close_time, h.is_closed ? 1 : 0, h.day);
      }
    });
    transaction(hours);
    broadcast({ type: 'DATA_UPDATED' });
    res.json({ success: true });
  });

  app.get("/api/gallery", (req, res) => {
    const images = db.prepare("SELECT * FROM gallery ORDER BY id DESC").all();
    res.json(images);
  });

  app.post("/api/gallery", (req, res) => {
    const { url, caption } = req.body;
    const info = db.prepare("INSERT INTO gallery (url, caption) VALUES (?, ?)").run(url, caption);
    broadcast({ type: 'DATA_UPDATED' });
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/gallery/:id", (req, res) => {
    db.prepare("DELETE FROM gallery WHERE id = ?").run(req.params.id);
    broadcast({ type: 'DATA_UPDATED' });
    res.json({ success: true });
  });

  app.get("/api/dashboard/stats", (req, res) => {
    const totalAppointments = db.prepare("SELECT COUNT(*) as count FROM appointments").get() as { count: number };
    const totalRevenue = db.prepare("SELECT SUM(COALESCE(total_price, s.price)) as total FROM appointments a LEFT JOIN services s ON a.service_id = s.id WHERE a.status != 'cancelled'").get() as { total: number };
    const newClients = db.prepare("SELECT COUNT(DISTINCT client_email) as count FROM appointments").get() as { count: number };
    
    const dailyStats = db.prepare(`
      SELECT date, COUNT(*) as count, SUM(COALESCE(total_price, s.price)) as revenue
      FROM appointments a
      LEFT JOIN services s ON a.service_id = s.id
      WHERE a.status != 'cancelled'
      GROUP BY date
      ORDER BY date DESC
      LIMIT 7
    `).all();

    res.json({
      totalAppointments: totalAppointments.count,
      totalRevenue: totalRevenue.total || 0,
      newClients: newClients.count,
      dailyStats
    });
  });

  // Available Slots API
  app.get("/api/available-slots", (req, res) => {
    const { date, duration } = req.query;
    if (!date) return res.status(400).json({ error: "Missing date" });
    const totalDuration = parseInt(duration as string) || 60;
    const buffer = 15;

    // Robust day name calculation from YYYY-MM-DD string
    const [year, month, day] = (date as string).split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(dateObj);
    const hours = db.prepare("SELECT * FROM business_hours WHERE day = ?").get(dayName) as any;

    if (!hours || hours.is_closed) {
      return res.json([]);
    }

    const existingApts = db.prepare("SELECT time, duration FROM appointments WHERE date = ? AND status != 'cancelled'").all(date) as { time: string, duration: number }[];
    
    const bookedRanges = existingApts.map(a => ({
      start: toMinutes(a.time),
      end: toMinutes(a.time) + (a.duration || 60) + buffer
    }));

    const slots = [];
    const openMins = toMinutes(hours.open_time);
    const closeMins = toMinutes(hours.close_time);

    for (let current = openMins; current + totalDuration <= closeMins; current += 15) {
      const slotStart = current;
      const slotEnd = current + totalDuration;
      
      const isOverlapping = bookedRanges.some(range => {
        return (slotStart < range.end) && (slotEnd + buffer > range.start);
      });

      if (!isOverlapping) {
        slots.push(fromMinutes(current));
      }
    }

    res.json(slots);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
