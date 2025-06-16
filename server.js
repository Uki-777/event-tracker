const express = require('express');
const { BigQuery } = require('@google-cloud/bigquery');
const app = express();
const path = require('path');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

const bigquery = new BigQuery();
const datasetId = process.env.BIGQUERY_DATASET || 'events_dataset';
const tableId = process.env.BIGQUERY_TABLE || 'events';

// AUTO-ID jako STRING
async function getNextId() {
  try {
    const query = `SELECT MAX(CAST(id AS INT64)) AS maxId FROM \`${datasetId}.${tableId}\``;
    const [rows] = await bigquery.query(query);
    const maxId = rows[0]?.maxId || 0;
    return (maxId + 1).toString();
  } catch (error) {
    console.error('Error getting next ID:', error);
    return '1'; // Fallback ID
  }
}

// POST /events
app.post('/events', async (req, res) => {
  try {
    const event = req.body;
    
    // Walidacja danych wejściowych
    if (!event.name || !event.date || !event.location || !event.category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Formatowanie daty
    event.date = new Date(event.date).toISOString();
    event.id = await getNextId();

    // Logowanie danych przed wysłaniem
    console.log('Inserting event:', event);

    const [apiResponse] = await bigquery
      .dataset(datasetId)
      .table(tableId)
      .insert([event]);

    console.log('Insert response:', apiResponse);
    res.status(200).json({ message: 'Event added successfully', id: event.id });
  } catch (error) {
    console.error('Error inserting to BigQuery:', error.errors || error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.errors ? error.errors[0].errors : error.message
    });
  }
});

// GET /events
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

// DELETE /events/:id
app.delete('/events/:id', async (req, res) => {
  const eventId = req.params.id;
  if (!eventId) return res.status(400).json({ error: 'Missing ID' });

  try {
    const query = `DELETE FROM \`${datasetId}.${tableId}\` WHERE id = @id`;
    const [job] = await bigquery.createQueryJob({
      query: query,
      params: { id: eventId }
    });

    console.log(`Job ${job.id} started for deleting event ${eventId}`);
    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /analytics
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
      results[key] = key === 'eventsOverTime'
        ? { dates: rows.map(r => r.date), counts: rows.map(r => parseInt(r.count)) }
        : rows;
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