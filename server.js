const express = require('express');
const { BigQuery } = require('@google-cloud/bigquery');
const app = express();
const path = require('path');

app.use(express.json());

// Serwowanie plików statycznych
app.use(express.static(path.join(__dirname, 'frontend')));

// Połącz z BigQuery
const bigquery = new BigQuery();
const datasetId = process.env.BIGQUERY_DATASET || 'events_dataset';
const tableId = process.env.BIGQUERY_TABLE || 'events';

// Endpoint do dodawania wydarzeń
app.post('/events', async (req, res) => {
  try {
    const event = req.body;
    event.date = new Date(event.date).toISOString();

    const rows = [{ ...event }];
    
    await bigquery.dataset(datasetId).table(tableId).insert(rows);
    
    res.status(200).json({ message: 'Event added successfully' });
  } catch (error) {
    console.error('Error inserting to BigQuery:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint do pobierania wydarzeń
app.get('/events', async (req, res) => {
  try {
    const query = `SELECT * FROM \`${datasetId}.${tableId}\` ORDER BY date DESC LIMIT 100`;
    const [rows] = await bigquery.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error querying BigQuery:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint do analityki
app.get('/analytics', async (req, res) => {
  try {
    const queries = {
      eventsOverTime: `
        SELECT FORMAT_DATE('%Y-%m-%d', date) AS date, COUNT(*) AS count 
        FROM \`${datasetId}.${tableId}\`
        GROUP BY date ORDER BY date`,
      topLocations: `
        SELECT location, COUNT(*) AS count 
        FROM \`${datasetId}.${tableId}\`
        GROUP BY location ORDER BY count DESC LIMIT 5`,
      categories: `
        SELECT category, COUNT(*) AS count 
        FROM \`${datasetId}.${tableId}\`
        GROUP BY category`
    };

    const results = {};
    for (const [key, query] of Object.entries(queries)) {
      const [rows] = await bigquery.query(query);
      results[key] = key === 'eventsOverTime' ? {
        dates: rows.map(r => r.date),
        counts: rows.map(r => parseInt(r.count))
      } : rows;
    }

    res.json(results);
  } catch (error) {
    console.error('Error with analytics queries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Obsługa SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});